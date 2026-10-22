/**
 * Parsing of the public HTML forms (/testeurs, /liste-attente). They are plain form posts
 * (no JavaScript: the CSP forbids inline scripts), so errors are shown by re-rendering the page.
 */

/** Services offered as checkboxes on the sign-up forms; anything else is dropped. */
export const SERVICES = [
  'Netflix',
  'Spotify',
  'Canva',
  'ChatGPT',
  'YouTube / Google',
  'Publicités Facebook / Instagram',
  'Amazon / AliExpress',
  'Autre',
] as const;

export interface SignupInput {
  name: string;
  phone: string;
  services: string[];
  tester: boolean;
  gmail: string | null;
}

export interface FeedbackInput {
  name: string | null;
  contact: string | null;
  rating: number | null;
  message: string;
}

export type FormResult<T> = { ok: true; data: T } | { ok: false; error: string };

type Body = Record<string, unknown> | undefined;

const text = (body: Body, key: string, max: number): string => {
  const v = body?.[key];
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
};

/** True when the hidden "website" field was filled: only bots do that. */
export const isSpam = (body: Body): boolean => text(body, 'website', 200) !== '';

/** Accepts "90 12 34 56", "90123456", "+228 90 12 34 56" or "00228…"; returns +228XXXXXXXX or null. */
export function normalizeTogoPhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+228')) digits = digits.slice(4);
  else if (digits.startsWith('00228')) digits = digits.slice(5);
  return /^\d{8}$/.test(digits) ? `+228${digits}` : null;
}

export function parseSignup(body: Body, tester: boolean): FormResult<SignupInput> {
  const name = text(body, 'name', 60);
  if (!name) return { ok: false, error: 'Indiquez votre prénom.' };
  const phone = normalizeTogoPhone(text(body, 'phone', 30));
  if (!phone) return { ok: false, error: 'Indiquez votre numéro WhatsApp togolais (8 chiffres), par exemple 90 12 34 56.' };
  const raw = body?.services;
  const picked = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const services = SERVICES.filter((s) => picked.includes(s));
  let gmail: string | null = null;
  if (tester) {
    gmail = text(body, 'gmail', 100).toLowerCase();
    if (!/^[a-z0-9.+_-]+@(gmail|googlemail)\.com$/.test(gmail)) {
      return { ok: false, error: 'Indiquez votre adresse Gmail : Google Play en a besoin pour vous inviter comme testeur.' };
    }
  }
  return { ok: true, data: { name, phone, services, tester, gmail } };
}

export function parseFeedback(body: Body): FormResult<FeedbackInput> {
  const message = text(body, 'message', 2000);
  if (message.length < 3) return { ok: false, error: 'Écrivez votre avis avant d’envoyer.' };
  const rating = Number(text(body, 'rating', 1));
  return {
    ok: true,
    data: {
      name: text(body, 'name', 60) || null,
      contact: text(body, 'contact', 100) || null,
      rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
      message,
    },
  };
}
