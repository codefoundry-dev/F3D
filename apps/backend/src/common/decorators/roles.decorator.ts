import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export { UserRole };

export const ROLES_KEY = 'roles';

/** Restrict endpoint access to specified roles */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
