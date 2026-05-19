import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';

import { ERR } from '../../common/constants/error-messages.const';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

import { StorageService } from './storage.service';

interface AuthUser {
  id: string;
  role: string;
  companyId: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  async uploadFile(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(ERR.storage.fileTypeNotAllowed);
    }

    const ext = path.extname(file.originalname);
    const key = `uploads/${randomUUID()}${ext}`;

    const result = await this.storageService.upload(key, file.buffer, file.mimetype);

    const record = await this.prisma.file.create({
      data: {
        bucket: result.bucket,
        key: result.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: user.id,
      },
    });

    return record;
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Get signed URL for a file' })
  async getFileUrl(@Param('id') id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new BadRequestException(ERR.storage.fileNotFound);

    const objectExists = await this.storageService.exists(file.key);
    if (!objectExists) throw new BadRequestException(ERR.storage.fileNotFound);

    const url = await this.storageService.getSignedUrl(file.key);
    return { url };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(@Param('id') id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new BadRequestException(ERR.storage.fileNotFound);

    await this.storageService.delete(file.key);
    await this.prisma.file.delete({ where: { id } });

    return { message: 'File deleted' };
  }
}
