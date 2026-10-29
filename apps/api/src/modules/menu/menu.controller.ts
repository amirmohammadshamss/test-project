import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthRequest, RoleGuard, Roles, SessionGuard } from '../../common/auth';
import { MenuDto } from '../../common/dto';
import { MenuService } from './menu.service';
@Controller('menu')
@UseGuards(SessionGuard, RoleGuard)
export class MenuController {
  constructor(@Inject(MenuService) private readonly menu: MenuService) {}
  @Get('categories') categories(@Req() req: AuthRequest) {
    return this.menu.categories(req.actor);
  }
  @Get('items') items(@Req() req: AuthRequest) {
    return this.menu.items(req.actor);
  }
  @Post('items') @Roles('MANAGER') create(
    @Req() req: AuthRequest,
    @Body() input: MenuDto,
  ) {
    return this.menu.create(req.actor, input);
  }
  @Patch('items/:id') @Roles('MANAGER') update(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MenuDto,
  ) {
    return this.menu.update(req.actor, id, input);
  }
}
