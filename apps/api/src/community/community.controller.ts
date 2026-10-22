import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { isSpam, parseFeedback, parseSignup, type SignupInput } from './community.forms';
import { testersPage, thanksPage, waitlistPage } from './community.pages';

type FormBody = Record<string, unknown> | undefined;

/**
 * Public pages to find the first users before the store listing: tester sign-up and guide
 * (/testeurs) and the launch waitlist (/liste-attente). Plain HTML forms, no account.
 */
@Public()
@Controller()
export class CommunityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('testeurs')
  @SkipThrottle()
  @Header('Content-Type', 'text/html; charset=utf-8')
  testers(): string {
    return testersPage();
  }

  @Post('testeurs')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Content-Type', 'text/html; charset=utf-8')
  async signupTester(@Body() body: FormBody): Promise<string> {
    if (isSpam(body)) return thanksPage('tester');
    const parsed = parseSignup(body, true);
    if (!parsed.ok) return testersPage({ error: parsed.error, values: body });
    await this.saveSignup(parsed.data);
    return thanksPage('tester');
  }

  @Post('testeurs/avis')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Content-Type', 'text/html; charset=utf-8')
  async feedback(@Body() body: FormBody): Promise<string> {
    if (isSpam(body)) return thanksPage('feedback');
    const parsed = parseFeedback(body);
    if (!parsed.ok) return testersPage({}, { error: parsed.error, values: body });
    await this.prisma.testerFeedback.create({ data: parsed.data });
    return thanksPage('feedback');
  }

  @Get('liste-attente')
  @SkipThrottle()
  @Header('Content-Type', 'text/html; charset=utf-8')
  waitlist(): string {
    return waitlistPage();
  }

  @Post('liste-attente')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Content-Type', 'text/html; charset=utf-8')
  async signup(@Body() body: FormBody): Promise<string> {
    if (isSpam(body)) return thanksPage('waitlist');
    const parsed = parseSignup(body, false);
    if (!parsed.ok) return waitlistPage({ error: parsed.error, values: body });
    await this.saveSignup(parsed.data);
    return thanksPage('waitlist');
  }

  /** One entry per number: signing up again updates it, and never turns a tester back into a plain sign-up. */
  private async saveSignup(data: SignupInput): Promise<void> {
    const update = { name: data.name, services: data.services, ...(data.tester ? { tester: true, gmail: data.gmail } : {}) };
    await this.prisma.waitlistEntry.upsert({ where: { phone: data.phone }, create: data, update });
  }
}
