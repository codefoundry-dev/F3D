import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
