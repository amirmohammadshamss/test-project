import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  PlatformAdminGuard,
  PlatformRequest,
} from '../../../common/platform-auth';
import { Platform } from '../application/platform';
import { PlatformMonitoring } from '../monitoring';
import { LifecycleDto, PlatformPageDto, ProvisionDto } from './dto';
@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformController {
  constructor(
    @Inject(Platform) private readonly platform: Platform,
    @Inject(PlatformMonitoring) private readonly monitoring: PlatformMonitoring,
  ) {}
  @Get('dashboard') dashboard(@Query() q: PlatformPageDto) {
    return this.platform.dashboard(q);
  }
  @Get('restaurants') restaurants(@Query() q: PlatformPageDto) {
    return this.platform.restaurants(q);
  }
  @Get('restaurants/:id') restaurant(@Param('id', ParseUUIDPipe) id: string) {
    return this.platform.restaurant(id);
  }
  @Get('restaurants/:id/branches') branches(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.platform.branches(id);
  }
  @Post('restaurants') create(
    @Req() r: PlatformRequest,
    @Body() x: ProvisionDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.platform.create(r.platform, x, key || '');
  }
  @Post('restaurants/:id/suspend') suspend(
    @Req() r: PlatformRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() x: LifecycleDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.platform.lifecycle(r.platform, id, 'SUSPENDED', x, key || '');
  }
  @Post('restaurants/:id/activate') activate(
    @Req() r: PlatformRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() x: LifecycleDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.platform.lifecycle(r.platform, id, 'ACTIVE', x, key || '');
  }
  @Get('audit-logs') audits(@Query() q: PlatformPageDto) {
    return this.platform.audits(q);
  }
  @Get('queues') queues() {
    return this.monitoring.queues();
  }
  @Get('health') health() {
    return this.monitoring.health();
  }
}
