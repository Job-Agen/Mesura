export interface LegalContact {
  /** Legal name of the publisher; empty until configured (LEGAL_PUBLISHER). */
  publisher: string;
  /** Support address; empty until configured (SUPPORT_EMAIL). */
  email: string;
  sandbox: boolean;
}

const UPDATED = '15 octobre 2026';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} — Mesura</title>
<style>
  :root { color-scheme: light dark; --fg: #101815; --muted: #66736D; --bg: #F5F7F5; --card: #fff; --accent: #005C47; }
  @media (prefers-color-scheme: dark) { :root { --fg: #E8EEEA; --muted: #9AA8A1; --bg: #0E1512; --card: #16201C; --accent: #4FD1A5; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 28px; line-height: 1.2; margin: 0 0 4px; }
  h2 { font-size: 19px; margin: 32px 0 8px; }
  p, li { color: var(--fg); }
  .muted { color: var(--muted); font-size: 14px; }
  .note { background: var(--card); border-left: 4px solid var(--accent); padding: 12px 16px; border-radius: 8px; }
  a { color: var(--accent); }
  ul { padding-left: 20px; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

function contactLine(c: LegalContact): string {
  const who = c.publisher ? escape(c.publisher) : "l'éditeur de Mesura";
  return c.email
    ? `${who}, joignable à l'adresse <a href="mailto:${escape(c.email)}">${escape(c.email)}</a>`
    : `${who}, via l'application (Profil)`;
}

function sandboxNote(c: LegalContact): string {
  return c.sandbox
    ? `<p class="note">Mesura est actuellement une <strong>version de démonstration (sandbox)</strong> : aucun argent réel ne circule,
aucune vraie carte bancaire n'est émise, les recharges passent par le <strong>mode test</strong> de notre prestataire de paiement
FedaPay (aucun montant n'est débité) et aucune vérification d'identité n'est transmise à un prestataire.</p>`
    : '';
}

export function privacyPolicyPage(c: LegalContact): string {
  return page(
    'Politique de confidentialité',
    `<h1>Politique de confidentialité</h1>
<p class="muted">Dernière mise à jour : ${UPDATED}</p>
${sandboxNote(c)}

<h2>Qui est responsable de vos données ?</h2>
<p>Les données sont traitées par ${contactLine(c)}.</p>

<h2>Quelles données collectons-nous ?</h2>
<ul>
  <li><strong>Compte</strong> : prénom, adresse e-mail, mot de passe (stocké uniquement sous forme chiffrée irréversible).</li>
  <li><strong>Identité</strong> : prénom, nom, date de naissance, pays et numéro de mobile, saisis lors de la vérification d'identité.</li>
  <li><strong>Cartes</strong> : les règles que vous fixez (plafond, marchand, nombre de paiements, durée) et l'état de chaque carte.</li>
  <li><strong>Recharges</strong> : opérateur Mobile Money choisi, numéro de téléphone utilisé et montants.</li>
  <li><strong>Paiements</strong> : marchand, montant, date, résultat (accepté ou bloqué) et motif d'un éventuel blocage.</li>
</ul>
<p>Mesura ne demande jamais votre code PIN Mobile Money : vous le saisissez uniquement sur votre téléphone, chez votre opérateur.
Le numéro complet, la date d'expiration et le CVV de vos cartes ne sont jamais enregistrés par Mesura : ils sont affichés à
votre demande, après vérification sur votre téléphone, puis effacés de l'écran.
L'application n'utilise ni publicité, ni outil de suivi publicitaire, ni service d'analyse d'audience tiers.</p>

<h2>Pourquoi ?</h2>
<ul>
  <li>Créer et sécuriser votre compte, et vous connecter.</li>
  <li>Vérifier que vous avez l'âge requis avant de créer une carte.</li>
  <li>Appliquer les règles de vos cartes à chaque paiement et vous montrer votre historique.</li>
  <li>Prévenir les abus (par exemple en limitant le nombre de tentatives, ou en n'autorisant qu'un compte par identité).</li>
</ul>
<p>Vos données ne sont ni vendues ni utilisées à des fins publicitaires.</p>

<h2>Avec qui sont-elles partagées ?</h2>
<p>Uniquement avec les prestataires nécessaires au service, qui les traitent pour notre compte :</p>
<ul>
  <li><strong>FedaPay</strong> (agrégateur de paiement Mobile Money, Bénin) : pour chaque recharge, votre prénom, nom, adresse
  e-mail, numéro de téléphone et le montant, afin d'envoyer la demande de paiement à votre opérateur
  (<a href="https://fedapay.com">fedapay.com</a>).</li>
  <li><strong>Vercel</strong> et <strong>Neon</strong> : hébergement de l'application et de la base de données.</li>
</ul>
<p>Aucune autre entreprise ne reçoit vos données.</p>

<h2>Où sont-elles stockées ?</h2>
<p>Sur des serveurs situés dans l'Union européenne (Francfort, Allemagne), chez nos hébergeurs Vercel (application) et Neon
(base de données). Les échanges entre l'application et nos serveurs sont chiffrés (HTTPS). Sur votre téléphone, votre jeton
de connexion est conservé dans le stockage sécurisé du système.</p>

<h2>Combien de temps ?</h2>
<p>Tant que votre compte existe. Lorsque vous supprimez votre compte, toutes les données listées ci-dessus sont effacées
immédiatement et définitivement de notre base.</p>
<p>Une seule exception, pour éviter qu'un compte soit supprimé puis recréé pour contourner les limites (une identité par
compte, cartes gratuites) : nous conservons une <strong>empreinte chiffrée irréversible</strong> de votre identité vérifiée
et de votre numéro Mobile Money, avec le nombre de cartes gratuites déjà utilisées. Cette empreinte ne permet pas de
retrouver votre nom, votre date de naissance ni votre numéro ; elle sert uniquement à reconnaître une même personne.</p>

<h2>Vos droits</h2>
<p>Vous pouvez consulter vos informations dans l'application, et demander leur rectification ou leur suppression.
Vous pouvez supprimer vous-même votre compte à tout moment : voir
<a href="/legal/delete-account">Supprimer votre compte Mesura</a>. Pour toute autre demande, contactez ${contactLine(c)}.</p>

<h2>Mineurs</h2>
<p>Mesura est réservé aux personnes de 18 ans ou plus.</p>

<h2>Modifications</h2>
<p>Nous mettrons cette page à jour si nos pratiques changent, en indiquant la date de mise à jour en haut de la page.</p>`,
  );
}

export function deleteAccountPage(c: LegalContact): string {
  return page(
    'Supprimer votre compte',
    `<h1>Supprimer votre compte Mesura</h1>
<p class="muted">Application Mesura — dernière mise à jour : ${UPDATED}</p>
${sandboxNote(c)}

<h2>Depuis l'application</h2>
<ol>
  <li>Ouvrez Mesura et connectez-vous.</li>
  <li>Allez dans l'onglet <strong>Profil</strong>.</li>
  <li>Touchez <strong>Supprimer mon compte</strong>.</li>
  <li>Confirmez avec votre mot de passe, puis touchez <strong>Supprimer définitivement</strong>.</li>
</ol>

<h2>Sans l'application</h2>
<p>Si vous ne pouvez plus utiliser l'application, demandez la suppression à ${contactLine(c)}, en écrivant depuis
l'adresse e-mail de votre compte. La suppression est effectuée sous 30 jours.</p>

<h2>Ce qui est supprimé</h2>
<p>Immédiatement et définitivement : votre compte (prénom, e-mail, mot de passe), vos informations d'identité, toutes vos
cartes et leurs règles, vos recharges et votre historique de paiements. Les cartes actives cessent de fonctionner.</p>
<h2>Ce qui est conservé</h2>
<p>Uniquement une empreinte chiffrée irréversible de votre identité vérifiée et de votre numéro Mobile Money, avec le
nombre de cartes gratuites déjà utilisées. Elle ne permet pas de retrouver ces informations ; elle empêche seulement de
recréer un compte pour contourner les limites (une identité par compte, cartes gratuites).</p>`,
  );
}

export function termsPage(c: LegalContact): string {
  return page(
    "Conditions d'utilisation",
    `<h1>Conditions d'utilisation</h1>
<p class="muted">Dernière mise à jour : ${UPDATED}</p>
${sandboxNote(c)}

<h2>1. Objet</h2>
<p>Mesura permet de créer des cartes virtuelles dont vous fixez les règles : montant maximum, marchand autorisé,
nombre de paiements et durée de validité. Le service est édité par ${contactLine(c)}.</p>

<h2>2. Accès au service</h2>
<p>Le service est réservé aux personnes âgées de 18 ans ou plus. Une personne ne peut avoir qu'un seul compte Mesura actif.
Vous vous engagez à fournir des informations exactes,
notamment lors de la vérification d'identité, et à garder votre mot de passe confidentiel. Vous êtes responsable des
actions effectuées depuis votre compte.</p>

<h2>3. Fonctionnement des cartes</h2>
<p>Chaque carte n'accepte que les paiements qui respectent ses règles. Un paiement qui ne les respecte pas est refusé.
Une fois rechargée, vous pouvez durcir les règles d'une carte, la geler ou la clôturer, mais pas assouplir ses règles.
Une carte se désactive automatiquement à la fin de sa durée ou après son dernier paiement autorisé.</p>

<h2>4. Recharges et frais</h2>
<p>Les cartes se rechargent par Mobile Money. Les frais de service sont affichés avant chaque paiement ; en version de
démonstration, ils sont indicatifs et rien n'est débité. Mesura ne vous demande jamais votre code PIN Mobile Money.</p>

<h2>5. Utilisation interdite</h2>
<p>Il est interdit d'utiliser Mesura pour une activité illégale, frauduleuse ou pour contourner les mesures de sécurité
du service, ainsi que de tenter d'accéder aux comptes d'autres personnes.</p>

<h2>6. Disponibilité et responsabilité</h2>
<p>Nous faisons notre possible pour que le service soit disponible et fiable, sans pouvoir le garantir en permanence.
${c.sandbox ? 'En version de démonstration, le service est fourni « en l\'état », sans valeur financière.' : ''}</p>

<h2>7. Données personnelles</h2>
<p>Le traitement de vos données est décrit dans la <a href="/legal/privacy">politique de confidentialité</a>.</p>

<h2>8. Durée et résiliation</h2>
<p>Vous pouvez supprimer votre compte à tout moment depuis l'application
(<a href="/legal/delete-account">comment faire</a>). Nous pouvons suspendre un compte en cas de non-respect des présentes
conditions.</p>

<h2>9. Modifications</h2>
<p>Ces conditions peuvent évoluer. La date de mise à jour figure en haut de la page ; en cas de changement important,
nous vous en informerons dans l'application.</p>

<h2>10. Contact</h2>
<p>Pour toute question : ${contactLine(c)}.</p>`,
  );
}
