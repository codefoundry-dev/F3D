import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';

import { PrismaModule } from '../../prisma/prisma.module';

import { CompanyLogoService } from './company-logo.service';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
    }),
  ],
  controllers: [StorageController],
  providers: [StorageService, CompanyLogoService],
  exports: [StorageService, CompanyLogoService],
})
export class StorageModule {}
