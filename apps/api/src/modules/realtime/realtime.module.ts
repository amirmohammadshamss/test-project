import { Global, Module } from '@nestjs/common';
import { RealtimeEventPublisher } from '../../common/application/realtime';
import { RestaurantEventsGateway } from './restaurant-events.gateway';
@Global()
@Module({
  providers: [
    RestaurantEventsGateway,
    { provide: RealtimeEventPublisher, useExisting: RestaurantEventsGateway },
  ],
  exports: [RealtimeEventPublisher],
})
export class RealtimeModule {}
