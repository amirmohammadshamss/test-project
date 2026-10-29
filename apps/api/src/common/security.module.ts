import { Global, Module } from '@nestjs/common';
import { RoleGuard, SessionGuard } from './auth';
@Global()
@Module({
  providers: [RoleGuard, SessionGuard],
  exports: [RoleGuard, SessionGuard],
})
export class SecurityModule {}
