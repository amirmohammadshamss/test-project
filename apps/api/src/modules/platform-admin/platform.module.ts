import { Module } from '@nestjs/common';
import { prisma } from '../../../../../packages/database/src/client';
import { PlatformAdminGuard } from '../../common/platform-auth';
import { Platform } from './application/platform';
import { PrismaPlatformRepository } from './infrastructure/prisma-platform';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformMonitoring } from './monitoring';
import { PlatformAuthController } from './presentation/auth.controller';
import { PlatformController } from './presentation/platform.controller';
@Module({
  controllers: [PlatformAuthController, PlatformController],
  providers: [
    PlatformAdminGuard,
    PlatformAuthService,
    PlatformMonitoring,
    {
      provide: Platform,
      useFactory: () => new Platform(new PrismaPlatformRepository(prisma)),
    },
  ],
})
export class PlatformAdminModule {}
