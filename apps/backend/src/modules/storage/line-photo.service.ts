import { randomUUID } from 'crypto';
import * as path from 'path';

import { BadRequestException, Injectable } from '@nestjs/common';

import { ERR } from '../../common/constants/error-messages.const';
import { PrismaService } from '../../prisma/prisma.service';

import { StorageService } from './storage.service';

export const LINE_PHOTO_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const LINE_PHOTO_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Storage key prefix; also how a File row is recognised as a line photo. */
const LINE_PHOTO_KEY_PREFIX = 'line-photos/';

export interface LinePhotoUploadResult {
  /** Goes on the request line as `photoFileId`. */
  fileId: string;
  fileName: string;
  /** Short-lived URL so the form can preview what was uploaded. */
  url: string | null;
}

/**
 * Requester-uploaded photos of a line item (FOR-404). A material request is
 * created in a single call, so the photo is uploaded first and its file id
 * rides on the line; the same File is then referenced from the RFQ / PO line
 * the request is converted into.
 */
@Injectable()
export class LinePhotoService {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /** Validate and store a photo, owned by the uploader until a line claims it. */
  async upload(
    file: Express.Multer.File | undefined,
    uploadedById: string,
  ): Promise<LinePhotoUploadResult> {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (!LINE_PHOTO_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(ERR.storage.onlyImagesAllowed);
    }
    if (file.size > LINE_PHOTO_MAX_FILE_SIZE) {
      throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));
    }

    const ext = path.extname(file.originalname);
    const key = `${LINE_PHOTO_KEY_PREFIX}${uploadedById}/${randomUUID()}${ext}`;
    const stored = await this.storageService.upload(key, file.buffer, file.mimetype);

    const record = await this.prisma.file.create({
      data: {
        bucket: stored.bucket,
        key: stored.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById,
      },
      select: { id: true, filename: true, key: true },
    });

    let url: string | null = null;
    try {
      url = await this.storageService.getSignedUrl(record.key);
    } catch {
      // The upload succeeded; only the preview is unavailable.
    }
    return { fileId: record.id, fileName: record.filename, url };
  }

  /**
   * Every id must be a line photo the caller uploaded. Without this a request
   * could attach any file id it guessed, and the read path would then hand out
   * a signed URL for someone else's document.
   */
  async assertOwnedPhotos(fileIds: (string | undefined | null)[], userId: string): Promise<void> {
    const ids = [...new Set(fileIds.filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return;

    const files = await this.prisma.file.findMany({
      where: {
        id: { in: ids },
        uploadedById: userId,
        key: { startsWith: LINE_PHOTO_KEY_PREFIX },
      },
      select: { id: true },
    });
    if (files.length !== ids.length) {
      throw new BadRequestException(ERR.materialRequests.invalidLinePhoto);
    }
  }
}
