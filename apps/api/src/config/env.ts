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
  /**
   * Password of the private /admin pages (sign-ups and tester feedback), asked by the browser with the
   * user name "admin". When empty, /admin answers 404.
   */
  ADMIN_PASSWORD: z.union([z.literal(''), z.string().min(16, 'ADMIN_PASSWORD must be at least 16 characters')]).default(''),
  /**
   * FedaPay secret key (https://docs.fedapay.com). Empty: Mobile Money is simulated in-process.
   * sk_sandbox_… talks to FedaPay's test environment; a sk_live_… key moves real money and is
   * refused unless FEDAPAY_ALLOW_LIVE=true.
   */
  FEDAPAY_SECRET_KEY: z.string().default(''),
  FEDAPAY_ALLOW_LIVE: booleanString,
  /**
   * Send refunds with FedaPay payouts. Payouts are enabled per account by FedaPay's support; until
   * then refunds are simulated. Required with a live key: real money in, simulated money out is refused.
   */
  FEDAPAY_PAYOUTS_ENABLED: booleanString,
  /** Resend (https://resend.com) API key; without it, password reset e-mails are not sent. */
  RESEND_API_KEY: z.string().default(''),
  /** Sender of transactional e-mails; must be on a domain verified in Resend. */
  EMAIL_FROM: z.string().default('Mesura <onboarding@resend.dev>'),
});

/** Cross-field rules, checked after each variable is valid on its own. */
const checkedEnvSchema = envSchema
  .refine((env) => !env.FEDAPAY_SECRET_KEY.startsWith('sk_live_') || env.FEDAPAY_ALLOW_LIVE, {
    path: ['FEDAPAY_SECRET_KEY'],
    message: 'a live FedaPay key moves real money: set FEDAPAY_ALLOW_LIVE=true to use it',
  })
  .refine((env) => !env.FEDAPAY_SECRET_KEY.startsWith('sk_live_') || !env.SANDBOX_MODE, {
    path: ['SANDBOX_MODE'],
    message: 'sandbox tools (simulated payments, instant confirmation) must be off with a live FedaPay key: set SANDBOX_MODE=false',
  })
  .refine((env) => !env.FEDAPAY_SECRET_KEY.startsWith('sk_live_') || env.FEDAPAY_PAYOUTS_ENABLED, {
    path: ['FEDAPAY_PAYOUTS_ENABLED'],
    message: 'with a live FedaPay key, refunds must be real: enable FedaPay payouts and set FEDAPAY_PAYOUTS_ENABLED=true',
  });

export type AppEnv = z.infer<typeof envSchema>;

/** Validates process.env once at boot; fails fast with a readable message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = checkedEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export const APP_ENV = Symbol('APP_ENV');
