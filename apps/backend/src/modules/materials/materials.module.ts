import { Module } from '@nestjs/common';

import { MaterialStatusService } from './material-status.service';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  controllers: [MaterialsController],
  providers: [MaterialsService, MaterialStatusService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
