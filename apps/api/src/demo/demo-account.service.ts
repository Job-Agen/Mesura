import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { createDemoUser, DEMO_EMAIL, DEMO_PASSWORD, rebuildDemoCards } from './demo-account';

/** A card the reviewer can still use for a while: below this, the demo cards are rebuilt. */
const MIN_USABLE_MS = 24 * 60 * 60_000;

/**
 * Keeps the sandbox demo account usable for app store reviewers, who sign in with fixed credentials,
 * may delete the account to test deletion, and may come back weeks later: at a demo sign-in, the
 * account is recreated if it is gone, and its cards are rebuilt when none stays active for a day or a
 * refund waits for a TMoney number (it would block the deletion a reviewer tests).
 * Sandbox only: with SANDBOX_MODE off, this does nothing.
 */
@Injectable()
export class DemoAccountService {
  private readonly logger = new Logger(DemoAccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  /** Called before checking a sign-in. Only the exact demo credentials trigger anything. */
  async prepareForSignIn(email: string, password: string): Promise<void> {
    if (!this.env.SANDBOX_MODE || email !== DEMO_EMAIL || password !== DEMO_PASSWORD) return;

    const now = Date.now();
    const existing = await this.prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
    if (!existing) {
      const userId = await createDemoUser(this.prisma, now);
      await rebuildDemoCards(this.prisma, userId, now);
      this.logger.log('Demo account recreated');
      return;
    }

    const [usable, stuckRefunds] = await Promise.all([
      this.prisma.card.count({
        where: { userId: existing.id, status: 'ACTIVE', expiresAt: { gt: new Date(now + MIN_USABLE_MS) } },
      }),
      this.prisma.refund.count({ where: { card: { userId: existing.id }, status: { in: ['ACTION_REQUIRED', 'FAILED'] } } }),
    ]);
    if (usable === 0 || stuckRefunds > 0) {
      await this.prisma.$transaction((tx) => rebuildDemoCards(tx, existing.id, now));
      this.logger.log('Demo cards rebuilt');
    }
  }
}
