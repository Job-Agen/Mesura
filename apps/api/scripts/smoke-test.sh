#!/usr/bin/env bash
# End-to-end sandbox smoke test against a running API (default http://localhost:3000).
# Requires: curl, python3, a migrated + seeded database.
#   pnpm --filter @mesura/api smoke
set -euo pipefail
A="${API_URL:-http://localhost:3000}"
JSON='content-type: application/json'
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }
post() { curl -s -X POST "$A$1" -H "$H" -H "$JSON" -d "${2:-{\}}"; }
pay() { post /sandbox/transactions "{\"cardId\":\"$1\",\"merchant\":\"$2\",\"amount\":$3,\"currency\":\"XOF\"}"; }

EMAIL="smoke$RANDOM$RANDOM@test.dev"
echo "== register without accepting the terms (expect 400)"
curl -s -X POST "$A/auth/register" -H "$JSON" \
  -d "{\"name\":\"Ama\",\"email\":\"$EMAIL\",\"password\":\"password123\"}" | j "d['statusCode']"
echo "== register $EMAIL"
TOKEN=$(curl -sf -X POST "$A/auth/register" -H "$JSON" \
  -d "{\"name\":\"Ama\",\"email\":\"$EMAIL\",\"password\":\"password123\",\"acceptTerms\":true}" | j "d['accessToken']")
H="Authorization: Bearer $TOKEN"
curl -s "$A/me" -H "$H" | j "(d['name'], d['kycStatus'])"

echo "== draft + fund before KYC (expect 403)"
CARD=$(post /cards/draft '{"maxAmount":15000,"maxTransactionCount":1,"durationMinutes":1440,"merchantRestriction":"canva"}' | j "d['id']")
post "/cards/$CARD/fund" '{"provider":"TMONEY","phone":"+228 90 12 34 56"}' | j "(d['statusCode'], d['message'])"

echo "== KYC"
# A random birth date: one verified identity per live account, and earlier runs may have left accounts behind.
IDENTITY="{\"firstName\":\"Ama\",\"lastName\":\"Kodjo\",\"dateOfBirth\":\"19$((80 + RANDOM % 20))-0$((1 + RANDOM % 9))-1$((RANDOM % 9))\",\"country\":\"TG\",\"phone\":\"+228 90 12 34 56\"}"
post /kyc/start "$IDENTITY" | j "d['status']"
post /kyc/complete | j "d['status']"
echo "== same identity on a second account (expect 409)"
TOKEN2=$(curl -sf -X POST "$A/auth/register" -H "$JSON" \
  -d "{\"name\":\"Ama\",\"email\":\"dup$EMAIL\",\"password\":\"password123\",\"acceptTerms\":true}" | j "d['accessToken']")
curl -s -X POST "$A/kyc/start" -H "Authorization: Bearer $TOKEN2" -H "$JSON" -d "$IDENTITY" | j "d['status']"
curl -s -X POST "$A/kyc/complete" -H "Authorization: Bearer $TOKEN2" -H "$JSON" -d '{}' | j "(d['statusCode'], d['message'])"
curl -s -o /dev/null -w 'second account deleted: %{http_code}\n' -X DELETE "$A/me" -H "Authorization: Bearer $TOKEN2" -H "$JSON" -d '{"password":"password123"}'

echo "== validation (expect 400s)"
post /cards/draft '{"maxAmount":0,"maxTransactionCount":1,"durationMinutes":1440,"merchantRestriction":null}' | j "(d['statusCode'], d['message'])"
post /cards/draft '{"maxAmount":15000,"maxTransactionCount":1,"durationMinutes":-1,"merchantRestriction":null}' | j "(d['statusCode'], d['message'])"
pay "$CARD" CANVA -10 | j "(d['statusCode'], d['message'])"

echo "== review pricing (illustrative)"
curl -s "$A/cards/$CARD" -H "$H" | j "(d['status'], d['pricing'])"

echo "== fund"
FID=$(post "/cards/$CARD/fund" '{"provider":"TMONEY","phone":"+228 90 12 34 56"}' | j "d['id']")
# Before the funding is read back: with FedaPay the payment may already be approved, but the
# card is only activated when Mesura syncs the funding.
echo "-- payment before activation (expect BLOCKED CARD_NOT_ACTIVE)"
pay "$CARD" CANVA 5650 | j "(d['status'], d.get('reason'))"
curl -s "$A/funding/$FID" -H "$H" | j "(d['status'], d['total'])"
echo "-- confirm Mobile Money"
post "/sandbox/funding/$FID/confirm" | j "d['status']"
curl -s "$A/cards/$CARD" -H "$H" | j "(d['status'], d['last4'])"
echo "-- card details (demo number ending with the last4 shown, valid Luhn)"
LAST4=$(curl -s "$A/cards/$CARD" -H "$H" | j "d['last4']")
post "/cards/$CARD/reveal" | python3 -c "
import sys,json; d=json.load(sys.stdin); n=d['number']
luhn=sum((int(c) if i%2==0 else (int(c)*2-9 if int(c)*2>9 else int(c)*2)) for i,c in enumerate(reversed(n)))%10==0
print(n.endswith('$LAST4'), luhn, len(d['cvv']), d['demo'])"

echo "== payments on the one-payment Canva card"
pay "$CARD" GOOGLE 5650 | j "(d['status'], d.get('reason'), d['transaction']['declineMessage'])"
pay "$CARD" CANVA 15001 | j "(d['status'], d.get('reason'))"
pay "$CARD" CANVA 5650 | j "(d['status'], d.get('reason'))"
curl -s "$A/cards/$CARD" -H "$H" | j "(d['status'], d['terminationReason'], d['policy']['spentAmount'], d['policy']['remainingLimit'])"
pay "$CARD" CANVA 100 | j "(d['status'], d.get('reason'))"

echo "== 5-payment card: freeze / unfreeze / tighten rules / terminate"
C2=$(post /cards/draft '{"maxAmount":20000,"maxTransactionCount":5,"durationMinutes":60,"merchantRestriction":null}' | j "d['id']")
F2=$(post "/cards/$C2/fund" '{"provider":"FLOOZ","phone":"+22899887766"}' | j "d['id']")
post "/sandbox/funding/$F2/confirm" | j "d['status']"
post "/cards/$C2/freeze" | j "d['status']"
pay "$C2" Netflix 3000 | j "(d['status'], d.get('reason'))"
post "/cards/$C2/unfreeze" | j "d['status']"
pay "$C2" Netflix 3000 | j "(d['status'], d['transaction']['merchantName'])"
curl -s -X PATCH "$A/cards/$C2/rules" -H "$H" -H "$JSON" -d '{"maxAmount":50000}' | j "(d['statusCode'], d['message'])"
curl -s -X PATCH "$A/cards/$C2/rules" -H "$H" -H "$JSON" -d '{"maxAmount":10000,"maxTransactionCount":2}' | j "(d['policy']['maxAmount'], d['policy']['maxTransactionCount'])"
curl -s -X DELETE "$A/cards/$C2" -H "$H" | j "(d['status'], d['terminationReason'])"
echo "-- details of a terminated card (expect 409)"
post "/cards/$C2/reveal" | j "(d['statusCode'], d['message'])"
pay "$C2" Netflix 100 | j "(d['status'], d.get('reason'))"

echo "== activity"
curl -s "$A/transactions" -H "$H" | j "len(d)"
curl -s "$A/transactions?status=BLOCKED" -H "$H" | j "[t['declineReason'] for t in d]"

echo "== ownership: the demo user cannot see or charge this user's card (expect 404s)"
DT=$(curl -s -X POST "$A/auth/login" -H "$JSON" -d '{"email":"demo@mesura.test","password":"demo1234"}' | j "d['accessToken']")
curl -s "$A/cards/$CARD" -H "Authorization: Bearer $DT" | j "(d['statusCode'], d['message'])"
curl -s -X POST "$A/sandbox/transactions" -H "Authorization: Bearer $DT" -H "$JSON" \
  -d "{\"cardId\":\"$CARD\",\"merchant\":\"CANVA\",\"amount\":100,\"currency\":\"XOF\"}" | j "(d['statusCode'], d['message'])"

echo "== auth (expect 401s)"
curl -s "$A/cards" | j "(d['statusCode'], d['message'])"
curl -s -X POST "$A/auth/login" -H "$JSON" -d '{"email":"demo@mesura.test","password":"wrong-pass"}' | j "(d['statusCode'], d['message'])"
echo "== password reset (same answer for any e-mail; a wrong code is rejected)"
curl -s -X POST "$A/auth/forgot-password" -H "$JSON" -d "{\"email\":\"$EMAIL\"}" | j "d"
curl -s -X POST "$A/auth/forgot-password" -H "$JSON" -d '{"email":"nobody@test.dev"}' | j "d"
curl -s -X POST "$A/auth/reset-password" -H "$JSON" \
  -d "{\"email\":\"$EMAIL\",\"code\":\"000000\",\"password\":\"password456\"}" | j "(d['statusCode'], d['message'])"
echo "== account deletion (wrong password: 403, then 204, then the token no longer works)"
curl -s -X DELETE "$A/me" -H "$H" -H "$JSON" -d '{"password":"not-my-password"}' | j "(d['statusCode'], d['message'])"
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE "$A/me" -H "$H" -H "$JSON" -d '{"password":"password123"}'
curl -s "$A/me" -H "$H" | j "(d['statusCode'], d['message'])"

echo "== legal pages"
curl -s -o /dev/null -w 'privacy %{http_code}\n' "$A/legal/privacy"
curl -s -o /dev/null -w 'delete-account %{http_code}\n' "$A/legal/delete-account"
curl -s -o /dev/null -w 'terms %{http_code}\n' "$A/legal/terms"
curl -s "$A/legal/contact" | j "d"
echo "== done"
