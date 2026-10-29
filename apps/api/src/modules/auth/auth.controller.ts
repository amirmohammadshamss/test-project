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
import { AuthService } from './auth.service';
import { AuthRequest, SessionGuard } from '../../common/auth';
import { LoginDto } from '../../common/dto';
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.authenticate(input.email, input.password);
    const token = await this.jwt.signAsync({
      sub: user.userId,
      membershipId: user.membershipId,
      branchId: user.branchId,
    });
    res.cookie('session', token, {
      httpOnly: true,
      secure:
        process.env.COOKIE_SECURE === 'true' ||
        (process.env.NODE_ENV === 'production' &&
          process.env.COOKIE_SECURE !== 'false'),
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 3600000,
    });
    return { role: user.role, name: user.name };
  }
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('session', {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure:
        process.env.COOKIE_SECURE === 'true' ||
        (process.env.NODE_ENV === 'production' &&
          process.env.COOKIE_SECURE !== 'false'),
    });
    return { ok: true };
  }
  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: AuthRequest) {
    return this.auth.me(req.actor);
  }
}
