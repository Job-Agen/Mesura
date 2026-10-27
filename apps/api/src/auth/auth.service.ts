import { createHash, randomInt } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthResponseDto,
  EmailCodeSentDto,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UserDto,
} from '@mesura/shared';
import { APP_ENV, type AppEnv } from '../config/env';
import { EMAIL_PROVIDER, type EmailProvider } from '../providers/email-provider.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { TokenPayload } from './auth.guard';
import { DemoAccountService } from '../demo/demo-account.service';
import { hashPassword, verifyPassword } from './password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    private readonly demo: DemoAccountService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Un compte existe déjà avec cette adresse e-mail');

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        termsAcceptedAt: new Date(),
        kycProfile: { create: {} },
      },
    });
    return this.issueToken(user.id, user.sessionVersion);
  }

  async login(input: LoginInput): Promise<AuthResponseDto> {
    await this.demo.prepareForSignIn(input.email, input.password);
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Same message for unknown email and wrong password (no account enumeration).
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }
    return this.issueToken(user.id, user.sessionVersion);
  }

  /**
   * "Forgot password": e-mails a 6-digit code valid 15 minutes. Always answers the same way,
   * whether or not the address has an account, so it cannot be used to discover accounts.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<{ sent: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return { sent: true };

    const code = newCode();
    await this.prisma.$transaction([
      this.prisma.passwordResetCode.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetCode.create({
        data: { userId: user.id, codeHash: hashCode(user.id, code), expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS) },
      }),
    ]);
    await this.email.send(resetEmail(user.name, user.email, code));
    return { sent: true };
  }

  /** Checks the e-mailed code, sets the new password, signs out every other device and signs the user in. */
  async resetPassword(input: ResetPasswordInput): Promise<AuthResponseDto> {
    const invalid = new BadRequestException('Code invalide ou expiré. Demandez un nouveau code.');
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw invalid;
    const reset = await this.prisma.passwordResetCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!reset || reset.expiresAt.getTime() < Date.now() || reset.attempts >= RESET_MAX_ATTEMPTS) throw invalid;

    if (reset.codeHash !== hashCode(user.id, input.code)) {
      await this.prisma.passwordResetCode.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(input.password), sessionVersion: { increment: 1 } },
      }),
      this.prisma.passwordResetCode.deleteMany({ where: { userId: user.id } }),
    ]);
    return this.issueToken(user.id, updated.sessionVersion);
  }

  /**
   * E-mails a new 6-digit code to confirm the account's address (valid 15 minutes, replaces any
   * earlier one). The app asks for it when it shows the confirmation screen.
   */
  async sendEmailCode(userId: string): Promise<EmailCodeSentDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return { delivered: this.email.delivers };

    const code = newCode();
    await this.prisma.$transaction([
      this.prisma.emailVerificationCode.deleteMany({ where: { userId } }),
      this.prisma.emailVerificationCode.create({
        data: { userId, codeHash: hashCode(userId, code), expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS) },
      }),
    ]);
    await this.email.send(verificationEmail(user.name, user.email, code));
    // Without an e-mail service, a sandbox server hands the code to its own account holder so
    // testing is not blocked. Never with a real e-mail service, never outside the sandbox.
    return !this.email.delivers && this.env.SANDBOX_MODE ? { delivered: false, sandboxCode: code } : { delivered: this.email.delivers };
  }

  /** Confirms the address with the e-mailed code. */
  async verifyEmail(userId: string, code: string): Promise<UserDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return this.users.getMe(userId);

    const invalid = new BadRequestException('Code invalide ou expiré. Demandez un nouveau code.');
    const sent = await this.prisma.emailVerificationCode.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    if (!sent || sent.expiresAt.getTime() < Date.now() || sent.attempts >= RESET_MAX_ATTEMPTS) throw invalid;
    if (sent.codeHash !== hashCode(userId, code)) {
      await this.prisma.emailVerificationCode.update({ where: { id: sent.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
      this.prisma.emailVerificationCode.deleteMany({ where: { userId } }),
    ]);
    return this.users.getMe(userId);
  }

  private async issueToken(userId: string, sessionVersion: number): Promise<AuthResponseDto> {
    const accessToken = await this.jwt.signAsync({ sub: userId, sv: sessionVersion } satisfies TokenPayload);
    return { accessToken, user: await this.users.getMe(userId) };
  }
}

const RESET_CODE_TTL_MS = 15 * 60_000;
/** Wrong codes allowed before a new one must be requested (10^6 codes, so guessing is hopeless). */
const RESET_MAX_ATTEMPTS = 5;

const newCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0');

/** Codes are short, so they are bound to the user before hashing and never stored in clear. */
function hashCode(userId: string, code: string): string {
  return createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

function resetEmail(name: string, to: string, code: string) {
  const text = [
    `Bonjour ${name},`,
    '',
    `Votre code pour choisir un nouveau mot de passe Mesura : ${code}`,
    '',
    'Il est valable 15 minutes. Si vous n\'avez rien demandé, ignorez cet e-mail : votre mot de passe ne change pas.',
    '',
    'Mesura ne vous demandera jamais ce code par téléphone.',
  ].join('\n');
  const html = `<p>Bonjour ${escapeHtml(name)},</p>
<p>Votre code pour choisir un nouveau mot de passe Mesura :</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
<p>Il est valable 15 minutes. Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe ne change pas.</p>
<p style="color:#66736D">Mesura ne vous demandera jamais ce code par téléphone.</p>`;
  return { to, subject: `${code} — votre code Mesura`, text, html };
}

function verificationEmail(name: string, to: string, code: string) {
  const text = [
    `Bonjour ${name},`,
    '',
    `Bienvenue sur Mesura ! Votre code pour confirmer votre adresse e-mail : ${code}`,
    '',
    'Il est valable 15 minutes. Si vous n\'avez pas créé de compte Mesura, ignorez cet e-mail.',
    '',
    'Mesura ne vous demandera jamais ce code par téléphone.',
  ].join('\n');
  const html = `<p>Bonjour ${escapeHtml(name)},</p>
<p>Bienvenue sur Mesura ! Votre code pour confirmer votre adresse e-mail :</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
<p>Il est valable 15 minutes. Si vous n'avez pas créé de compte Mesura, ignorez cet e-mail.</p>
<p style="color:#66736D">Mesura ne vous demandera jamais ce code par téléphone.</p>`;
  return { to, subject: `${code} — confirmez votre adresse Mesura`, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
