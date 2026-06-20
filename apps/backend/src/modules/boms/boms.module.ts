import { Module } from '@nestjs/common';

import { MaterialsModule } from '../materials/materials.module';

import { BomsController } from './boms.controller';
import { BomsService } from './boms.service';

@Module({
  // MaterialsModule exports MaterialsService, used to record per-user material
  // usage (US 4.04) when a BOM line references a catalogue material.
  imports: [MaterialsModule],
  controllers: [BomsController],
  providers: [BomsService],
  exports: [BomsService],
})
export class BomsModule {}
