import { Module } from '@nestjs/common';
import { prisma } from '../../../../../packages/database/src/client';
import { RestaurantAdmin } from './application/admin';
import { PrismaRestaurantAdminRepository } from './infrastructure/prisma-admin';
import { RestaurantAdminController } from './presentation/admin.controller';
@Module({
  controllers: [RestaurantAdminController],
  providers: [
    {
      provide: RestaurantAdmin,
      useFactory: () =>
        new RestaurantAdmin(new PrismaRestaurantAdminRepository(prisma)),
    },
  ],
})
export class RestaurantAdminModule {}
