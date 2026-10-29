import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  AuthRequest,
  RoleGuard,
  Roles,
  SessionGuard,
} from '../../../common/auth';
import { MenuDto } from '../../../common/dto';
import { RestaurantAdmin } from '../application/admin';
import {
  CategoryDto,
  OrderPageDto,
  PageDto,
  SettingsDto,
  TableDto,
} from './dto';
@Controller('admin')
@UseGuards(SessionGuard, RoleGuard)
@Roles('MANAGER')
export class RestaurantAdminController {
  constructor(
    @Inject(RestaurantAdmin) private readonly admin: RestaurantAdmin,
  ) {}
  @Get('dashboard') dashboard(@Req() r: AuthRequest) {
    return this.admin.dashboard(r.actor);
  }
  @Get('orders') orders(@Req() r: AuthRequest, @Query() q: OrderPageDto) {
    return this.admin.orders(r.actor, q);
  }
  @Get('orders/:id') order(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.admin.order(r.actor, id);
  }
  @Get('tables') tables(@Req() r: AuthRequest) {
    return this.admin.tables(r.actor);
  }
  @Post('tables') createTable(@Req() r: AuthRequest, @Body() x: TableDto) {
    return this.admin.createTable(r.actor, x);
  }
  @Patch('tables/:id') updateTable(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() x: TableDto,
  ) {
    return this.admin.updateTable(r.actor, id, x);
  }
  @Get('menu/categories') categories(@Req() r: AuthRequest) {
    return this.admin.categories(r.actor);
  }
  @Post('menu/categories') createCategory(
    @Req() r: AuthRequest,
    @Body() x: CategoryDto,
  ) {
    return this.admin.createCategory(r.actor, x);
  }
  @Patch('menu/categories/:id') updateCategory(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() x: CategoryDto,
  ) {
    return this.admin.updateCategory(r.actor, id, x);
  }
  @Get('menu/items') items(@Req() r: AuthRequest, @Query() q: PageDto) {
    return this.admin.items(r.actor, q);
  }
  @Post('menu/items') createMenu(@Req() r: AuthRequest, @Body() x: MenuDto) {
    return this.admin.createMenu(r.actor, x);
  }
  @Patch('menu/items/:id') updateMenu(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() x: MenuDto,
  ) {
    return this.admin.updateMenu(r.actor, id, x);
  }
  @Get('staff') staff(@Req() r: AuthRequest, @Query() q: PageDto) {
    return this.admin.staff(r.actor, q);
  }
  @Get('settings') settings(@Req() r: AuthRequest) {
    return this.admin.settings(r.actor);
  }
  @Patch('settings') updateSettings(
    @Req() r: AuthRequest,
    @Body() x: SettingsDto,
  ) {
    return this.admin.updateSettings(r.actor, x);
  }
}
