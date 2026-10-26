import { escape, page } from '../legal/legal.pages';

export interface SignupRow {
  name: string;
  phone: string;
  services: string[];
  gmail: string | null;
  tester: boolean;
  createdAt: Date;
}

export interface FeedbackRow {
  name: string | null;
  contact: string | null;
  rating: number | null;
  message: string;
  createdAt: Date;
}

export interface AdminView {
  signups: SignupRow[];
  feedback: FeedbackRow[];
  /** Search typed in the page's filter box (name, number, Gmail or feedback text). */
  query?: string;
  /** Public base URL of the pages (https://…), used in the WhatsApp messages. */
  baseUrl: string;
  now?: Date;
}

/** Google Play asks a new personal developer account for at least 12 testers during 14 days. */
export const PLAY_TESTERS_GOAL = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const TZ = 'Africa/Lome';

const date = (d: Date) =>
  d.toLocaleString('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dayKey = (d: Date) => d.toLocaleDateString('fr-CA', { timeZone: TZ });
const dayLabel = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: TZ, day: '2-digit', month: '2-digit' });

const waUrl = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace('+', '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

const matches = (query: string, ...fields: (string | null)[]) =>
  fields.some((f) => f?.toLowerCase().includes(query));

/** +22890123456 → +228 90 12 34 56 */
const formatPhone = (phone: string) => phone.replace(/^\+228(\d{2})(\d{2})(\d{2})(\d{2})$/, '+228 $1 $2 $3 $4');

const stars = (n: number) => `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;

const STYLE = `<style>
  main { max-width: 860px; }
  .top { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }
  .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 8px; }
  .tabs a { background: var(--card); border-radius: 999px; padding: 6px 14px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 18px; }
  .tile { background: var(--card); border-radius: 14px; padding: 14px 16px; }
  .tile b { display: block; font-size: 28px; line-height: 1.1; }
  .tile span { color: var(--muted); font-size: 14px; }
  .bar { height: 8px; border-radius: 99px; background: color-mix(in srgb, var(--muted) 25%, transparent); margin-top: 10px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
  .chart { display: flex; align-items: flex-end; gap: 4px; height: 90px; background: var(--card); border-radius: 14px; padding: 12px 12px 26px; position: relative; }
  .chart div { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; position: relative; }
  .chart i { display: block; width: 100%; max-width: 26px; background: var(--accent); border-radius: 4px 4px 0 0; min-height: 2px; }
  .chart em { position: absolute; bottom: -20px; font-size: 10px; font-style: normal; color: var(--muted); white-space: nowrap; }
  .chart small { font-size: 11px; font-weight: 700; margin-bottom: 2px; }
  .search { display: flex; gap: 8px; margin-top: 18px; background: none; padding: 0; }
  .search input { flex: 1; min-width: 0; box-sizing: border-box; padding: 10px 12px; font: inherit; color: var(--fg); background: var(--card); border: 1px solid var(--muted); border-radius: 10px; }
  form.search .btn { padding: 10px 16px; width: auto; margin-top: 0; }
  .person { background: var(--card); border-radius: 14px; padding: 14px 16px; margin-bottom: 10px; }
  .person .head { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .person .meta { color: var(--muted); font-size: 14px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .chipbtn { display: inline-block; border: 1px solid var(--accent); color: var(--accent); border-radius: 999px; padding: 5px 12px;
    font-size: 14px; font-weight: 600; text-decoration: none; }
  .tag { display: inline-block; background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); border-radius: 6px;
    padding: 1px 8px; font-size: 12px; font-weight: 700; margin: 4px 4px 0 0; }
  .svc { display: grid; grid-template-columns: 170px 1fr 48px; gap: 10px; align-items: center; margin-bottom: 8px; font-size: 15px; }
  textarea { box-sizing: border-box; width: 100%; padding: 10px 12px; font: inherit; color: var(--fg); background: var(--card);
    border: 1px solid var(--muted); border-radius: 10px; }
  .empty { color: var(--muted); background: var(--card); border-radius: 14px; padding: 14px 16px; }
  @media (max-width: 640px) { .tiles { grid-template-columns: repeat(2, 1fr); } .svc { grid-template-columns: 120px 1fr 40px; } }
</style>`;

/** Private overview of sign-ups and feedback, for the publisher (behind ADMIN_PASSWORD). No JavaScript (CSP). */
export function adminPage(view: AdminView): string {
  const now = view.now ?? new Date();
  const query = (view.query ?? '').trim().toLowerCase().slice(0, 60);
  const allTesters = view.signups.filter((s) => s.tester);
  const allWaitlist = view.signups.filter((s) => !s.tester);
  const gmails = allTesters.map((t) => t.gmail).filter((g): g is string => !!g);

  const testers = query ? allTesters.filter((s) => matches(query, s.name, s.phone, s.gmail)) : allTesters;
  const waitlist = query ? allWaitlist.filter((s) => matches(query, s.name, s.phone)) : allWaitlist;
  const feedback = query
    ? view.feedback.filter((f) => matches(query, f.name, f.contact, f.message))
    : view.feedback;

  const rated = view.feedback.filter((f) => f.rating !== null);
  const average = rated.length ? rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length : null;
  const lastWeek = view.signups.filter((s) => now.getTime() - s.createdAt.getTime() < 7 * DAY_MS).length;
  const goal = Math.min(100, Math.round((allTesters.length / PLAY_TESTERS_GOAL) * 100));

  // Sign-ups per day over the last 14 days (Lomé time).
  const days = Array.from({ length: 14 }, (_, i) => new Date(now.getTime() - (13 - i) * DAY_MS));
  const perDay = new Map<string, number>();
  for (const s of view.signups) perDay.set(dayKey(s.createdAt), (perDay.get(dayKey(s.createdAt)) ?? 0) + 1);
  const peak = Math.max(1, ...days.map((d) => perDay.get(dayKey(d)) ?? 0));

  const counts = new Map<string, number>();
  for (const s of view.signups) for (const sv of s.services) counts.set(sv, (counts.get(sv) ?? 0) + 1);
  const services = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const testersUrl = `${view.baseUrl}/testeurs`;
  const thankTester = (s: SignupRow) =>
    `Bonjour ${s.name}, merci de t'être inscrit comme testeur de Mesura 🙏 Je t'envoie l'invitation Google Play dès que le test est ouvert. En attendant, tu peux installer la démo ici : ${testersUrl}`;
  const inviteWaitlist = (s: SignupRow) =>
    `Bonjour ${s.name}, merci de t'être inscrit sur la liste d'attente de Mesura 🙏 Tu veux essayer la version de démonstration et nous donner ton avis ? Inscris-toi comme testeur ici (2 min) : ${testersUrl}`;

  const person = (s: SignupRow, message: string, cta: string) => `<div class="person">
  <div class="head"><strong>${escape(s.name)}</strong><span class="meta">${date(s.createdAt)}</span></div>
  <div class="meta">${escape(formatPhone(s.phone))}${s.gmail ? ` · ${escape(s.gmail)}` : ''}</div>
  ${s.services.length ? `<div>${s.services.map((sv) => `<span class="tag">${escape(sv)}</span>`).join('')}</div>` : ''}
  <div class="actions"><a class="chipbtn" href="${waUrl(s.phone, message)}">${cta}</a><a class="chipbtn" href="${waUrl(s.phone)}">Ouvrir WhatsApp</a></div>
</div>`;

  const list = (rows: string[], empty: string) => (rows.length ? rows.join('\n') : `<p class="empty">${empty}</p>`);
  const noMatch = query ? 'Aucun résultat pour cette recherche.' : '';

  return page(
    'Administration',
    `${STYLE}
<div class="top"><h1>Inscriptions</h1><a class="btn" href="/admin/inscriptions.csv">Télécharger (Excel / CSV)</a></div>
<p class="muted">Page privée · mise à jour à chaque ouverture · heure de Lomé</p>

<div class="tiles">
  <div class="tile"><b>${allTesters.length}<span> / ${PLAY_TESTERS_GOAL}</span></b><span>testeurs (objectif Google Play)</span>
    <div class="bar"><i style="width:${goal}%"></i></div></div>
  <div class="tile"><b>${allWaitlist.length}</b><span>sur la liste d'attente</span></div>
  <div class="tile"><b>${lastWeek}</b><span>inscriptions sur 7 jours</span></div>
  <div class="tile"><b>${average === null ? '—' : average.toFixed(1).replace('.', ',')}</b><span>note moyenne (${view.feedback.length} avis)</span></div>
</div>

<h2>Inscriptions par jour (14 derniers jours)</h2>
<div class="chart" role="img" aria-label="Inscriptions par jour sur les 14 derniers jours">
${days
  .map((d) => {
    const n = perDay.get(dayKey(d)) ?? 0;
    return `<div><small>${n || ''}</small><i style="height:${Math.round((n / peak) * 100)}%"></i><em>${dayLabel(d).slice(0, 2)}</em></div>`;
  })
  .join('\n')}
</div>

<form class="search" method="get" action="/admin/inscriptions">
  <input type="search" name="q" value="${escape(view.query ?? '')}" placeholder="Rechercher un nom, un numéro, un Gmail…" aria-label="Rechercher">
  <button class="btn" type="submit">Rechercher</button>
</form>
${query ? `<p class="muted">Résultats pour « ${escape(view.query ?? '')} » · <a href="/admin/inscriptions">tout afficher</a></p>` : ''}

<nav class="tabs"><a href="#testeurs">Testeurs (${testers.length})</a><a href="#gmail">Adresses Gmail</a>
<a href="#avis">Avis (${feedback.length})</a><a href="#attente">Liste d'attente (${waitlist.length})</a><a href="#services">Services</a></nav>

<h2 id="gmail">Adresses Gmail des testeurs (${gmails.length})</h2>
<p class="muted">À copier dans la Play Console : Tests → Test fermé → Testeurs → liste d'adresses e-mail.
Appuyez longuement dans le cadre puis « Tout sélectionner » et « Copier ».</p>
<textarea rows="4" readonly>${gmails.map(escape).join(', ')}</textarea>

<h2 id="testeurs">Testeurs (${testers.length})</h2>
${list(
  testers.map((s) => person(s, thankTester(s), 'Remercier sur WhatsApp')),
  noMatch || 'Aucun testeur pour l’instant. Partagez la page /testeurs.',
)}

<h2 id="avis">Avis (${feedback.length})</h2>
${list(
  feedback.map(
    (f) => `<div class="person">
  <div class="head"><strong>${f.rating ? stars(f.rating) : 'Sans note'}</strong><span class="meta">${date(f.createdAt)}</span></div>
  <p>${escape(f.message)}</p>
  ${f.name || f.contact ? `<div class="meta">${[f.name, f.contact].filter(Boolean).map((v) => escape(v as string)).join(' · ')}</div>` : ''}
</div>`,
  ),
  noMatch || 'Aucun avis pour l’instant.',
)}

<h2 id="attente">Liste d'attente (${waitlist.length})</h2>
${list(
  waitlist.map((s) => person(s, inviteWaitlist(s), 'Proposer de tester')),
  noMatch || 'Aucune inscription pour l’instant. Partagez la page /liste-attente.',
)}

<h2 id="services">Services cités</h2>
${
  services.length
    ? services
        .map(
          ([s, n]) =>
            `<div class="svc"><span>${escape(s)}</span><div class="bar" style="margin:0"><i style="width:${Math.round(
              (n / view.signups.length) * 100,
            )}%"></i></div><b>${n}</b></div>`,
        )
        .join('\n')
    : '<p class="empty">—</p>'
}`,
  );
}

/**
 * Neutralizes values a spreadsheet would run as a formula: anything starting with = @ tab or CR, or with
 * + / - followed by something other than digits and spaces (a phone number such as +228 90 … stays as is).
 */
const csvCell = (v: string) => {
  const safe = /^[=@\t\r]/.test(v) || /^[+-](?![\d ]+$)/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** All sign-ups and feedback as one CSV (semicolon-separated, UTF-8 with BOM so Excel shows accents). */
export function adminCsv(signups: SignupRow[], feedback: FeedbackRow[]): string {
  const rows: string[][] = [['Type', 'Date', 'Prénom', 'WhatsApp', 'Gmail', 'Services', 'Note', 'Avis', 'Contact']];
  for (const s of signups) {
    rows.push([s.tester ? 'Testeur' : "Liste d'attente", date(s.createdAt), s.name, formatPhone(s.phone), s.gmail ?? '', s.services.join(', '), '', '', '']);
  }
  for (const f of feedback) {
    rows.push(['Avis', date(f.createdAt), f.name ?? '', '', '', '', f.rating ? String(f.rating) : '', f.message, f.contact ?? '']);
  }
  return `﻿${rows.map((r) => r.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
