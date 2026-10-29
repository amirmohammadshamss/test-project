import { Module } from '@nestjs/common';
import { prisma } from '../../../../../packages/database/src/client';
import { RealtimeEventPublisher } from '../../common/application/realtime';
import { Notifications, NotificationRepository } from './application';
import { PrismaNotificationRepository } from './infrastructure/repository';
import { NotificationRuntime } from './infrastructure/runtime';
import {
  NotificationsController,
  PlatformNotificationsController,
} from './presentation/controller';
@Module({
  controllers: [NotificationsController, PlatformNotificationsController],
  providers: [
    NotificationRuntime,
    {
      provide: NotificationRepository,
      inject: [RealtimeEventPublisher],
      useFactory: (events: RealtimeEventPublisher) =>
        new PrismaNotificationRepository(prisma, events),
    },
    {
      provide: Notifications,
      inject: [NotificationRepository],
      useFactory: (repo: NotificationRepository) => new Notifications(repo),
    },
  ],
  exports: [NotificationRuntime],
})
export class NotificationsModule {}
