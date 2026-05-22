import { Global, Module } from '@nestjs/common';

import { PermissionsBootstrap } from './permissions.bootstrap';
import { PermissionsService } from './permissions.service';

@Global()
@Module({
  providers: [PermissionsService, PermissionsBootstrap],
  exports: [PermissionsService],
})
export class PermissionsModule {}
