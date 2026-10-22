import { isAdmin } from './admin.controller';
import { adminPage } from './admin.pages';

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

  it('lists tester Gmail addresses for the Play Console and escapes user text', () => {
    const at = new Date('2026-10-22T10:00:00Z');
    const html = adminPage(
      [
        { name: 'Ama', phone: '+22890123456', services: ['Netflix'], gmail: 'ama@gmail.com', tester: true, createdAt: at },
        { name: 'Kofi', phone: '+22891000000', services: [], gmail: 'kofi@gmail.com', tester: true, createdAt: at },
        { name: '<b>x</b>', phone: '+22892000000', services: [], gmail: null, tester: false, createdAt: at },
      ],
      [{ name: null, contact: null, rating: 4, message: '<script>bad</script>', createdAt: at }],
    );
    expect(html).toContain('ama@gmail.com, kofi@gmail.com');
    expect(html).toContain('https://wa.me/22890123456');
    expect(html).not.toContain('<script>bad');
    expect(html).not.toContain('<b>x</b>');
  });
});
