import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ExportModule } from '../export/export.module';
import { StorageModule } from '../storage/storage.module';

import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyExportService } from './company-export.service';

@Module({
  imports: [PrismaModule, StorageModule, AuditModule, ExportModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyExportService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
