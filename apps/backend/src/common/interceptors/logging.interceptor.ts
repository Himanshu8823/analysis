import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import type { JwtPayload } from '@/common/types';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const { method, url } = req;
    const now = Date.now();
    const userId = req.user?.sub ?? 'anonymous';

    this.logger.log(`-> ${method} ${url} [user:${userId}]`);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        this.logger.log(`<- ${method} ${url} - ${duration}ms [user:${userId}]`);
      })
    );
  }
}
