import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';

import { GeminiModule } from '../gemini/gemini.module';
import { StorageModule } from '../storage/storage.module';

import { DocIntelligenceController } from './doc-intelligence.controller';
import { DocIntelligenceService } from './doc-intelligence.service';

@Module({
  imports: [
    StorageModule,
    GeminiModule,
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [DocIntelligenceController],
  providers: [DocIntelligenceService],
  exports: [DocIntelligenceService],
})
export class DocIntelligenceModule {}
