import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { ERR } from '../constants/error-messages.const';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const granted = await this.permissions.getPermissionsForRole(user.role);
    const missing = required.filter((key) => !granted.has(key));

    if (missing.length > 0) {
      throw new ForbiddenException(ERR.general.accessDeniedPermissions(missing.join(', ')));
    }

    return true;
  }
}
