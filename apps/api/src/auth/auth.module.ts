import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { APP_ENV, type AppEnv } from '../config/env';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { DemoAccountService } from '../demo/demo-account.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => ({
        secret: env.JWT_SECRET,
        // jsonwebtoken accepts vercel/ms strings such as "7d".
        signOptions: { expiresIn: env.JWT_EXPIRES_IN as `${number}d` },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, DemoAccountService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
