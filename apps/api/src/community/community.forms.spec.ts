import { isSpam, normalizeTogoPhone, parseFeedback, parseSignup } from './community.forms';
import { testersPage } from './community.pages';
import { landingPage } from './landing.page';

describe('community forms', () => {
  it('normalizes the usual ways of typing a Togo number', () => {
    expect(normalizeTogoPhone('90 12 34 56')).toBe('+22890123456');
    expect(normalizeTogoPhone('+228 90-12-34-56')).toBe('+22890123456');
    expect(normalizeTogoPhone('0022890123456')).toBe('+22890123456');
    expect(normalizeTogoPhone('9012345')).toBeNull();
    expect(normalizeTogoPhone('+33612345678')).toBeNull();
  });

  it('keeps only known services, whether one or several boxes are ticked', () => {
    const one = parseSignup({ name: 'Ama', phone: '90123456', services: 'Netflix' }, false);
    const many = parseSignup({ name: 'Ama', phone: '90123456', services: ['Canva', 'Hack<script>', 'Spotify'] }, false);
    expect(one.ok && one.data.services).toEqual(['Netflix']);
    expect(many.ok && many.data.services).toEqual(['Spotify', 'Canva']);
  });

  it('requires a Gmail address from testers only', () => {
    expect(parseSignup({ name: 'Ama', phone: '90123456' }, false).ok).toBe(true);
    expect(parseSignup({ name: 'Ama', phone: '90123456', gmail: 'ama@yahoo.fr' }, true).ok).toBe(false);
    const ok = parseSignup({ name: 'Ama', phone: '90123456', gmail: ' Ama.K@Gmail.com ' }, true);
    expect(ok.ok && ok.data).toMatchObject({ tester: true, gmail: 'ama.k@gmail.com' });
  });

  it('rejects an empty name or number with a readable message', () => {
    expect(parseSignup({ phone: '90123456' }, false)).toEqual({ ok: false, error: 'Indiquez votre prénom.' });
    expect(parseSignup({ name: 'Ama', phone: '12' }, false).ok).toBe(false);
  });

  it('accepts feedback with an optional 1–5 rating', () => {
    expect(parseFeedback({ message: 'Très clair', rating: '4' })).toEqual({
      ok: true,
      data: { name: null, contact: null, rating: 4, message: 'Très clair' },
    });
    const noRating = parseFeedback({ message: 'Bien', rating: '9' });
    expect(noRating.ok && noRating.data.rating).toBeNull();
    expect(parseFeedback({ message: ' ' }).ok).toBe(false);
  });

  it('flags the hidden field only bots fill in', () => {
    expect(isSpam({ website: 'http://spam' })).toBe(true);
    expect(isSpam({ website: '' })).toBe(false);
  });

  it('escapes what the user typed when the page is shown again', () => {
    const html = testersPage({ error: 'x', values: { name: '"><script>alert(1)</script>' } });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&#34;&#62;&#60;script&#62;');
  });
});

describe('landing page', () => {
  it('links to the tester and waitlist pages, says it is a demo and escapes the contact', () => {
    const html = landingPage({ email: 'a@b.c"><x', publisher: 'Mesura Labs' });
    expect(html).toContain('href="/testeurs"');
    expect(html).toContain('href="/liste-attente"');
    expect(html).toContain('version de démonstration');
    expect(html).toContain('Mesura Labs');
    expect(html).not.toContain('"><x');
    expect(html).not.toMatch(/<script/i);
  });
});
