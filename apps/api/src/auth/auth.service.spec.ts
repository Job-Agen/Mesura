import { BadRequestException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailMessage, EmailProvider } from '../providers/email-provider.interface';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { hashPassword, verifyPassword } from './password';

interface ResetRow {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

/** In-memory stand-in for the few Prisma calls the reset flow makes. */
function setup() {
  const user = { id: 'u1', email: 'ama@test.dev', name: 'Ama', passwordHash: '', sessionVersion: 0 };
  let resets: ResetRow[] = [];
  const sent: EmailMessage[] = [];

  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        where.email === user.email || where.id === user.id ? user : null,
      update: async ({ data }: { data: { passwordHash: string; sessionVersion?: { increment: number } } }) =>
        Object.assign(user, {
          passwordHash: data.passwordHash,
          sessionVersion: user.sessionVersion + (data.sessionVersion?.increment ?? 0),
        }),
    },
    passwordResetCode: {
      deleteMany: async () => {
        resets = [];
      },
      create: async ({ data }: { data: Omit<ResetRow, 'id' | 'attempts' | 'createdAt'> }) => {
        resets.push({ ...data, id: `r${resets.length}`, attempts: 0, createdAt: new Date() });
      },
      findFirst: async () => resets[resets.length - 1] ?? null,
      update: async ({ where }: { where: { id: string } }) => {
        const row = resets.find((r) => r.id === where.id);
        if (row) row.attempts += 1;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  } as unknown as PrismaService;

  const email: EmailProvider = { delivers: true, send: async (m) => void sent.push(m) };
  const signed: unknown[] = [];
  const jwt = { signAsync: async (payload: unknown) => (signed.push(payload), 'token') } as unknown as JwtService;
  const users = { getMe: async () => ({ id: user.id }) } as unknown as UsersService;
  const service = new AuthService(prisma, jwt, users, email);
  const codeFromEmail = () => /(\d{6})/.exec(sent[sent.length - 1]?.text ?? '')?.[1] ?? '';

  return { service, user, sent, signed, codeFromEmail, resets: () => resets };
}

describe('AuthService password reset', () => {
  it('answers the same way for an unknown e-mail and sends nothing', async () => {
    const { service, sent } = setup();
    await expect(service.forgotPassword({ email: 'nobody@test.dev' })).resolves.toEqual({ sent: true });
    expect(sent).toHaveLength(0);
  });

  it('e-mails a 6-digit code, stores only its hash, and the code sets a new password', async () => {
    const { service, user, sent, codeFromEmail, resets } = setup();
    user.passwordHash = await hashPassword('old-password');

    await service.forgotPassword({ email: user.email });
    const code = codeFromEmail();
    expect(code).toMatch(/^\d{6}$/);
    expect(sent[0]?.to).toBe(user.email);
    expect(resets()[0]?.codeHash).not.toContain(code);

    await expect(service.resetPassword({ email: user.email, code, password: 'new-password' })).resolves.toMatchObject({
      accessToken: 'token',
    });
    expect(await verifyPassword('new-password', user.passwordHash)).toBe(true);
    expect(resets()).toHaveLength(0); // the code cannot be reused
  });

  it('signs out every device: the new token carries a raised session version', async () => {
    const { service, user, signed, codeFromEmail } = setup();
    await service.forgotPassword({ email: user.email });
    await service.resetPassword({ email: user.email, code: codeFromEmail(), password: 'new-password' });
    expect(user.sessionVersion).toBe(1);
    expect(signed[signed.length - 1]).toEqual({ sub: user.id, sv: 1 });
  });

  it('rejects a wrong code and locks the code after 5 wrong attempts', async () => {
    const { service, user, codeFromEmail } = setup();
    await service.forgotPassword({ email: user.email });
    const code = codeFromEmail();
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      await expect(service.resetPassword({ email: user.email, code: wrong, password: 'new-password' })).rejects.toThrow(
        BadRequestException,
      );
    }
    // Even the right code no longer works: a new one must be requested.
    await expect(service.resetPassword({ email: user.email, code, password: 'new-password' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an expired code', async () => {
    const { service, user, codeFromEmail, resets } = setup();
    await service.forgotPassword({ email: user.email });
    const code = codeFromEmail();
    resets()[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.resetPassword({ email: user.email, code, password: 'new-password' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
