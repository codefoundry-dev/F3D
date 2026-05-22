import { Global, Module } from '@nestjs/common';

import { ApprovalAuthorizationService } from './approval-authorization.service';
import { PermissionsBootstrap } from './permissions.bootstrap';
import { PermissionsService } from './permissions.service';

@Global()
@Module({
  providers: [PermissionsService, PermissionsBootstrap, ApprovalAuthorizationService],
  exports: [PermissionsService, ApprovalAuthorizationService],
})
export class PermissionsModule {}
