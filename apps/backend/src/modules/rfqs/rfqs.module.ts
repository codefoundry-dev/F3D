import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';

import { AccessTokensModule } from '../access-tokens/access-tokens.module';
import { AuditModule } from '../audit/audit.module';
import { DocIntelligenceModule } from '../doc-intelligence/doc-intelligence.module';
import { ExportModule } from '../export/export.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

import { QuoteResponseService } from './quote-response.service';
import { RfqExportService } from './rfq-export.service';
import { RfqsController } from './rfqs.controller';
import { RfqsService } from './rfqs.service';

@Module({
  imports: [
    ExportModule,
    StorageModule,
    AuditModule,
    NotificationsModule,
    AccessTokensModule,
    DocIntelligenceModule,
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [RfqsController],
  providers: [RfqsService, RfqExportService, QuoteResponseService],
  exports: [RfqsService, QuoteResponseService],
})
export class RfqsModule {}
