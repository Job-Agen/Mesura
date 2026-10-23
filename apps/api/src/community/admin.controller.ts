import { timingSafeEqual } from 'node:crypto';
import { Controller, Get, Header, Headers, Inject, NotFoundException, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/auth-user';
import { APP_ENV, type AppEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { adminPage } from './admin.pages';

const ADMIN_USER = 'admin';

/** True when the Basic credentials are admin + the configured password (constant-time comparison). */
export function isAdmin(authorization: string | undefined, password: string): boolean {
  if (!password || !authorization?.startsWith('Basic ')) return false;
  const given = Buffer.from(Buffer.from(authorization.slice(6), 'base64').toString('utf8'));
  const expected = Buffer.from(`${ADMIN_USER}:${password}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Private page listing tester sign-ups (with the Gmail addresses to paste into the Play Console),
 * the waitlist and tester feedback. Protected by HTTP Basic auth so a phone browser shows its own
 * sign-in prompt; off (404) until ADMIN_PASSWORD is set.
 */
@Public()
@Controller('admin')
export class AdminController {
  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly prisma: PrismaService,
  ) {}

  @Get('inscriptions')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async signups(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) res: Response): Promise<string> {
    if (!this.env.ADMIN_PASSWORD) throw new NotFoundException();
    if (!isAdmin(authorization, this.env.ADMIN_PASSWORD)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Mesura admin", charset="UTF-8"');
      throw new UnauthorizedException();
    }
    const [signups, feedback] = await Promise.all([
      this.prisma.waitlistEntry.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.testerFeedback.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);
    return adminPage(signups, feedback);
  }
}
