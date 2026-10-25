import type { UserRole } from '@result-analysis/shared-types';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  branchId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
