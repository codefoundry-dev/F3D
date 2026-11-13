import { randomUUID } from 'crypto';
import * as path from 'path';

import { BadRequestException, Injectable } from '@nestjs/common';

import { ERR } from '../../common/constants/error-messages.const';
import { PrismaService } from '../../prisma/prisma.service';

import { StorageService } from './storage.service';

export const LOGO_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
export const LOGO_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Stores a company logo. Shared by the two upload routes — a contractor's own
 * logo (`POST /companies/:id/logo`) and a vendor's logo
 * (`POST /vendors/:id/logo`). Each route checks who may upload; this
 * service only validates the file and saves it.
 */
@Injectable()
export class CompanyLogoService {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /** Validate, upload and attach the logo. Returns a presigned URL for display. */
  async save(
    companyId: string,
    file: Express.Multer.File | undefined,
    uploadedById: string,
  ): Promise<{ id: string; logoUrl: string }> {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (!LOGO_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(ERR.storage.onlyImagesAllowed);
    }
    if (file.size > LOGO_MAX_FILE_SIZE) {
      throw new BadRequestException(ERR.storage.fileTooLarge('5MB'));
    }

    const ext = path.extname(file.originalname);
    const key = `logos/${companyId}/${randomUUID()}${ext}`;

    const result = await this.storageService.upload(key, file.buffer, file.mimetype);

    await this.prisma.file.create({
      data: {
        bucket: result.bucket,
        key: result.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById,
      },
    });

    await this.prisma.company.update({
      where: { id: companyId },
      data: { logoUrl: result.key },
    });

    return { id: companyId, logoUrl: await this.storageService.getSignedUrl(result.key) };
  }
}
