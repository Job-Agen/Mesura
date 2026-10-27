import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { verifyEmailSchema, type EmailCodeSentDto, type UserDto, type VerifyEmailInput } from '@mesura/shared';
import { CurrentUserId } from '../common/auth-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

/** Confirmation of a new account's e-mail address (signed-in routes, unlike the rest of /auth). */
@Controller('me/email')
export class EmailVerificationController {
  constructor(private readonly auth: AuthService) {}

  /** Each call can send an e-mail: tight limit. */
  @Post('send-code')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  sendCode(@CurrentUserId() userId: string): Promise<EmailCodeSentDto> {
    return this.auth.sendEmailCode(userId);
  }

  @Post('verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@CurrentUserId() userId: string, @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput): Promise<UserDto> {
    return this.auth.verifyEmail(userId, body.code);
  }
}
