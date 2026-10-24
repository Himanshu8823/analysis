import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as reachable while the user still has to change their
 * password.
 *
 * Without this the forced-password-change gate would lock the user out of the
 * very endpoint that clears the flag.
 */
export const ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChange';
export const AllowPasswordChange = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
