import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
}

/** Extracts the authenticated user from the JWT-validated request */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
