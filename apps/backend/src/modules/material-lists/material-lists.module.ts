import { Module } from '@nestjs/common';

import { MaterialListsController } from './material-lists.controller';
import { MaterialListsService } from './material-lists.service';

@Module({
  controllers: [MaterialListsController],
  providers: [MaterialListsService],
  exports: [MaterialListsService],
})
export class MaterialListsModule {}
