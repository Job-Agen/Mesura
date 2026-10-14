import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { KycProfile } from '@prisma/client';
import type { KycProfileDto, KycStartInput } from '@mesura/shared';
import { FingerprintService } from '../abuse/fingerprint.service';
import { iso } from '../common/iso';
import { PrismaService } from '../prisma/prisma.service';
import { KYC_PROVIDER, type KycProvider } from '../providers/kyc-provider.interface';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(KYC_PROVIDER) private readonly kycProvider: KycProvider,
    private readonly fingerprints: FingerprintService,
  ) {}

  async get(userId: string): Promise<KycProfileDto> {
    const profile = await this.prisma.kycProfile.findUnique({ where: { userId } });
    return toDto(profile);
  }

  /** Step 1: the user submits identity details. Status → PENDING. */
  async start(userId: string, input: KycStartInput): Promise<KycProfileDto> {
    const current = await this.prisma.kycProfile.findUnique({ where: { userId } });
    if (current?.status === 'VERIFIED') throw new ConflictException('Votre identité est déjà vérifiée');

    const data = {
      status: 'PENDING' as const,
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
      country: input.country,
    };
    const [profile] = await this.prisma.$transaction([
      this.prisma.kycProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data }),
      this.prisma.user.update({ where: { id: userId }, data: { phone: input.phone } }),
    ]);
    return toDto(profile);
  }

  /** Step 2: run verification with the KYC provider. Status → VERIFIED or REJECTED. */
  async complete(userId: string): Promise<KycProfileDto> {
    const profile = await this.prisma.kycProfile.findUnique({ where: { userId } });
    if (profile?.status === 'VERIFIED') return toDto(profile);
    if (!profile || profile.status !== 'PENDING' || !profile.firstName || !profile.lastName || !profile.dateOfBirth || !profile.country) {
      throw new ConflictException("Envoyez d'abord vos informations d'identité");
    }

    const facts = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      dateOfBirth: profile.dateOfBirth,
      country: profile.country,
    };
    const result = await this.kycProvider.verify({ userId, ...facts });
    // One verified identity per live account; refused (409) before the profile is marked verified.
    if (result.decision === 'VERIFIED') await this.fingerprints.claimIdentity(userId, facts);
    const updated = await this.prisma.kycProfile.update({
      where: { userId },
      data: {
        status: result.decision,
        providerReference: result.providerReference,
        verifiedAt: result.decision === 'VERIFIED' ? new Date() : null,
      },
    });
    return toDto(updated);
  }

  async isVerified(userId: string): Promise<boolean> {
    const profile = await this.prisma.kycProfile.findUnique({ where: { userId }, select: { status: true } });
    return profile?.status === 'VERIFIED';
  }
}

function toDto(profile: KycProfile | null): KycProfileDto {
  return {
    status: profile?.status ?? 'NOT_STARTED',
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : null,
    country: profile?.country ?? null,
    updatedAt: profile ? iso(profile.updatedAt) : null,
  };
}
