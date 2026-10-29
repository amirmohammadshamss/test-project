import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrderQueries } from '../application/queries';
import { Orders } from '../application/orders';
import {
  AuthRequest,
  RoleGuard,
  Roles,
  SessionGuard,
} from '../../../common/auth';
import {
  AddItemDto,
  CompleteDto,
  CreateOrderDto,
  UpdateItemDto,
} from '../../../common/dto';
import { BusinessError } from '../domain/rules';
@Controller()
@UseGuards(SessionGuard, RoleGuard)
export class OrdersController {
  constructor(
    @Inject(Orders) private readonly orders: Orders,
    @Inject(OrderQueries) private readonly queries: OrderQueries,
  ) {}
  @Get('tables')
  @Roles('MANAGER', 'WAITER')
  tables(@Req() req: AuthRequest) {
    return this.queries.tables(req.actor);
  }
  @Get('tables/:id')
  @Roles('MANAGER', 'WAITER')
  table(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.queries.table(req.actor, id);
  }
  @Get('orders') list(@Req() req: AuthRequest) {
    return this.queries.list(req.actor);
  }
  @Get('orders/:id') get(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.queries.get(req.actor, id);
  }
  @Post('orders')
  @Roles('MANAGER', 'WAITER')
  create(
    @Req() req: AuthRequest,
    @Body() input: CreateOrderDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.orders.create(req.actor, input.tableId, key || '');
  }
  @Post('orders/:id/items')
  @Roles('MANAGER', 'WAITER')
  add(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AddItemDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.orders.add(
      req.actor,
      id,
      input.menuItemId,
      input.quantity,
      key || '',
    );
  }
  @Patch('orders/:id/items/:itemId')
  @Roles('MANAGER', 'WAITER', 'KITCHEN')
  update(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() input: UpdateItemDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.orders.update(
      req.actor,
      id,
      itemId,
      input.version,
      { quantity: input.quantity, status: input.status },
      key || '',
    );
  }
  @Post('orders/:id/complete')
  @Roles('MANAGER', 'WAITER')
  complete(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CompleteDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.orders.complete(req.actor, id, input.version, key || '');
  }
  @Get('kitchen/orders')
  @Roles('MANAGER', 'KITCHEN')
  kitchen(@Req() req: AuthRequest) {
    return this.queries.list(req.actor, true);
  }
  @Patch('kitchen/items/:itemId/status')
  @Roles('MANAGER', 'KITCHEN')
  async kitchenUpdate(
    @Req() req: AuthRequest,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() input: UpdateItemDto,
    @Headers('idempotency-key') key: string,
  ) {
    if (!input.status || input.quantity !== undefined)
      throw new BusinessError('INVALID_INPUT', 400);
    const orderId = await this.queries.orderForItem(req.actor, itemId);
    return this.orders.update(
      req.actor,
      orderId,
      itemId,
      input.version,
      { status: input.status },
      key || '',
    );
  }
}
