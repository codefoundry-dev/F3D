import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { VendorInviteService } from './vendor-invite.service';
import { VendorUserInviteService } from './vendor-user-invite.service';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule],
  controllers: [VendorsController],
  providers: [VendorsService, VendorInviteService, VendorUserInviteService],
  exports: [VendorsService, VendorInviteService, VendorUserInviteService],
})
export class VendorsModule {}
