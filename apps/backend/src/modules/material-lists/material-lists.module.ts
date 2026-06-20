import { Module } from '@nestjs/common';

import { MaterialsModule } from '../materials/materials.module';

import { MaterialListsController } from './material-lists.controller';
import { MaterialListsService } from './material-lists.service';

@Module({
  // MaterialsModule exports MaterialsService, used to record per-user material
  // usage (US 4.04) when items are added to a list.
  imports: [MaterialsModule],
  controllers: [MaterialListsController],
  providers: [MaterialListsService],
  exports: [MaterialListsService],
})
export class MaterialListsModule {}
