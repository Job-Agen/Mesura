# Mesura — "Your money. Your rules."

Sandbox prototype of **Mesura**, a controlled virtual card for online payments (initial market: Togo).
The user decides **HOW MUCH** a card can spend, **WHERE** it can be used, **HOW MANY** times, and **HOW LONG** it stays active.

> **Sandbox only.** No real money moves, no real Visa/Mastercard is issued, no Mobile Money
> request is sent and no KYC provider is called. All external partners are fake providers
> behind interfaces, so they can later be replaced by regulated partners.

```
apps/
  api/        NestJS + Prisma + PostgreSQL (modular monolith)
  mobile/     Expo (React Native) + Expo Router + TanStack Query
packages/
  shared/     Enums, money helpers, Zod request schemas, API response types
  config/     Shared strict tsconfig
legacy/
  flutter-prototype/   Earlier UI-only Flutter mock (kept for reference)
```

Architecture, data model, endpoint list and build phases: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Requirements

- Node.js ≥ 20 and pnpm 10 (`corepack enable`)
- PostgreSQL 14+ locally, in Docker, or on [Neon](https://neon.tech)
- For the phone: the Expo Go app (SDK 57) or an Android emulator / iOS simulator

## 1. Install

```bash
pnpm install          # also generates the Prisma client
pnpm build:shared     # compiles packages/shared (API and app import it)
```

## 2. Database

Start Postgres (skip if you already have one):

```bash
docker run -d --name mesura-db -p 5432:5432 -e POSTGRES_USER=mesura -e POSTGRES_PASSWORD=mesura -e POSTGRES_DB=mesura postgres:16
```

Configure and migrate:

```bash
cp apps/api/.env.example apps/api/.env
# set JWT_SECRET (≥ 32 chars):
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

pnpm db:migrate       # applies prisma/migrations
pnpm db:seed          # merchants, demo user, demo cards and activity
```

**Neon:** put the *pooled* connection string in `DATABASE_URL` and the *direct* one in `DIRECT_URL`
(both with `?sslmode=require`), then run `pnpm --filter @mesura/api prisma:deploy` and `pnpm db:seed`.

Demo account created by the seed: **`demo@mesura.test` / `demo1234`** (KYC verified, 4 cards, mixed activity).

## 3. Run the API

```bash
pnpm api:dev          # http://localhost:3000
```

## 4. Run the mobile app

```bash
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_API_URL must be reachable from the device:
#   iOS simulator / web: http://localhost:3000
#   Android emulator:    http://10.0.2.2:3000
#   Phone with Expo Go:  http://<your computer's LAN IP>:3000
pnpm mobile:dev       # then press a (Android), i (iOS), w (web) or scan the QR code
```

## Android APK (sandbox)

The APK is a standalone release build (JS bundled, signed with the debug key — for testing only).

**On the phone:** install the APK, open it, and on the *Log in / Sign up* screen tap
**API server (sandbox) → Change**, enter the address of a reachable Mesura API — for example your
computer on the same Wi-Fi, `http://192.168.1.20:3000` (start it with `pnpm api:dev`) — then
**Save & test**. The choice is remembered. The build default is `http://10.0.2.2:3000`
(the host machine, seen from the Android emulator).

**Build it yourself** (needs JDK 17+ and the Android SDK with NDK 27.1):

```bash
cd apps/mobile
npx expo prebuild --platform android --no-install
cd android && EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 ./gradlew assembleRelease \
  -PreactNativeArchitectures=arm64-v8a -Pexpo.useLegacyPackaging=true
# → apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

**Or on GitHub:** the *Build Mesura Android APK* workflow builds it on every push touching the
mobile app and uploads it as the `mesura-sandbox-apk` artifact (set the repository variable
`PO_API_URL` to change the default server).

Plain `http://` is allowed in this sandbox build (`plugins/with-sandbox-cleartext.js`) so a LAN
API works; a production build must use an `https://` API and drop that plugin.

## Google Play Store

The Play Store variant (`africa.mesura.app`, https-only, no server picker) is built as a signed AAB by the
*Release Android (Play Store AAB)* workflow. Listing texts, visuals, Play Console answers and the signing
procedure are in [`docs/play-store/README.md`](docs/play-store/README.md).

## 5. Try the full flow

1. **Onboarding → Sign up** (any email, 8+ char password)
2. **KYC** — name, date of birth (18+), Togo number → verified instantly (sandbox)
3. **Home → Create a card** → Where (Anywhere / merchant) → How much → How many → How long
4. **Review** — maximum, merchant, payments, duration, illustrative fees (5 %)
5. **Fund** — pick TMoney / Flooz / Moov Money → *Pay 15,750 FCFA*
6. **Confirm the payment** — auto-confirms after ~10 s, or tap *Simulate confirmation*
7. **Card created** → **Card details** — masked card, rules, *Freeze*, *Manage rules*, *Terminate*
8. **Simulate an online payment** — choose a merchant and amount → **Approved** or **Payment blocked**
9. **Activity** — All / Approved / Blocked → transaction details with the plain-language reason

Or drive it from the command line (merchant charging a card):

```bash
curl -X POST localhost:3000/sandbox/transactions \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"cardId":"<id>","merchant":"CANVA","amount":5650,"currency":"XOF"}'
# → {"status":"APPROVED", ...}  or  {"status":"BLOCKED","reason":"MERCHANT_NOT_ALLOWED", ...}
```

## Tests and checks

```bash
pnpm test                          # CardPolicyEngine unit tests (Jest)
pnpm typecheck                     # shared + api + mobile, strict TypeScript
pnpm --filter @mesura/api smoke        # end-to-end API scenario against a running API + seeded DB
```

## Sandbox configuration (`apps/api/.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `SANDBOX_MODE` | `true` in `.env.example` | Enables `/sandbox/*`. When `false` those routes return 404. |
| `SANDBOX_FUNDING_AUTO_CONFIRM_SECONDS` | `10` | Fake Mobile Money auto-approval delay (`0` = manual only). |
| `SERVICE_FEE_BPS` | `500` | Illustrative fee, in basis points (5 %). |
| `FREE_CARDS_PER_PERSON` | `0` | Cards per person funded without the fee. A person = verified identity + Mobile Money number, tracked by fingerprints that survive account deletion. |
| `FINGERPRINT_SECRET` | *(derived from `JWT_SECRET`)* | Key of those fingerprints (≥ 32 chars). Set it before real users sign up and never change it. |
| `FEDAPAY_SECRET_KEY` | *(empty)* | [FedaPay](https://docs.fedapay.com) key for real Mobile Money. Empty = simulated. `sk_sandbox_…` = FedaPay test mode (test number approved, a number ending in 99 declined). `sk_live_…` = real money, refused unless `FEDAPAY_ALLOW_LIVE=true`. |
| `FEDAPAY_PAYOUTS_ENABLED` | `false` | Send refunds of unspent card balances (TMoney only) with FedaPay payouts, once FedaPay's support has enabled payouts on the account. `false` = refunds simulated. Required with a live key. |
| `FUNDING_EXPIRY_MINUTES` | `15` | A pending Mobile Money request expires after this. |
