import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  Query,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { NotificationSessionGuard, AuthRequest } from '../../../common/auth';
import {
  PlatformAdminGuard,
  PlatformRequest,
} from '../../../common/platform-auth';
import { NotificationPrincipal } from '../../../../../../packages/notifications/src/domain';
import { Notifications } from '../application';
import { InboxDto, PreferencesDto, PushDto } from './dto';
export const restaurantPrincipal = (
  a: AuthRequest['actor'],
): NotificationPrincipal => ({
  realm: 'RESTAURANT',
  userId: a.userId,
  sessionId: a.sessionId!,
  membershipId: a.membershipId!,
  tenantId: a.tenantId,
  branchId: a.branchId,
  role: a.role,
  tenantStatus: a.tenantStatus,
});
export const platformPrincipal = (
  a: PlatformRequest['platform'],
): NotificationPrincipal => ({
  realm: 'PLATFORM',
  userId: a.userId,
  sessionId: a.sessionId,
  platformAdminId: a.adminId,
});
function p(req: AuthRequest | PlatformRequest) {
  return 'platform' in req && req.platform
    ? platformPrincipal(req.platform)
    : restaurantPrincipal((req as AuthRequest).actor);
}
// Two explicitly guarded contexts delegate to the same transport-independent use cases.
class NotificationHttp {
  constructor(
    @Inject(Notifications) protected readonly notifications: Notifications,
  ) {}
  @Get('notifications/context') context(
    @Req() r: AuthRequest | PlatformRequest,
  ) {
    const value = p(r);
    return { ...value, suspended: value.tenantStatus === 'SUSPENDED' };
  }
  @Get('notifications') list(
    @Req() r: AuthRequest | PlatformRequest,
    @Query() q: InboxDto,
  ) {
    return this.notifications.list(p(r), { ...q, unread: q.unread === 'true' });
  }
  @Get('notifications/unread-count') count(
    @Req() r: AuthRequest | PlatformRequest,
  ) {
    return this.notifications.count(p(r));
  }
  @Get('notifications/preferences') preferences(
    @Req() r: AuthRequest | PlatformRequest,
  ) {
    return this.notifications.preferences(p(r));
  }
  @Patch('notifications/preferences') save(
    @Req() r: AuthRequest | PlatformRequest,
    @Body() x: PreferencesDto,
  ) {
    return this.notifications.savePreferences(p(r), x);
  }
  @Post('notifications/read-all') readAll(
    @Req() r: AuthRequest | PlatformRequest,
  ) {
    return this.notifications.readAll(p(r));
  }
  @Patch('notifications/:id/read') read(
    @Req() r: AuthRequest | PlatformRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.mark(p(r), id);
  }
  @Post('notifications/:id/acknowledge') ack(
    @Req() r: AuthRequest | PlatformRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.mark(p(r), id, true);
  }
  @Get('push/subscriptions') devices(@Req() r: AuthRequest | PlatformRequest) {
    return this.notifications.devices(p(r));
  }
  @Post('push/subscriptions') register(
    @Req() r: AuthRequest | PlatformRequest,
    @Body() x: PushDto,
  ) {
    return this.notifications.register(
      p(r),
      { endpoint: x.endpoint, keys: x.keys },
      x.deviceLabel,
    );
  }
  @Delete('push/subscriptions/:id') remove(
    @Req() r: AuthRequest | PlatformRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.remove(p(r), id);
  }
}
@Controller()
@UseGuards(NotificationSessionGuard)
export class NotificationsController extends NotificationHttp {}
@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformNotificationsController extends NotificationHttp {
  @Get('notifications/delivery-health') deliveryHealth(
    @Req() r: PlatformRequest,
  ) {
    return this.notifications.deliveryHealth(platformPrincipal(r.platform));
  }
}
