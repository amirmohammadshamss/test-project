import { TrafficLimiter, LoginRateGuard } from './traffic';
import {
  PlatformSessionAuthenticator,
  PlatformAdminGuard,
} from './platform-auth';
import { Global, Module } from '@nestjs/common';
import {
  RoleGuard,
  SessionGuard,
  RestaurantSessionAuthenticator,
  NotificationSessionGuard,
} from './auth';
@Global()
@Module({
  providers: [
    TrafficLimiter,
    LoginRateGuard,
    RoleGuard,
    SessionGuard,
    RestaurantSessionAuthenticator,
    NotificationSessionGuard,
    PlatformSessionAuthenticator,
    PlatformAdminGuard,
  ],
  exports: [
    TrafficLimiter,
    LoginRateGuard,
    RoleGuard,
    SessionGuard,
    RestaurantSessionAuthenticator,
    NotificationSessionGuard,
    PlatformSessionAuthenticator,
    PlatformAdminGuard,
  ],
})
export class SecurityModule {}
