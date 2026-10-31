import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type {
  CardIssuerProvider,
  CardSecrets,
  CreateCardRequest,
  IssuedCard,
  IssuerCardStatus,
} from '../card-issuer-provider.interface';
import { FyatuApiError, type FyatuClient } from './fyatu-client';
import { decryptFyatuSecret } from './fyatu-crypto';

export interface FyatuIssuerSettings {
  productId: string;
  /** Just-in-time product: no balance on the card, each approved payment is drawn from the program balance. */
  jit: boolean;
  xofPerUsd: number;
}

interface FyatuCardholder {
  cardholderId: string;
  kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface FyatuCard {
  id: string;
  status: string;
  last4: string | null;
}

interface FyatuSecureDetails {
  cardNumber: string;
  cvv: string;
  expirationDate: string;
}

/** Waits for an asynchronously issued card to get its number (Fyatu answers CREATING first). */
const PROVISION_POLLS = 5;
const PROVISION_POLL_MS = 1_000;

/**
 * Virtual cards issued by Fyatu (https://docs.fyatu.com/v3.20). Each Mesura user gets one Fyatu
 * cardholder, created from their verified identity with their first card. Mesura's own rules
 * engine approves or declines every payment in real time (see FyatuWebhookController).
 */
export class FyatuCardIssuerProvider implements CardIssuerProvider {
  private readonly logger = new Logger(FyatuCardIssuerProvider.name);

  constructor(
    private readonly client: FyatuClient,
    private readonly prisma: PrismaService,
    private readonly settings: FyatuIssuerSettings,
    private readonly sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {}

  async createCard(request: CreateCardRequest): Promise<IssuedCard> {
    const cardholderId = await this.ensureCardholder(request.userId);
    let card: FyatuCard;
    try {
      card = await this.client.call<FyatuCard>('POST', '/cards', {
        cardholderId,
        productId: this.settings.productId,
        customName: request.label.slice(0, 26),
        // A just-in-time card holds no money; otherwise it is loaded with its limit.
        ...(this.settings.jit ? {} : { amount: xofToUsd(request.limitXof, this.settings.xofPerUsd) }),
      });
    } catch (error) {
      if (error instanceof FyatuApiError && error.code === 'CARDHOLDER_KYC_NOT_APPROVED') {
        throw new ServiceUnavailableException(
          'Votre profil est encore en cours de vérification chez notre émetteur de cartes. Réessayez dans quelques minutes.',
        );
      }
      throw error;
    }

    for (let i = 0; !card.last4 && i < PROVISION_POLLS; i += 1) {
      await this.sleep(PROVISION_POLL_MS);
      card = await this.client.call<FyatuCard>('GET', `/cards/${card.id}`);
    }
    this.logger.log(`Fyatu card issued for card ${request.cardId}${card.last4 ? '' : ' (number pending)'}`);
    return { providerCardId: card.id, last4: card.last4 || null, status: toStatus(card.status) };
  }

  async freezeCard(providerCardId: string): Promise<void> {
    await this.client.call('POST', `/cards/${providerCardId}/freeze`);
  }

  async unfreezeCard(providerCardId: string): Promise<void> {
    await this.client.call('POST', `/cards/${providerCardId}/unfreeze`);
  }

  async terminateCard(providerCardId: string): Promise<void> {
    try {
      await this.client.call('POST', `/cards/${providerCardId}/terminate`);
    } catch (error) {
      // Terminating twice is harmless: the card is already unusable.
      if (error instanceof FyatuApiError && error.code === 'CARD_ALREADY_TERMINATED') return;
      throw error;
    }
  }

  async getCard(providerCardId: string): Promise<IssuedCard | null> {
    try {
      const card = await this.client.call<FyatuCard>('GET', `/cards/${providerCardId}`);
      return { providerCardId: card.id, last4: card.last4 || null, status: toStatus(card.status) };
    } catch (error) {
      if (error instanceof FyatuApiError && error.status === 404) return null;
      throw error;
    }
  }

  /** The real card details, decrypted in memory for one display; never stored or logged. */
  async revealCard(providerCardId: string): Promise<CardSecrets> {
    const details = await this.client.call<FyatuSecureDetails>('GET', `/cards/${providerCardId}/secure-details`);
    const [month, year] = decryptFyatuSecret(details.expirationDate, this.client.apiKey).split('/');
    return {
      pan: decryptFyatuSecret(details.cardNumber, this.client.apiKey).replace(/\D/g, ''),
      expiryMonth: Number(month),
      expiryYear: Number(year),
      cvv: decryptFyatuSecret(details.cvv, this.client.apiKey),
      // Test-mode cards are not accepted by merchants.
      demo: this.client.testMode,
    };
  }

  /** The user's Fyatu cardholder, created once from their verified identity. */
  private async ensureCardholder(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { kycProfile: true } });
    if (user.issuerCardholderId) return user.issuerCardholderId;

    const kyc = user.kycProfile;
    if (!kyc?.firstName || !kyc.lastName || !kyc.dateOfBirth || !kyc.country) {
      throw new ServiceUnavailableException("Vérifiez votre identité avant de créer une carte");
    }
    const holder = await this.client.call<FyatuCardholder>('POST', '/cardholders', {
      firstName: kyc.firstName,
      lastName: kyc.lastName,
      email: user.email,
      dateOfBirth: kyc.dateOfBirth.toISOString().slice(0, 10),
      nationality: kyc.country,
      // Mesura does not collect a street address yet: the city stands in until real KYC asks for it.
      address: { address: 'Lomé', city: 'Lomé', country: kyc.country },
      ...(user.phone ? { phone: user.phone } : {}),
      externalId: user.id,
    });
    await this.prisma.user.update({ where: { id: userId }, data: { issuerCardholderId: holder.cardholderId } });
    return holder.cardholderId;
  }
}

/** FCFA → US dollars, rounded down to the cent so a card is never loaded above its limit. */
export function xofToUsd(amountXof: number, xofPerUsd: number): number {
  return Math.floor((amountXof * 100) / xofPerUsd) / 100;
}

/** US dollars → FCFA, rounded up so a payment never counts for less than it costs. */
export function usdToXof(amountUsd: number, xofPerUsd: number): number {
  return Math.ceil(Math.round(amountUsd * 100) * xofPerUsd / 100);
}

function toStatus(status: string): IssuerCardStatus {
  if (status === 'FROZEN') return 'FROZEN';
  if (status === 'TERMINATED') return 'TERMINATED';
  return 'ACTIVE';
}
