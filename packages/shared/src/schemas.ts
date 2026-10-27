import { z } from 'zod';
import { MobileMoneyProvider } from './enums';
import {
  MAX_CARD_AMOUNT,
  MAX_DURATION_MINUTES,
  MAX_TRANSACTION_COUNT,
  MIN_CARD_AMOUNT,
  MIN_DURATION_MINUTES,
} from './rules';
import { SUPPORTED_CURRENCIES, formatMoney } from './money';

/**
 * Request schemas. The API validates every request body with these schemas
 * (see ZodValidationPipe); the mobile app reuses them for instant form feedback.
 * Frontend validation is a convenience only — the backend is authoritative.
 */

const amountSchema = z
  .number({ invalid_type_error: 'Le montant doit être un nombre' })
  .int('Le montant doit être un nombre entier')
  .positive('Le montant doit être supérieur à zéro');

const newPasswordSchema = z.string().min(8, 'Au moins 8 caractères').max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Saisissez votre prénom').max(80),
  email: z.string().trim().toLowerCase().email('Saisissez une adresse e-mail valide'),
  password: newPasswordSchema,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Acceptez les conditions d'utilisation pour continuer" }) }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Saisissez une adresse e-mail valide'),
  password: z.string().min(1, 'Saisissez votre mot de passe').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** "Forgot password", step 1: a 6-digit code is e-mailed if the account exists. */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Saisissez une adresse e-mail valide'),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

const emailCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Le code contient 6 chiffres');

/** "Forgot password", step 2: the code from the e-mail and the new password. */
export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Saisissez une adresse e-mail valide'),
  code: emailCodeSchema,
  password: newPasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Confirms the address of a new account with the 6-digit code sent to it. */
export const verifyEmailSchema = z.object({ code: emailCodeSchema });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Account deletion is confirmed with the current password. */
export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Saisissez votre mot de passe').max(128),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/** Togo mobile numbers: +228 followed by 8 digits. Spaces are ignored. */
export const togoPhoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\+228\d{8}$/, 'Saisissez un numéro togolais, par exemple +228 90 12 34 56'));

export const kycStartSchema = z.object({
  firstName: z.string().trim().min(1, 'Saisissez votre prénom').max(60),
  lastName: z.string().trim().min(1, 'Saisissez votre nom').max(60),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Utilisez le format AAAA-MM-JJ')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Saisissez une date valide'),
  country: z.string().length(2).toUpperCase().default('TG'),
  phone: togoPhoneSchema,
});
export type KycStartInput = z.infer<typeof kycStartSchema>;

export const createCardDraftSchema = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  maxAmount: amountSchema
    .min(MIN_CARD_AMOUNT, `Le minimum est de ${formatMoney(MIN_CARD_AMOUNT)}`)
    .max(MAX_CARD_AMOUNT, `Le maximum est de ${formatMoney(MAX_CARD_AMOUNT)}`),
  currency: z.enum(SUPPORTED_CURRENCIES).default('XOF'),
  /** null = unlimited payments until expiration */
  maxTransactionCount: z
    .number()
    .int()
    .min(1, 'Autorisez au moins 1 paiement')
    .max(MAX_TRANSACTION_COUNT, `${MAX_TRANSACTION_COUNT} paiements au maximum`)
    .nullable(),
  durationMinutes: z
    .number()
    .int()
    .min(MIN_DURATION_MINUTES, `La durée minimale est de ${MIN_DURATION_MINUTES} minutes`)
    .max(MAX_DURATION_MINUTES, `La durée maximale est de ${MAX_DURATION_MINUTES / (24 * 60)} jours`),
  /** Merchant slug, or null for "Anywhere" */
  merchantRestriction: z.string().trim().toLowerCase().min(1).max(40).nullable(),
});
export type CreateCardDraftInput = z.infer<typeof createCardDraftSchema>;

export const fundCardSchema = z.object({
  provider: z.nativeEnum(MobileMoneyProvider),
  phone: togoPhoneSchema,
});
export type FundCardInput = z.infer<typeof fundCardSchema>;

/** Where to send a card's unspent balance when it cannot go back to the wallet that funded it. */
export const refundDestinationSchema = z.object({
  phone: togoPhoneSchema,
});
export type RefundDestinationInput = z.infer<typeof refundDestinationSchema>;

/** Rules can only be tightened after funding — never loosened. */
export const updateCardRulesSchema = z
  .object({
    maxAmount: amountSchema.optional(),
    maxTransactionCount: z
      .number()
      .int()
      .min(1, 'Autorisez au moins 1 paiement')
      .max(MAX_TRANSACTION_COUNT, `${MAX_TRANSACTION_COUNT} paiements au maximum`)
      .optional(),
  })
  .refine((v) => v.maxAmount !== undefined || v.maxTransactionCount !== undefined, {
    message: 'Modifiez au moins une règle',
  });
export type UpdateCardRulesInput = z.infer<typeof updateCardRulesSchema>;

export const simulateTransactionSchema = z.object({
  cardId: z.string().min(1),
  merchant: z.string().trim().min(1, 'Saisissez un marchand').max(40),
  amount: amountSchema.max(MAX_CARD_AMOUNT * 10),
  currency: z.enum(SUPPORTED_CURRENCIES),
});
export type SimulateTransactionInput = z.infer<typeof simulateTransactionSchema>;

export const transactionFilterSchema = z.object({
  status: z.enum(['APPROVED', 'BLOCKED']).optional(),
  cardId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;
