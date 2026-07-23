import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { MaterialStatusService } from './material-status.service';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MaterialsController],
  providers: [MaterialsService, MaterialStatusService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
