import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { PrismaService } from '../../common/prisma.service'
import { JwtStrategy } from '../../common/strategies/jwt.strategy'
import { resolveJwtSecret } from '../../common/security/jwt-secret'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: resolveJwtSecret(),
      signOptions: { expiresIn: '24h' },
    }),
    NotificationsModule,
  ],
  providers: [AuthService, PrismaService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
