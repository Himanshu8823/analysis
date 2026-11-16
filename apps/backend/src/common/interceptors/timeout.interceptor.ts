import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * The metadata key under which a route's timeout is published.
 */
export const REQUEST_TIMEOUT_KEY = 'requestTimeoutMs';

/**
 * The default timeout for a request.
 *
 * Thirty seconds is generous for the product's normal work — a page load,
 * a list, a report. It is the floor, not the ceiling: a route that does
 * more than that says so.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Gives a route a longer timeout.
 *
 * Some work genuinely takes longer than the default — reading a syllabus
 * PDF means checking every page and then running a model over the text,
 * and neither step can be hurried. A route that declares a longer timeout
 * says so here rather than having the global default silently cut it off.
 */
export const RequestTimeout = (milliseconds: number): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUEST_TIMEOUT_KEY, milliseconds);

/**
 * The timeout a route may take.
 *
 * A route's own value wins. Otherwise the default applies.
 */
export function resolveRequestTimeout(reflector: Reflector, context: ExecutionContext): number {
  const declared = reflector.getAllAndOverride<number>(REQUEST_TIMEOUT_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);

  return typeof declared === 'number' && declared > 0 ? declared : DEFAULT_REQUEST_TIMEOUT_MS;
}

/**
 * Fails a request that takes too long.
 *
 * A request that hangs is worse than one that fails: the exam cell is
 * waiting on a review screen. The timeout turns a hang into a clear error
 * the user can retry.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const milliseconds = resolveRequestTimeout(this.reflector, context);

    return next.handle().pipe(
      timeout(milliseconds),
      catchError((err: unknown) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `This took longer than ${Math.round(milliseconds / 1000)} seconds and was stopped. Try again.`
              )
          );
        }
        return throwError(() => err);
      })
    );
  }
}
