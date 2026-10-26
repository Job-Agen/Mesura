import { timingSafeEqual } from 'node:crypto';
import { Controller, Get, Header, Headers, Inject, NotFoundException, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/auth-user';
import { APP_ENV, type AppEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { adminCsv, adminPage } from './admin.pages';

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
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async signups(
    @Headers('authorization') authorization: string | undefined,
    @Query('q') query: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    this.assertAdmin(authorization, res);
    const { signups, feedback } = await this.load();
    return adminPage({
      signups,
      feedback,
      query: typeof query === 'string' ? query : undefined,
      baseUrl: `${req.protocol}://${req.get('host') ?? 'localhost'}`,
    });
  }

  /** Same data as a spreadsheet; the browser reuses the credentials typed for the page. */
  @Get('inscriptions.csv')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mesura-inscriptions.csv"')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async signupsCsv(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) res: Response): Promise<string> {
    this.assertAdmin(authorization, res);
    const { signups, feedback } = await this.load();
    return adminCsv(signups, feedback);
  }

  private assertAdmin(authorization: string | undefined, res: Response): void {
    if (!this.env.ADMIN_PASSWORD) throw new NotFoundException();
    if (!isAdmin(authorization, this.env.ADMIN_PASSWORD)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Mesura admin", charset="UTF-8"');
      throw new UnauthorizedException();
    }
  }

  private async load() {
    const [signups, feedback] = await Promise.all([
      this.prisma.waitlistEntry.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.testerFeedback.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);
    return { signups, feedback };
  }
}
