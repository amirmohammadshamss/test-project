import { Global, Module } from '@nestjs/common';
import {
  RoleGuard,
  SessionGuard,
  RestaurantSessionAuthenticator,
} from './auth';
@Global()
@Module({
  providers: [RoleGuard, SessionGuard, RestaurantSessionAuthenticator],
  exports: [RoleGuard, SessionGuard, RestaurantSessionAuthenticator],
})
export class SecurityModule {}
