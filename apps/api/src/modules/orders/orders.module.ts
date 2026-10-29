import { RealtimeEventPublisher } from '../../common/application/realtime';
import { Module } from '@nestjs/common';
import { prisma } from '../../../../../packages/database/src/client';
import { Orders } from './application/orders';
import { OrderQueries } from './application/queries';
import { PrismaOrderUnitOfWork } from './infrastructure/prisma-uow';
import { PrismaOrderQueries } from './infrastructure/prisma-queries';
import { OrdersController } from './presentation/orders.controller';
@Module({
  controllers: [OrdersController],
  providers: [
    {
      provide: Orders,
      inject: [RealtimeEventPublisher],
      useFactory: (events: RealtimeEventPublisher) =>
        new Orders(new PrismaOrderUnitOfWork(prisma, events)),
    },
    { provide: OrderQueries, useFactory: () => new PrismaOrderQueries(prisma) },
  ],
})
export class OrdersModule {}
