import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default(''),
  /** Behind a reverse proxy (Vercel, load balancer): read the client IP from X-Forwarded-For. */
  TRUST_PROXY: booleanString,
  SANDBOX_MODE: booleanString,
  SANDBOX_FUNDING_AUTO_CONFIRM_SECONDS: z.coerce.number().int().min(0).default(10),
  SERVICE_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(500),
  /** Cards per person (verified identity / Mobile Money number) funded without the service fee. 0 = none. */
  FREE_CARDS_PER_PERSON: z.coerce.number().int().min(0).max(100).default(0),
  /**
   * Key for identity and phone fingerprints. Set it (≥ 32 chars) before real users sign up and never change
   * it: existing fingerprints stop matching. When empty, a key is derived from JWT_SECRET.
   */
  FINGERPRINT_SECRET: z.union([z.literal(''), z.string().min(32, 'FINGERPRINT_SECRET must be at least 32 characters')]).default(''),
  FUNDING_EXPIRY_MINUTES: z.coerce.number().int().positive().default(15),
  /** Shown on the public legal pages (privacy policy, account deletion). */
  LEGAL_PUBLISHER: z.string().default(''),
  SUPPORT_EMAIL: z.string().default(''),
  /** Resend (https://resend.com) API key; without it, password reset e-mails are not sent. */
  RESEND_API_KEY: z.string().default(''),
  /** Sender of transactional e-mails; must be on a domain verified in Resend. */
  EMAIL_FROM: z.string().default('Mesura <onboarding@resend.dev>'),
});

export type AppEnv = z.infer<typeof envSchema>;

/** Validates process.env once at boot; fails fast with a readable message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export const APP_ENV = Symbol('APP_ENV');
