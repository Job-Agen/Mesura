import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest, IS_PUBLIC } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenPayload {
  sub: string;
  /** User.sessionVersion when the token was issued. Tokens from before it existed count as 0. */
  sv?: number;
}

/**
 * Global guard: every route requires a valid bearer token unless marked @Public(). The account must
 * still exist, and the token must be newer than the last password change.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Connectez-vous pour continuer');

    const expired = new UnauthorizedException('Votre session a expiré. Reconnectez-vous.');
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token);
    } catch {
      throw expired;
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { sessionVersion: true } });
    if (!user || user.sessionVersion !== (payload.sv ?? 0)) throw expired;
    request.authUser = { userId: payload.sub };
    return true;
  }
}
