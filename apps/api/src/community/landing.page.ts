import { escape } from '../legal/legal.pages';
import { FAVICON, LOGO_SVG, SCREEN_AMOUNT, SCREEN_DETAILS, WORDMARK_WHITE_SVG } from './landing.assets';

export interface LandingContact {
  email: string;
  publisher: string;
}

/**
 * Public landing page served at the API root. No JavaScript (the CSP forbids inline scripts):
 * the FAQ uses <details>, images are inlined, so the page loads in one request on slow networks.
 */
export function landingPage(c: LandingContact): string {
  const who = c.publisher ? escape(c.publisher) : 'Mesura';
  const contact = c.email ? `<a href="mailto:${escape(c.email)}">${escape(c.email)}</a>` : '';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mesura — Cartes virtuelles éphémères, rechargées par Mobile Money</title>
<meta name="description" content="Créez une carte virtuelle pour un achat ou un mois d'abonnement, rechargez-la avec Mixx by Yas ou Flooz, et elle s'éteint toute seule. En test au Togo.">
<meta property="og:title" content="Mesura — Payez en ligne sans exposer votre argent">
<meta property="og:description" content="Des cartes virtuelles éphémères, avec plafond, marchand et durée, rechargées par Mobile Money. En test au Togo.">
<meta property="og:type" content="website">
<meta name="theme-color" content="#073D31">
<link rel="icon" href="${FAVICON}">
<style>
  :root {
    color-scheme: light dark;
    --forest: #073D31; --deep: #04291F; --green: #005C47; --accent: #0AA17F; --mint: #E3F2EA; --glow: #7FD8B8;
    --bg: #F5F7F5; --surface: #FFFFFF; --text: #101815; --muted: #5E6B65; --border: #E3E8E4;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0B1411; --surface: #131E1A; --text: #E8EEEA; --muted: #9AA8A1; --border: #22302B; --mint: #173A2F; --green: #4FD1A5; }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-text-size-adjust: 100%; }
  a { color: var(--green); }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
  h1, h2, h3 { line-height: 1.15; letter-spacing: -0.02em; margin: 0; }
  h2 { font-size: clamp(26px, 4vw, 36px); margin-bottom: 12px; }
  h3 { font-size: 19px; margin-bottom: 6px; }
  p { margin: 0 0 12px; }
  .muted { color: var(--muted); }
  .kicker { color: var(--accent); font-weight: 700; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; }

  header { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
  header .wrap { display: flex; align-items: center; justify-content: space-between; height: 64px; }
  header .logo svg { height: 30px; width: auto; display: block; }
  header nav a:not(.btn) { color: var(--text); text-decoration: none; margin-right: 18px; font-weight: 600; font-size: 15px; }
  @media (max-width: 720px) { header nav a:not(.btn) { display: none; } }
  @media (prefers-color-scheme: dark) { header .logo svg rect { fill: #0E5A47; } header .logo svg g + g path { fill: #E8EEEA; } }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 22px;
    border-radius: 14px; font-weight: 700; text-decoration: none; font-size: 16px; }
  .btn.primary { background: var(--forest); color: #fff; }
  .btn.ghost { background: var(--mint); color: var(--forest); }
  @media (prefers-color-scheme: dark) { .btn.primary { background: var(--accent); color: #04291F; } .btn.ghost { color: #E8EEEA; } }
  header .btn { min-height: 40px; padding: 0 16px; font-size: 15px; }

  .hero { padding: 56px 0 40px; }
  .hero .wrap { display: grid; grid-template-columns: 1.1fr .9fr; gap: 40px; align-items: center; }
  .pill { display: inline-block; background: var(--mint); color: var(--green); font-weight: 700; font-size: 14px;
    padding: 6px 12px; border-radius: 999px; margin-bottom: 18px; }
  .hero h1 { font-size: clamp(36px, 6vw, 60px); margin-bottom: 18px; }
  .hero h1 em { font-style: normal; color: var(--accent); }
  .hero .lead { font-size: 19px; color: var(--muted); max-width: 34em; margin-bottom: 26px; }
  .ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }
  .fine { font-size: 14px; color: var(--muted); }

  .card-stage { display: flex; flex-direction: column; align-items: center; gap: 44px; padding: 10px 0 0; }
  .card-wrap { position: relative; width: min(100%, 360px); }
  .vcard { position: relative; width: 100%; aspect-ratio: 1.586; border-radius: 22px; overflow: hidden;
    background: var(--deep); color: #fff; padding: 22px 24px; box-shadow: 0 30px 60px -20px rgba(4,41,31,.55); }
  .vcard::before { content: ""; position: absolute; right: -40px; bottom: -60px; width: 230px; height: 230px;
    border-radius: 60px; background: #0A5A46; transform: rotate(28deg); }
  .vcard.back { position: absolute; inset: 0; transform: rotate(-9deg) translate(-26px, 18px); opacity: .55; background: var(--forest); }
  .vcard .top { position: relative; display: flex; justify-content: space-between; align-items: center; }
  .vcard .top svg { height: 22px; width: auto; }
  .vcard .net { font-size: 11px; letter-spacing: .18em; opacity: .8; font-weight: 700; }
  .vcard .label { position: absolute; left: 24px; bottom: 54px; font-size: 12px; letter-spacing: .16em; opacity: .85; font-weight: 700; }
  .vcard .num { position: absolute; left: 24px; bottom: 22px; font-size: 20px; letter-spacing: .14em; font-weight: 700; }
  .timer { position: absolute; right: -10px; bottom: -28px; background: var(--surface); color: var(--text); border: 1px solid var(--border);
    border-radius: 14px; padding: 10px 14px; font-size: 14px; font-weight: 700; box-shadow: 0 10px 30px -12px rgba(0,0,0,.25); }
  .timer span { display: block; font-size: 12px; font-weight: 600; color: var(--muted); }
  .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 380px; }
  .chip { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 700; }

  section { padding: 64px 0; }
  section.alt { background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 28px; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 28px; }
  .box { background: var(--bg); border: 1px solid var(--border); border-radius: 18px; padding: 22px; }
  section:not(.alt) .box { background: var(--surface); }
  .icon { width: 42px; height: 42px; border-radius: 12px; background: var(--mint); color: var(--green); display: grid; place-items: center;
    font-weight: 800; font-size: 18px; margin-bottom: 14px; }
  .step-n { color: var(--accent); font-weight: 800; font-size: 14px; margin-bottom: 6px; }

  .show { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
  .phones { display: flex; gap: 18px; justify-content: center; }
  .phone { width: min(46%, 220px); border-radius: 28px; padding: 8px; background: #0E1512; box-shadow: 0 24px 50px -24px rgba(0,0,0,.5); }
  .phone img { display: block; width: 100%; height: auto; border-radius: 21px; }
  .phone:nth-child(2) { transform: translateY(28px); }
  ul.check { list-style: none; padding: 0; margin: 18px 0 0; }
  ul.check li { padding-left: 32px; position: relative; margin-bottom: 12px; }
  ul.check li::before { content: "✓"; position: absolute; left: 0; top: 1px; width: 22px; height: 22px; border-radius: 50%;
    background: var(--mint); color: var(--green); font-size: 13px; font-weight: 800; display: grid; place-items: center; }

  .uses { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 28px; }
  .use { border-radius: 18px; padding: 20px; background: var(--forest); color: #fff; }
  .use b { display: block; font-size: 18px; margin-bottom: 4px; }
  .use span { color: rgba(255,255,255,.75); font-size: 15px; }

  details { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 4px 18px; margin-bottom: 10px; }
  summary { cursor: pointer; font-weight: 700; padding: 14px 0; list-style: none; position: relative; padding-right: 28px; }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: "+"; position: absolute; right: 0; top: 10px; font-size: 22px; color: var(--accent); }
  details[open] summary::after { content: "–"; }
  details p { color: var(--muted); }

  .final { text-align: center; background: var(--forest); color: #fff; border-radius: 28px; padding: 48px 24px; }
  .final p { color: rgba(255,255,255,.8); max-width: 36em; margin: 0 auto 24px; }
  .final .btn.primary { background: #fff; color: var(--forest); }
  .final .btn.ghost { background: rgba(255,255,255,.12); color: #fff; }
  .final .ctas { justify-content: center; }

  footer { padding: 36px 0 48px; color: var(--muted); font-size: 14px; }
  footer .wrap { display: flex; flex-wrap: wrap; gap: 12px 28px; justify-content: space-between; }
  footer a { color: var(--muted); }

  @media (max-width: 900px) {
    .hero .wrap, .show { grid-template-columns: 1fr; }
    .hero { padding-top: 32px; }
    .grid4, .uses { grid-template-columns: repeat(2, 1fr); }
    .grid3 { grid-template-columns: 1fr; }
  }
  @media (max-width: 520px) {
    .grid4, .uses { grid-template-columns: 1fr; }
    .ctas .btn { width: 100%; }
    section { padding: 48px 0; }
    .card-stage { gap: 72px; }
    .timer { right: 0; bottom: -52px; }
  }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <a class="logo" href="/" aria-label="Mesura, accueil">${LOGO_SVG}</a>
    <nav>
      <a href="#comment">Comment ça marche</a>
      <a href="#faq">Questions</a>
      <a class="btn primary" href="/testeurs">Devenir testeur</a>
    </nav>
  </div>
</header>

<main>
<section class="hero">
  <div class="wrap">
    <div>
      <span class="pill">En test au Togo · version démo</span>
      <h1>Payez en ligne sans exposer <em>votre argent</em>.</h1>
      <p class="lead">Mesura crée des <strong>cartes virtuelles éphémères</strong>, une par achat ou par mois d'abonnement.
      Vous la rechargez avec <strong>Mixx by Yas</strong> ou <strong>Flooz</strong>, juste du montant nécessaire, et elle
      s'éteint toute seule à la fin.</p>
      <div class="ctas">
        <a class="btn primary" href="/testeurs">Essayer la démo (Android)</a>
        <a class="btn ghost" href="/liste-attente">Être prévenu du lancement</a>
      </div>
      <p class="fine">Sans compte bancaire. Mesura ne vous demande jamais votre code PIN Mobile Money.</p>
    </div>
    <div class="card-stage" aria-hidden="true">
      <div class="card-wrap">
        <div class="vcard back"></div>
        <div class="vcard">
          <div class="top">${WORDMARK_WHITE_SVG}<span class="net">CARTE VIRTUELLE</span></div>
          <div class="label">CARTE NETFLIX · 1 MOIS</div>
          <div class="num">•••• •••• 4821</div>
        </div>
        <div class="timer">S'éteint dans 29 j<span>puis le solde vous revient</span></div>
      </div>
      <div class="chips"><span class="chip">Plafond 5 000 FCFA</span><span class="chip">Netflix uniquement</span><span class="chip">1 paiement</span></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <p class="kicker">Le problème</p>
    <h2>Payer en ligne depuis le Togo, c'est encore compliqué.</h2>
    <div class="grid3">
      <div class="box"><div class="icon">1</div><h3>Pas de carte, pas d'achat</h3>
        <p class="muted">Beaucoup de services en ligne n'acceptent que la carte bancaire. Sans compte en banque,
        impossible de payer un abonnement, un outil ou une publicité.</p></div>
      <div class="box"><div class="icon">2</div><h3>Des prélèvements qui ne s'arrêtent pas</h3>
        <p class="muted">Un essai gratuit oublié, un abonnement difficile à résilier : le marchand continue de prélever
        tant que la carte existe.</p></div>
      <div class="box"><div class="icon">3</div><h3>La peur de la fraude</h3>
        <p class="muted">Donner sa carte principale à un site inconnu, c'est exposer tout son solde si le numéro fuite.</p></div>
    </div>
  </div>
</section>

<section id="comment">
  <div class="wrap">
    <p class="kicker">Comment ça marche</p>
    <h2>Une carte par usage. Elle disparaît après.</h2>
    <p class="muted">Quatre étapes, moins d'une minute.</p>
    <div class="grid4">
      <div class="box"><div class="step-n">ÉTAPE 1</div><h3>Créez la carte</h3>
        <p class="muted">Choisissez le montant maximum, le marchand (Canva, Netflix, Facebook…) et la durée.</p></div>
      <div class="box"><div class="step-n">ÉTAPE 2</div><h3>Rechargez par Mobile Money</h3>
        <p class="muted">Mixx by Yas ou Flooz, juste du montant prévu. Vous validez sur votre téléphone, chez votre opérateur.</p></div>
      <div class="box"><div class="step-n">ÉTAPE 3</div><h3>Payez en ligne</h3>
        <p class="muted">Utilisez le numéro de la carte chez le marchand. Tout paiement hors de vos règles est bloqué.</p></div>
      <div class="box"><div class="step-n">ÉTAPE 4</div><h3>Elle s'éteint toute seule</h3>
        <p class="muted">À la fin de la durée ou après le dernier paiement autorisé. Le solde non dépensé vous est remboursé.</p></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap show">
    <div class="phones">
      <div class="phone"><img src="${SCREEN_AMOUNT}" width="420" height="840" alt="Écran Mesura : choisir combien la carte peut dépenser, par exemple 15 000 FCFA"></div>
      <div class="phone"><img src="${SCREEN_DETAILS}" width="420" height="840" alt="Écran Mesura : détails d'une carte Canva avec plafond, marchand, nombre de paiements et expiration"></div>
    </div>
    <div>
      <p class="kicker">Vos règles</p>
      <h2>Vous décidez. La carte obéit.</h2>
      <ul class="check">
        <li><strong>Combien</strong> : un plafond que la carte ne peut pas dépasser.</li>
        <li><strong>Où</strong> : réservée à un seul marchand, ou utilisable partout.</li>
        <li><strong>Combien de fois</strong> : 1 paiement, 5 paiements, ou jusqu'à la fin.</li>
        <li><strong>Combien de temps</strong> : de 30 minutes à 30 jours, puis elle s'éteint.</li>
        <li><strong>Et à tout moment</strong> : gelez la carte, durcissez ses règles ou clôturez-la en un geste.</li>
      </ul>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <p class="kicker">Pour quoi faire ?</p>
    <h2>Pensée pour vos paiements de tous les jours.</h2>
    <div class="uses">
      <div class="use"><b>Un mois de Netflix</b><span>Une carte de 30 jours. Le mois suivant, vous en créez une nouvelle.</span></div>
      <div class="use"><b>Une campagne Facebook</b><span>Un budget pub plafonné, impossible à dépasser.</span></div>
      <div class="use"><b>Canva ou ChatGPT</b><span>Un outil pour un projet, sans abonnement qui traîne.</span></div>
      <div class="use"><b>Un achat en ligne</b><span>Une carte « 1 paiement » qui se ferme juste après.</span></div>
    </div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <p class="kicker">Sécurité</p>
    <h2>Conçue pour ne jamais exposer plus que nécessaire.</h2>
    <div class="grid3">
      <div class="box"><h3>Votre PIN reste chez vous</h3>
        <p class="muted">Vous validez chaque recharge sur votre téléphone, auprès de votre opérateur. Mesura ne vous
        demande jamais votre code PIN.</p></div>
      <div class="box"><h3>Numéro affiché 30 secondes</h3>
        <p class="muted">Le numéro, la date et le CVV s'affichent seulement après votre empreinte, votre visage ou votre code,
        puis disparaissent de l'écran.</p></div>
      <div class="box"><h3>Aucune publicité, aucun pistage</h3>
        <p class="muted">Vos données ne sont ni vendues ni utilisées pour de la publicité. Vous pouvez supprimer votre compte
        à tout moment.</p></div>
    </div>
  </div>
</section>

<section id="faq">
  <div class="wrap" style="max-width: 760px">
    <p class="kicker">Questions fréquentes</p>
    <h2>Ce que vous voulez savoir.</h2>
    <details><summary>Est-ce que je peux déjà payer avec Mesura ?</summary>
      <p>Pas encore. Mesura est en <strong>version de démonstration</strong> : les recharges passent par un mode test (rien
      n'est débité) et les cartes ne fonctionnent pas encore chez les marchands. Nous préparons l'émission de vraies cartes
      avec un partenaire agréé. Inscrivez-vous pour être prévenu.</p></details>
    <details><summary>Que veut dire « carte éphémère » ?</summary>
      <p>Chaque carte a une durée de vie que vous choisissez (de 30 minutes à 30 jours). À la fin, ou après son dernier
      paiement autorisé, elle s'éteint : plus personne ne peut l'utiliser, et le solde non dépensé vous est remboursé
      sur Mobile Money.</p></details>
    <details><summary>Et pour un abonnement comme Netflix ou Spotify ?</summary>
      <p>Créez une carte de 30 jours avec le montant de l'abonnement. Le mois suivant, vous créez une nouvelle carte et la
      renseignez chez le service. C'est volontaire : un abonnement oublié ne peut plus vous prélever.</p></details>
    <details><summary>Faut-il un compte bancaire ?</summary>
      <p>Non. Un compte Mixx by Yas ou Flooz suffit pour recharger vos cartes.</p></details>
    <details><summary>Combien ça coûte ?</summary>
      <p>Le prix n'est pas encore fixé : la version de test est gratuite. Votre avis de testeur nous aide justement à le
      définir.</p></details>
    <details><summary>Et sur iPhone ?</summary>
      <p>La version de test est disponible sur Android. L'iPhone viendra ensuite : inscrivez-vous sur la liste d'attente.</p></details>
  </div>
</section>

<section style="padding-top: 0">
  <div class="wrap">
    <div class="final">
      <h2>Aidez-nous à construire Mesura.</h2>
      <p>Nous cherchons nos premiers testeurs au Togo. Installez la démo, testez pendant deux semaines et dites-nous ce qui
      vous ferait l'utiliser chaque mois.</p>
      <div class="ctas">
        <a class="btn primary" href="/testeurs">Devenir testeur</a>
        <a class="btn ghost" href="/liste-attente">Rejoindre la liste d'attente</a>
      </div>
    </div>
  </div>
</section>
</main>

<footer>
  <div class="wrap">
    <span>© 2026 ${who} · Togo${contact ? ` · ${contact}` : ''}</span>
    <span><a href="/legal/privacy">Confidentialité</a> · <a href="/legal/terms">Conditions d'utilisation</a> ·
    <a href="/legal/delete-account">Supprimer un compte</a></span>
  </div>
</footer>
</body>
</html>`;
}
