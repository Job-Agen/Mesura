import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { formatMoney, type KycStatus, type UserDto } from '@mesura/shared';
import { verifyPassword } from '../auth/password';
import { CardsService } from '../cards/cards.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
  ) {}

  async getMe(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { kycProfile: { select: { status: true } } },
    });
    if (!user) throw new NotFoundException('Compte introuvable');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      emailVerified: user.emailVerifiedAt !== null,
      kycStatus: (user.kycProfile?.status ?? 'NOT_STARTED') satisfies KycStatus,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Permanently deletes the account and, by cascade, its identity profile, cards, rules,
   * fundings and transactions. Required by app stores for apps with sign-up. Usable cards are
   * closed first and their unspent balance refunded; a balance with nowhere to go blocks the deletion.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable');
    if (!(await verifyPassword(password, user.passwordHash))) {
      // 403, not 401: the app signs out on any 401, and a typo must not log the user out.
      throw new ForbiddenException('Mot de passe incorrect');
    }
    const waiting = await this.cards.closeAllForDeletion(userId);
    if (waiting > 0) {
      throw new ConflictException(
        `${formatMoney(waiting, 'XOF')} restent à vous rembourser. Indiquez un numéro Mixx by Yas sur la carte concernée, puis supprimez votre compte.`,
      );
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
