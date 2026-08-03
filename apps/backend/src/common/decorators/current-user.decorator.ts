import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  /**
   * Custom-role assignment (FOR-253). When set, the custom role's permission
   * grants replace the built-in role's for this user. Optional so existing
   * fixtures/tests that build an AuthenticatedUser literal keep compiling —
   * absent means "no custom role".
   */
  customRoleId?: string | null;
}

/** Extracts the authenticated user from the JWT-validated request */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
