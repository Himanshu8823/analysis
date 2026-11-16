import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * The metadata under which the *matching mode* is stored.
 *
 * A route may need **any one of** several permissions rather than all of
 * them. Without this, the only way to express "the exam cell's right or the
 * teacher's right" was to guard on a permission both hold — which is how
 * `POST /upload/jobs/:jobId/confirm` came to be guarded on `upload:read`, a
 * *read* right, while it writes marks.
 *
 * The mode is stored separately from the permission list so that the guard
 * keeps its default (`every`) and the exception is visible at the call
 * site.
 */
export const PERMISSIONS_MODE_KEY = 'permissions-mode';

/**
 * How a route's permissions are matched.
 *
 * - `every` — the member must hold **all** of them. The default, because a
 *   route that names several permissions usually means "and".
 * - `some` — the member must hold **at least one** of them. For a route
 *   that several different roles may use, each through their own right.
 */
export type PermissionsMode = 'every' | 'some';

/**
 * Guards a route by the permission it needs.
 *
 * ```ts
 * @Permissions('marks:read')               // exactly this one
 * @Permissions('marks:read', 'marks:write') // all of them
 * @AnyPermission('upload:process', 'upload:process_own_subject') // one of them
 * ```
 */
export const Permissions = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Guards a route by **any one** of several permissions.
 *
 * A member qualifies when they hold at least one of them. This is for a
 * route that several roles may use, each through their own right — the
 * exam cell's right and a teacher's right are different permissions, and
 * neither is a superset of the other.
 *
 * *Why it exists:* without it, the only way to open such a route to both
 * groups was to name a permission both groups happen to hold. For the
 * upload-confirm route that was `upload:read` — a permission to *look* at
 * an upload — while the route itself writes marks. The permission that
 * guards a route should be the permission the route's effect needs.
 */
export const AnyPermission = (...permissions: string[]): MethodDecorator & ClassDecorator => {
  /**
   * The metadata is written directly rather than by composing two
   * `SetMetadata` decorators. Nest's `SetMetadata` returns a decorator whose
   * descriptor type is narrower than `MethodDecorator`'s, so composing two
   * of them does not type-check — and the composition buys nothing here
   * that `Reflect.defineMetadata` does not do in two lines.
   */
  return ((target: object, key: string | symbol, descriptor: PropertyDescriptor | undefined) => {
    Reflect.defineMetadata(PERMISSIONS_KEY, permissions, target, key);
    Reflect.defineMetadata(PERMISSIONS_MODE_KEY, 'some' satisfies PermissionsMode, target, key);
    return descriptor;
  }) as MethodDecorator & ClassDecorator;
};
