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

const date = (d: Date) =>
  d.toLocaleString('fr-FR', { timeZone: 'Africa/Lome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const waLink = (phone: string) => `<a href="https://wa.me/${phone.replace('+', '')}">${escape(phone)}</a>`;

/** Private overview of sign-ups and feedback, for the publisher (behind ADMIN_PASSWORD). */
export function adminPage(signups: SignupRow[], feedback: FeedbackRow[]): string {
  const testers = signups.filter((s) => s.tester);
  const waitlist = signups.filter((s) => !s.tester);
  const gmails = testers.map((t) => t.gmail).filter((g): g is string => !!g);
  const counts = new Map<string, number>();
  for (const s of signups) for (const sv of s.services) counts.set(sv, (counts.get(sv) ?? 0) + 1);
  const services = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const person = (s: SignupRow) => `<li><strong>${escape(s.name)}</strong> · ${waLink(s.phone)}${
    s.gmail ? ` · ${escape(s.gmail)}` : ''
  }<br><span class="muted">${date(s.createdAt)}${s.services.length ? ` · ${s.services.map(escape).join(', ')}` : ''}</span></li>`;

  return page(
    'Administration',
    `<h1>Inscriptions</h1>
<p class="muted">Page privée. ${testers.length} testeur(s), ${waitlist.length} sur la liste d'attente, ${feedback.length} avis.</p>

<h2>Adresses Gmail des testeurs (${gmails.length})</h2>
<p class="muted">À copier dans la Play Console : Tests → Test fermé → Testeurs → liste d'adresses e-mail.</p>
<textarea rows="4" readonly>${gmails.map(escape).join(', ')}</textarea>

<h2>Testeurs (${testers.length})</h2>
${testers.length ? `<ul>${testers.map(person).join('\n')}</ul>` : '<p class="muted">Aucun pour l’instant.</p>'}

<h2>Avis (${feedback.length})</h2>
${
  feedback.length
    ? `<ul>${feedback
        .map(
          (f) => `<li>${f.rating ? `${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)} ` : ''}${escape(f.message)}<br><span class="muted">${date(
            f.createdAt,
          )}${f.name ? ` · ${escape(f.name)}` : ''}${f.contact ? ` · ${escape(f.contact)}` : ''}</span></li>`,
        )
        .join('\n')}</ul>`
    : '<p class="muted">Aucun pour l’instant.</p>'
}

<h2>Liste d'attente (${waitlist.length})</h2>
${waitlist.length ? `<ul>${waitlist.map(person).join('\n')}</ul>` : '<p class="muted">Aucune inscription pour l’instant.</p>'}

<h2>Services cités</h2>
${services.length ? `<ul>${services.map(([s, n]) => `<li>${escape(s)} : ${n}</li>`).join('')}</ul>` : '<p class="muted">—</p>'}`,
  );
}
