import { LoginRateGuard } from '../../../common/traffic';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import {
  PlatformAdminGuard,
  PlatformRequest,
} from '../../../common/platform-auth';
import { LoginDto } from '../../../common/dto';
import { PlatformAuthService } from '../platform-auth.service';
const cookieOptions = () => ({
  httpOnly: true,
  secure:
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.NODE_ENV === 'production' &&
      process.env.COOKIE_SECURE !== 'false'),
  sameSite: 'strict' as const,
  path: '/',
});
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(PlatformAuthService) private readonly auth: PlatformAuthService,
  ) {}
  @UseGuards(LoginRateGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() x: LoginDto,
    @Req() req: PlatformRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.login(x.email, x.password, req.requestId);
    const token = await this.jwt.signAsync(
      { sub: user.userId, sid: user.sessionId, purpose: 'platform' },
      { audience: 'restaurantos-platform', expiresIn: '1h' },
    );
    res.cookie('platform_session', token, {
      ...cookieOptions(),
      maxAge: 3600000,
    });
    return { id: user.userId, name: user.name, productionReady: false };
  }
  @Post('logout') @HttpCode(200) @UseGuards(PlatformAdminGuard) async logout(
    @Req() req: PlatformRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.platform.sessionId);
    res.clearCookie('platform_session', cookieOptions());
    return { ok: true };
  }
  @Get('me') @UseGuards(PlatformAdminGuard) me(@Req() req: PlatformRequest) {
    return this.auth.me(req.platform.userId);
  }
}
