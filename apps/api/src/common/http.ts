import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { BusinessError } from '../modules/orders/domain/rules';
import type { AuthRequest } from './auth';
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<AuthRequest>();
    const response = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let code = 'INTERNAL_ERROR';
    if (error instanceof BusinessError) {
      status = error.status;
      code = error.code;
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      code =
        status === 400
          ? 'INVALID_INPUT'
          : typeof error.getResponse() === 'string'
            ? String(error.getResponse())
            : error.message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' || error.code === 'P2034') {
        status = 409;
        code = 'DATABASE_CONFLICT';
      }
      if (error.code === 'P2025') {
        status = 404;
        code = 'NOT_FOUND';
      }
      if (error.code === 'P2003') {
        status = 400;
        code = 'INVALID_REFERENCE';
      }
    }
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        requestId: req.requestId,
        tenantId: req.actor?.tenantId,
        userId: req.actor?.userId || req.platform?.userId,
        platformAdminId: req.platform?.adminId,
        operation: req.method + ' ' + req.path,
        errorCode: code,
        module: 'http',
      }),
    );
    response
      .status(status)
      .json({ error: { code, message: code, requestId: req.requestId } });
  }
}
