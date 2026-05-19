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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

import {
  CompaniesService,
  CreateCompanyDto,
  UpdateCompanyDto,
  CompanyListQueryDto,
  AssignVendorsDto,
} from './companies.service';
import { CompanyExportService } from './company-export.service';

interface AuthUser {
  id: string;
  role: string;
  companyId: string | null;
}

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companyExportService: CompanyExportService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List companies (SuperAdmin: all; CompanyAdmin: own only)' })
  @ApiResponse({ status: 200, description: 'Paginated company list' })
  async listCompanies(@Query() query: CompanyListQueryDto, @CurrentUser() user: AuthUser) {
    const result = await this.companiesService.listCompanies(query, user);
    const items = result.items.map((item) => this.resolveLogoUrl(item));
    return { ...result, items };
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
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
  getCompanyVendors(@Param('id') id: string) {
    return this.companiesService.getCompanyVendors(id);
  }

  @Post(':id/vendors')
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
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
  @Roles(UserRole.SUPER_ADMIN)
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

    return { id, logoUrl: this.storageService.getPublicUrl(result.key) };
  }

  @Get(':id/logo-url')
  @ApiOperation({ summary: 'Get public URL for company logo' })
  @ApiResponse({ status: 200, description: 'Logo URL' })
  async getLogoUrl(@Param('id') id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { logoUrl: true },
    });
    if (!company?.logoUrl) return { url: null };
    return { url: this.storageService.getPublicUrl(company.logoUrl) };
  }

  // ── Company Documents ─────────────────────────────────────────────────────

  @Get(':id/documents')
  @ApiOperation({ summary: 'List company documents' })
  async getDocuments(@Param('id') id: string) {
    return this.prisma.companyDocument.findMany({
      where: { companyId: id },
      include: { file: { include: { uploadedBy: { select: { email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload company document' })
  @ApiConsumes('multipart/form-data')
  async uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
    @Body() body: { type?: string; expiresAt?: string },
  ) {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (file.size > 10 * 1024 * 1024)
      throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));

    const ext = path.extname(file.originalname);
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

    return this.prisma.companyDocument.create({
      data: {
        companyId: id,
        type: (body.type as 'INSURANCE' | 'LICENSE' | 'CERTIFICATION' | 'OTHER') ?? 'OTHER',
        fileId: fileRecord.id,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      include: { file: true },
    });
  }

  // ── Company Documents Export ─────────────────────────────────────────────

  @Get(':id/documents/export/:format')
  @ApiOperation({ summary: 'Export company documents as PDF or CSV' })
  @ApiResponse({ status: 200, description: 'Export file URL' })
  @ApiResponse({ status: 400, description: 'Invalid format' })
  async exportDocuments(@Param('id') id: string, @Param('format') format: string) {
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
  @ApiResponse({ status: 404, description: 'Company not found' })
  async exportCompanyProfile(@Param('id') id: string) {
    return this.companyExportService.exportCompanyProfilePDF(id);
  }

  @Delete(':id/documents/:docId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete company document' })
  async deleteDocument(@Param('id') id: string, @Param('docId') docId: string) {
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

  /** Convert S3 key stored in logoUrl to a public URL */
  private resolveLogoUrl<T extends { logoUrl: string | null }>(item: T): T {
    if (item.logoUrl) {
      return { ...item, logoUrl: this.storageService.getPublicUrl(item.logoUrl) };
    }
    return item;
  }
}
