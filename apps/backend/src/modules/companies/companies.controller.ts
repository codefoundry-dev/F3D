import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';
import { PrismaService } from '../../prisma/prisma.service';
import { DocIntelligenceService } from '../doc-intelligence/doc-intelligence.service';
import { StorageService } from '../storage/storage.service';

import {
  CompaniesService,
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyListQueryDto,
  AssignVendorsDto,
  UploadCompanyDocumentDto,
} from './companies.service';
import { CompanyExportService } from './company-export.service';

interface AuthUser {
  id: string;
  role: string;
  companyId: string | null;
}

const DOCUMENT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DOCUMENT_ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
];
const DOCUMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
];
/** Some browsers/OSes report generic types for otherwise-valid files
 *  (e.g. Windows reports CSV as text/plain or application/octet-stream),
 *  so a generic mimetype falls back to the extension check alone. */
const GENERIC_MIME_TYPES = ['application/octet-stream', 'text/plain', ''];
/** FOR-259: extraction needs the real content type, but the validation above
 *  deliberately accepts generic mimetypes when the extension is valid —
 *  recover the type from the extension so those uploads still reach OCR. */
const DOCUMENT_EXTENSION_MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  private readonly logger = new Logger(CompaniesController.name);

  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companyExportService: CompanyExportService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
    private readonly docIntelligence: DocIntelligenceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List companies (SuperAdmin: all; CompanyAdmin: own only)' })
  @ApiResponse({ status: 200, description: 'Paginated company list' })
  async listCompanies(@Query() query: CompanyListQueryDto, @CurrentUser() user: AuthUser) {
    const result = await this.companiesService.listCompanies(query, user);
    const items = await Promise.all(result.items.map((item) => this.resolveLogoUrl(item)));
    return { ...result, items };
  }

  @Post()
  @RequirePermissions('company.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new company' })
  @ApiResponse({ status: 201, description: 'Company created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  createCompany(@Body() dto: CreateCompanyDto, @CurrentUser() user: AuthUser) {
    return this.companiesService.createCompany(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get company by ID' })
  @ApiResponse({ status: 200, description: 'Company details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getCompany(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const result = await this.companiesService.getCompany(id, user);
    return this.resolveLogoUrl(result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update company (SuperAdmin or own CompanyAdmin)' })
  @ApiResponse({ status: 200, description: 'Updated company' })
  updateCompany(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.companiesService.updateCompany(id, dto, user);
  }

  @Get(':id/vendors')
  @ApiOperation({ summary: 'Get vendors assigned to a contractor company' })
  @ApiResponse({ status: 200, description: 'List of assigned vendors' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getCompanyVendors(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertCompanyScope(id, user);
    return this.companiesService.getCompanyVendors(id);
  }

  @Post(':id/vendors')
  @RequirePermissions('company.assignVendors')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign vendors to a contractor company' })
  @ApiResponse({ status: 201, description: 'Vendors assigned' })
  assignVendors(
    @Param('id') id: string,
    @Body() dto: AssignVendorsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.companiesService.assignVendorsToContractor(id, dto, user);
  }

  @Delete(':id/vendors/:vendorId')
  @RequirePermissions('company.removeVendorAssignment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove vendor from contractor company' })
  @ApiResponse({ status: 200, description: 'Vendor unassigned' })
  removeVendor(@Param('id') id: string, @Param('vendorId') vendorId: string) {
    return this.companiesService.removeVendorFromContractor(id, vendorId);
  }

  // ── Company Logo ──────────────────────────────────────────────────────────

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload company logo' })
  @ApiConsumes('multipart/form-data')
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCompanyScope(id, user);
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.mimetype)) {
      throw new BadRequestException(ERR.storage.onlyImagesAllowed);
    }
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException(ERR.storage.fileTooLarge('5MB'));

    const ext = path.extname(file.originalname);
    const key = `logos/${id}/${randomUUID()}${ext}`;

    const result = await this.storageService.upload(key, file.buffer, file.mimetype);

    // Save file record
    await this.prisma.file.create({
      data: {
        bucket: result.bucket,
        key: result.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: user.id,
      },
    });

    await this.prisma.company.update({
      where: { id },
      data: { logoUrl: result.key },
    });

    return { id, logoUrl: await this.storageService.getSignedUrl(result.key) };
  }

  // Deliberately NOT company-scoped: logos render cross-company (vendor logos
  // on RFQ/PO views, message-sender branding), so any authenticated user may
  // resolve any company's logo URL.
  @Get(':id/logo-url')
  @ApiOperation({ summary: 'Get a presigned URL for the company logo' })
  @ApiResponse({ status: 200, description: 'Logo URL' })
  async getLogoUrl(@Param('id') id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { logoUrl: true },
    });
    if (!company?.logoUrl) return { url: null };
    return { url: await this.storageService.getSignedUrl(company.logoUrl) };
  }

  // ── Company Documents ─────────────────────────────────────────────────────

  @Get(':id/documents')
  @RequirePermissions('company.readDocuments')
  @ApiOperation({ summary: 'List company documents' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getDocuments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertCompanyScope(id, user);
    return this.prisma.companyDocument.findMany({
      where: { companyId: id },
      include: { file: { include: { uploadedBy: { select: { email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':id/documents')
  @RequirePermissions('company.uploadDocument')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload company document' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Body() body: UploadCompanyDocumentDto,
  ) {
    this.assertCompanyScope(id, user);
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);

    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk =
      DOCUMENT_ALLOWED_MIME_TYPES.includes(file.mimetype) ||
      GENERIC_MIME_TYPES.includes(file.mimetype ?? '');
    if (!DOCUMENT_ALLOWED_EXTENSIONS.includes(ext) || !mimeOk) {
      throw new BadRequestException(ERR.storage.documentTypeNotAllowed);
    }
    if (file.size > DOCUMENT_MAX_FILE_SIZE)
      throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));

    const key = `documents/${id}/${randomUUID()}${ext}`;

    const result = await this.storageService.upload(key, file.buffer, file.mimetype);

    const fileRecord = await this.prisma.file.create({
      data: {
        bucket: result.bucket,
        key: result.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: user.id,
      },
    });

    const document = await this.prisma.companyDocument.create({
      data: {
        companyId: id,
        type: body.type ?? 'OTHER',
        fileId: fileRecord.id,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      include: { file: true },
    });

    // FOR-259: OCR-first data extraction for the uploaded document.
    // Fire-and-forget — the upload response never waits on the pipeline.
    this.startDocumentExtraction({
      companyId: id,
      companyDocumentId: document.id,
      fileId: fileRecord.id,
      mimeType: GENERIC_MIME_TYPES.includes(file.mimetype ?? '')
        ? (DOCUMENT_EXTENSION_MIME_TYPES[ext] ?? file.mimetype)
        : file.mimetype,
      data: file.buffer,
      userId: user.id,
      body,
    });

    return document;
  }

  /**
   * Kick off the Google-OCR + LLM extraction for a just-uploaded company
   * document (FOR-259). Fire-and-forget, mirroring the invoice intake: the
   * document row is already committed, so extraction problems must never
   * fail the upload. The autofill flags let the pipeline fill in only the
   * fields the uploader left blank (document type, expiry date).
   */
  private startDocumentExtraction(input: {
    companyId: string;
    companyDocumentId: string;
    fileId: string;
    mimeType: string;
    data: Buffer;
    userId: string;
    body: UploadCompanyDocumentDto;
  }): void {
    void this.docIntelligence
      .createVendorDocumentExtraction({
        companyId: input.companyId,
        companyDocumentId: input.companyDocumentId,
        createdByUserId: input.userId,
        fileId: input.fileId,
        mimeType: input.mimeType,
        data: input.data,
        autofillType: !input.body.type,
        autofillExpiresAt: !input.body.expiresAt,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to start extraction for company document ${input.companyDocumentId}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }

  // ── Company Documents Export ─────────────────────────────────────────────

  @Get(':id/documents/export/:format')
  @RequirePermissions('company.readDocuments')
  @ApiOperation({ summary: 'Export company documents as PDF or CSV' })
  @ApiResponse({ status: 200, description: 'Export file URL' })
  @ApiResponse({ status: 400, description: 'Invalid format' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportDocuments(
    @Param('id') id: string,
    @Param('format') format: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCompanyScope(id, user);
    const normalized = format.toUpperCase();
    if (normalized === 'PDF') {
      return this.companyExportService.exportDocumentsToPDF(id);
    }
    if (normalized === 'CSV') {
      return this.companyExportService.exportDocumentsToCSV(id);
    }
    throw new BadRequestException(ERR.export.invalidFormatPdfCsv);
  }

  // ── Company Profile PDF ─────────────────────────────────────────────────

  @Get(':id/profile/export')
  @ApiOperation({ summary: 'Export company profile as invoice-style PDF' })
  @ApiResponse({ status: 200, description: 'PDF file URL' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async exportCompanyProfile(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertCompanyScope(id, user);
    return this.companyExportService.exportCompanyProfilePDF(id);
  }

  @Delete(':id/documents/:docId')
  @RequirePermissions('company.deleteDocument')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete company document' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async deleteDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCompanyScope(id, user);
    const doc = await this.prisma.companyDocument.findFirst({
      where: { id: docId, companyId: id },
      include: { file: true },
    });

    if (!doc) throw new BadRequestException(ERR.invoices.documentNotFound);

    await this.storageService.delete(doc.file.key);
    await this.prisma.companyDocument.delete({ where: { id: docId } });
    await this.prisma.file.delete({ where: { id: doc.fileId } });

    return { message: 'Document deleted' };
  }

  /** Non-SUPER_ADMIN users may only touch their own company's resources
   *  (documents, logo, exports, vendor assignments) — a permission key alone
   *  does not stop a Company A user from targeting Company B by id. */
  private assertCompanyScope(companyId: string, user: AuthUser): void {
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
  }

  /** Convert the S3 key stored in `logoUrl` to a short-lived presigned GET URL.
   *  The uploads bucket blocks public access (see StorageService.getPublicUrl),
   *  so a presigned URL is the only way the browser can load the object. */
  private async resolveLogoUrl<T extends { logoUrl: string | null }>(item: T): Promise<T> {
    if (item.logoUrl) {
      return { ...item, logoUrl: await this.storageService.getSignedUrl(item.logoUrl) };
    }
    return item;
  }
}
