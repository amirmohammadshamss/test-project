import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthRequest, RoleGuard, Roles, SessionGuard } from '../../common/auth';
import { ApproveDto, DraftDto } from '../../common/dto';
import { AiService } from './ai.service';
@Controller('ai/menu-drafts')
@UseGuards(SessionGuard, RoleGuard)
@Roles('MANAGER')
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}
  @Post() request(
    @Req() req: AuthRequest,
    @Body() input: DraftDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.ai.request(req.actor, input, key);
  }
  @Get(':id') get(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ai.get(req.actor, id);
  }
  @Post(':id/approve') approve(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ApproveDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.ai.approve(req.actor, id, input, key);
  }
}
