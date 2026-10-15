export type IssuerCardStatus = 'ACTIVE' | 'FROZEN' | 'TERMINATED';

export interface CreateCardRequest {
  /** Our internal card id, used as the issuer-side external reference. */
  cardId: string;
  userId: string;
  label: string;
  expiresAt: Date;
}

/** Only non-sensitive card data ever crosses this boundary. */
export interface IssuedCard {
  providerCardId: string;
  last4: string;
  status: IssuerCardStatus;
}

/**
 * Full details for a one-off display. Mesura never stores or logs them; a licensed issuer
 * usually returns them from its own vault, or a short-lived token for its secure display.
 */
export interface CardSecrets {
  pan: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  /** True for sandbox numbers that no merchant accepts. */
  demo: boolean;
}

/**
 * Issues and controls virtual cards.
 * Sandbox: SandboxCardIssuerProvider. Future: a licensed issuer/processor.
 */
export interface CardIssuerProvider {
  createCard(request: CreateCardRequest): Promise<IssuedCard>;
  freezeCard(providerCardId: string): Promise<void>;
  unfreezeCard(providerCardId: string): Promise<void>;
  terminateCard(providerCardId: string): Promise<void>;
  getCard(providerCardId: string): Promise<IssuedCard | null>;
  /** `last4` and `expiresAt` are what Mesura shows, so the details match the card on screen. */
  revealCard(providerCardId: string, last4: string, expiresAt: Date): Promise<CardSecrets>;
}

export const CARD_ISSUER_PROVIDER = Symbol('CARD_ISSUER_PROVIDER');
