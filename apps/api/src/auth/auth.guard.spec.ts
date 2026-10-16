import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from './auth.guard';

const jwt = new JwtService({ secret: 'x'.repeat(32) });

function setup(users: Record<string, number>) {
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id in users ? { sessionVersion: users[where.id] } : null,
    },
  } as unknown as PrismaService;
  const guard = new AuthGuard(jwt, new Reflector(), prisma);
  const run = (token: string) => {
    const request = { headers: { authorization: `Bearer ${token}` } } as Record<string, unknown>;
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context).then(() => request.authUser);
  };
  return { run };
}

describe('AuthGuard', () => {
  it('accepts a token of the current session version, and tokens issued before versions existed', async () => {
    const { run } = setup({ u1: 0, u2: 2 });
    await expect(run(await jwt.signAsync({ sub: 'u1' }))).resolves.toEqual({ userId: 'u1' });
    await expect(run(await jwt.signAsync({ sub: 'u2', sv: 2 }))).resolves.toEqual({ userId: 'u2' });
  });

  it('refuses a token from before the last password change, and a deleted account', async () => {
    const { run } = setup({ u1: 1 });
    await expect(run(await jwt.signAsync({ sub: 'u1', sv: 0 }))).rejects.toThrow(UnauthorizedException);
    await expect(run(await jwt.signAsync({ sub: 'gone', sv: 0 }))).rejects.toThrow(UnauthorizedException);
  });

  it('refuses a token signed with another key', async () => {
    const { run } = setup({ u1: 0 });
    const forged = await new JwtService({ secret: 'y'.repeat(32) }).signAsync({ sub: 'u1' });
    await expect(run(forged)).rejects.toThrow(UnauthorizedException);
  });
});
