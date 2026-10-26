import { isAdmin } from './admin.controller';
import { adminCsv, adminPage, type FeedbackRow, type SignupRow } from './admin.pages';

const basic = (s: string) => `Basic ${Buffer.from(s).toString('base64')}`;

describe('admin page', () => {
  const pw = 'a-long-admin-password';

  it('accepts only admin + the configured password', () => {
    expect(isAdmin(basic(`admin:${pw}`), pw)).toBe(true);
    expect(isAdmin(basic(`admin:${pw}x`), pw)).toBe(false);
    expect(isAdmin(basic(`root:${pw}`), pw)).toBe(false);
    expect(isAdmin(undefined, pw)).toBe(false);
    expect(isAdmin(`Bearer ${pw}`, pw)).toBe(false);
  });

  it('is closed when no password is configured', () => {
    expect(isAdmin(basic('admin:'), '')).toBe(false);
  });

  const at = new Date('2026-10-22T10:00:00Z');
  const ama: SignupRow = { name: 'Ama', phone: '+22890123456', services: ['Netflix'], gmail: 'ama@gmail.com', tester: true, createdAt: at };
  const signups: SignupRow[] = [
    ama,
    { name: 'Kofi', phone: '+22891000000', services: [], gmail: 'kofi@gmail.com', tester: true, createdAt: at },
    { name: '<b>x</b>', phone: '+22892000000', services: ['Netflix'], gmail: null, tester: false, createdAt: at },
  ];
  const feedback: FeedbackRow[] = [{ name: null, contact: null, rating: 4, message: '<script>bad</script>', createdAt: at }];
  const view = { signups, feedback, baseUrl: 'https://mesura.example', now: new Date('2026-10-23T10:00:00Z') };

  it('lists tester Gmail addresses for the Play Console and escapes user text', () => {
    const html = adminPage(view);
    expect(html).toContain('ama@gmail.com, kofi@gmail.com');
    expect(html).toContain('https://wa.me/22890123456');
    expect(html).not.toContain('<script>bad');
    expect(html).not.toContain('<b>x</b>');
  });

  it('shows progress towards the 12 testers, the average rating and a prefilled WhatsApp invitation', () => {
    const html = adminPage(view);
    expect(html).toContain('2<span> / 12</span>');
    expect(html).toContain('4,0');
    expect(html).toContain(encodeURIComponent('https://mesura.example/testeurs'));
  });

  it('filters by the search query without touching the Gmail list', () => {
    const html = adminPage({ ...view, query: 'kofi' });
    expect(html).toContain('Testeurs (1)');
    expect(html).toContain("Liste d'attente (0)");
    expect(html).toContain('ama@gmail.com, kofi@gmail.com');
  });

  it('exports a CSV that Excel opens with accents and that cannot run formulas', () => {
    const csv = adminCsv([{ ...ama, name: '=HYPERLINK("x")' }], feedback);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Testeur"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"<script>bad</script>"');
    expect(csv).toContain('"+228 90 12 34 56"');
    expect(adminCsv([{ ...ama, name: '+SUM(A1)' }], [])).toContain(`"'+SUM(A1)"`);
  });
});
