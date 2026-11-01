import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';

import { MaterialCategoriesService } from './material-categories.service';
import { MaterialStatusService } from './material-status.service';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MaterialsController],
  providers: [MaterialsService, MaterialStatusService, MaterialCategoriesService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
