import { escape, page } from '../legal/legal.pages';
import { SERVICES } from './community.forms';

/** Latest tester build, republished by .github/workflows/build-mobile-apk.yml on every merge to main. */
export const TESTER_APK_URL = 'https://github.com/job-agen/mesura/releases/download/testeurs/Mesura-testeur.apk';

export interface FormState {
  error?: string;
  values?: Record<string, unknown>;
}

const value = (s: FormState, key: string): string => {
  const v = s.values?.[key];
  return typeof v === 'string' ? escape(v) : '';
};

const checked = (s: FormState, service: string): string => {
  const v = s.values?.services;
  const list = Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
  return list.includes(service) ? ' checked' : '';
};

const errorLine = (s: FormState): string => (s.error ? `<p class="error" role="alert">${escape(s.error)}</p>` : '');

/** Hidden field that only bots fill in. */
const honeypot = `<div class="hp" aria-hidden="true"><label>Site web <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>`;

function signupFields(s: FormState): string {
  return `<label for="name">Prénom</label>
<input type="text" id="name" name="name" maxlength="60" autocomplete="given-name" required value="${value(s, 'name')}">
<label for="phone">Numéro WhatsApp</label>
<input type="tel" id="phone" name="phone" inputmode="tel" placeholder="90 12 34 56" autocomplete="tel" required value="${value(s, 'phone')}">
<label>Ce que vous payez déjà en ligne (ou voudriez payer)</label>
${SERVICES.map((sv) => `<label class="check"><input type="checkbox" name="services" value="${escape(sv)}"${checked(s, sv)}> ${escape(sv)}</label>`).join('\n')}`;
}

const demoNote = `<p class="note"><strong>Version de démonstration.</strong> Aucun argent réel ne circule : les recharges passent par le
mode test de notre prestataire de paiement (rien n'est débité) et les cartes affichées ne permettent pas encore de payer
chez les marchands. Votre avis nous aide à préparer la vraie version.</p>`;

export function testersPage(s: FormState = {}, feedback: FormState = {}): string {
  return page(
    'Devenir testeur',
    `<h1>Devenez testeur de Mesura</h1>
<p class="muted">Des cartes virtuelles que vous contrôlez : un plafond, un marchand, une durée. Rechargées par Mobile Money.</p>
${demoNote}

<h2>1. Inscrivez-vous</h2>
<p>Google Play nous demande au moins 12 testeurs pendant 14 jours avant de publier l'application. Laissez votre adresse
Gmail : nous vous enverrons l'invitation dès que le test sur le Play Store est ouvert. En attendant, vous pouvez déjà
installer la version ci-dessous.</p>
<form method="post" action="/testeurs" id="inscription">
${errorLine(s)}
${signupFields(s)}
<label for="gmail">Adresse Gmail (celle de votre téléphone)</label>
<input type="text" id="gmail" name="gmail" inputmode="email" autocomplete="email" placeholder="prenom.nom@gmail.com" required value="${value(s, 'gmail')}">
${honeypot}
<button class="btn" type="submit">Je deviens testeur</button>
</form>

<h2>2. Installez l'application (Android)</h2>
<p><a class="btn" href="${TESTER_APK_URL}">Télécharger Mesura (APK, ~30 Mo)</a></p>
<ol>
  <li>Ouvrez le fichier téléchargé (notification ou dossier « Téléchargements »).</li>
  <li>Si Android bloque l'installation, touchez <strong>Paramètres</strong> puis activez
  <strong>« Autoriser cette source »</strong> pour votre navigateur, et revenez en arrière.</li>
  <li>Si Play Protect affiche un avertissement (l'application ne vient pas encore du Play Store), touchez
  <strong>« Plus de détails »</strong> puis <strong>« Installer quand même »</strong>.</li>
  <li>Ouvrez Mesura et créez un compte. Pour un premier tour rapide, vous pouvez aussi utiliser le compte de démonstration
  <strong>demo@mesura.test</strong> / <strong>demo1234</strong>.</li>
</ol>
<p class="muted">iPhone : pas encore disponible. Inscrivez-vous quand même, nous vous préviendrons.</p>

<h2>3. Ce que nous aimerions que vous testiez</h2>
<ol>
  <li>Créer un compte et vérifier votre identité (simulée : rien n'est transmis).</li>
  <li>Créer une carte pour un service précis, par exemple Netflix, avec un plafond et une durée.</li>
  <li>La recharger avec Mixx by Yas ou Flooz (mode test, approuvé automatiquement, rien n'est débité).</li>
  <li>Afficher le numéro de la carte, puis regarder l'historique des paiements acceptés ou bloqués.</li>
  <li>Fermer la carte et demander le remboursement du solde restant.</li>
</ol>
<p>Dites-nous ce qui est clair, ce qui bloque, et ce qui vous ferait payer pour ce service.</p>

<h2 id="avis">4. Donnez votre avis</h2>
<form method="post" action="/testeurs/avis">
${errorLine(feedback)}
<label for="rating">Votre note</label>
<select id="rating" name="rating">
  <option value="">Choisir…</option>
  ${[5, 4, 3, 2, 1].map((n) => `<option value="${n}"${value(feedback, 'rating') === String(n) ? ' selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n}/5)</option>`).join('\n  ')}
</select>
<label for="message">Votre avis : ce qui marche, ce qui bloque, ce qui manque</label>
<textarea id="message" name="message" rows="6" maxlength="2000" required>${value(feedback, 'message')}</textarea>
<label for="fb-name">Prénom (facultatif)</label>
<input type="text" id="fb-name" name="name" maxlength="60" value="${value(feedback, 'name')}">
<label for="contact">WhatsApp ou e-mail, si vous voulez une réponse (facultatif)</label>
<input type="text" id="contact" name="contact" maxlength="100" value="${value(feedback, 'contact')}">
${honeypot}
<button class="btn" type="submit">Envoyer mon avis</button>
</form>

<p class="muted">Vos réponses servent uniquement à organiser le test et à améliorer Mesura :
<a href="/legal/privacy">politique de confidentialité</a>.</p>`,
  );
}

export function waitlistPage(s: FormState = {}): string {
  return page(
    "Liste d'attente",
    `<h1>Payez en ligne sans exposer votre argent</h1>
<p>Mesura crée des <strong>cartes virtuelles à usage contrôlé</strong> : une carte pour Netflix, une autre pour vos
publicités Facebook, chacune avec son plafond et sa durée. Vous la rechargez avec Mixx by Yas ou Flooz, juste du montant
nécessaire. Si un marchand tente de prélever plus que prévu, ou si la carte est utilisée chez un autre marchand, le paiement est bloqué.</p>
<ul>
  <li>Pas de compte bancaire nécessaire.</li>
  <li>Le solde non dépensé vous est remboursé sur Mobile Money.</li>
  <li>Une carte par usage : un abonnement oublié ne peut plus vous prélever.</li>
</ul>
<p class="note">Mesura est en préparation au Togo et n'émet pas encore de vraies cartes. Inscrivez-vous : nous vous
écrirons sur WhatsApp au lancement. Aucun paiement n'est demandé.</p>

<h2>Être prévenu au lancement</h2>
<form method="post" action="/liste-attente">
${errorLine(s)}
${signupFields(s)}
${honeypot}
<button class="btn" type="submit">M'inscrire</button>
</form>
<p>Vous voulez essayer la version de démonstration dès maintenant ? <a href="/testeurs">Devenez testeur</a>.</p>
<p class="muted">Nous utilisons votre prénom et votre numéro uniquement pour vous prévenir du lancement :
<a href="/legal/privacy">politique de confidentialité</a>.</p>`,
  );
}

export function thanksPage(kind: 'tester' | 'waitlist' | 'feedback'): string {
  const body = {
    tester: `<h1>Merci, vous êtes inscrit comme testeur !</h1>
<p>Nous vous enverrons l'invitation Google Play sur votre adresse Gmail dès que le test est ouvert. En attendant, installez
la version de démonstration :</p>
<p><a class="btn" href="${TESTER_APK_URL}">Télécharger Mesura (APK)</a></p>
<p><a href="/testeurs">Revenir aux instructions d'installation et de test</a></p>`,
    waitlist: `<h1>Merci, vous êtes sur la liste !</h1>
<p>Nous vous écrirons sur WhatsApp au lancement de Mesura.</p>
<p>Envie d'aider à le construire ? <a href="/testeurs">Devenez testeur</a>.</p>`,
    feedback: `<h1>Merci pour votre avis !</h1>
<p>Chaque retour est lu. N'hésitez pas à en envoyer un autre après avoir testé une nouvelle fonction.</p>
<p><a href="/testeurs">Revenir à la page des testeurs</a></p>`,
  }[kind];
  return page('Merci', body);
}
