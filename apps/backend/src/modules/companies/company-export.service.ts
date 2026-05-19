import { Injectable, NotFoundException } from '@nestjs/common';

import { ERR } from '../../common/constants/error-messages.const';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfExportService } from '../export/pdf-export.service';

@Injectable()
export class CompanyExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfExportService: PdfExportService,
  ) {}

  // ── Documents table export ─────────────────────────────────────────────

  async exportDocumentsToPDF(companyId: string): Promise<{ url: string }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { legalName: true, tradeName: true },
    });

    const documents = await this.prisma.companyDocument.findMany({
      where: { companyId },
      include: { file: { include: { uploadedBy: { select: { email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    const companyName = company?.tradeName ?? company?.legalName ?? 'Company';

    return this.pdfExportService.exportToPDF({
      title: `${companyName} — Documents`,
      columns: [
        { header: 'Filename', width: 200 },
        { header: 'Type', width: 80 },
        { header: 'Uploaded By', width: 140 },
        { header: 'Date', width: 90 },
      ],
      rows: documents.map((doc) => ({
        Filename: doc.file.filename,
        Type: doc.type,
        'Uploaded By': doc.file.uploadedBy?.email ?? '—',
        Date: formatDateAU(doc.createdAt),
      })),
      filenamePrefix: 'company-documents',
    });
  }

  async exportDocumentsToCSV(companyId: string): Promise<{ url: string }> {
    const documents = await this.prisma.companyDocument.findMany({
      where: { companyId },
      include: { file: { include: { uploadedBy: { select: { email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    return this.pdfExportService.exportToCSV({
      headers: ['Filename', 'Type', 'Uploaded By', 'Date', 'Expires At'],
      rows: documents.map((doc) => [
        doc.file.filename,
        doc.type,
        doc.file.uploadedBy?.email ?? '',
        formatDateAU(doc.createdAt),
        doc.expiresAt ? formatDateAU(doc.expiresAt) : '',
      ]),
      filenamePrefix: 'company-documents',
    });
  }

  // ── Company profile invoice-style PDF ──────────────────────────────────

  async exportCompanyProfilePDF(companyId: string): Promise<{ url: string }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: { select: { users: true, projects: true, documents: true } },
        documents: {
          include: { file: { select: { filename: true, mimeType: true, size: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!company) throw new NotFoundException(ERR.companies.notFoundGeneric);

    const companyName = company.tradeName ?? company.legalName;
    const now = new Date().toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // Build info blocks
    const detailLines: string[] = [
      companyName,
      company.type,
      company.abn ? `ABN: ${company.abn}` : '',
      company.taxCode ? `Tax Code: ${company.taxCode}` : '',
      company.legalAddress ?? '',
    ].filter(Boolean);

    const contactLines: string[] = [
      company.contactEmail ?? '',
      company.contactPhone ? `Phone: ${company.contactPhone}` : '',
      company.website ?? '',
      company.specialisations.length > 0
        ? `Specialisations: ${company.specialisations.join(', ')}`
        : '',
      `Status: ${company.status}`,
    ].filter(Boolean);

    // Documents as table rows
    const docRows = company.documents.map((doc) => ({
      Document: doc.file.filename,
      Type: doc.type,
      Size: formatFileSize(doc.file.size),
      Date: formatDateAU(doc.createdAt),
    }));

    return this.pdfExportService.exportInvoicePDF({
      heading: 'Company Profile',
      date: now,
      infoLeft: { label: 'Company Details', lines: detailLines },
      infoRight: { label: 'Contact', lines: contactLines },
      columns: [
        { header: 'Document', width: 220 },
        { header: 'Type', width: 80 },
        { header: 'Size', width: 70 },
        { header: 'Date', width: 90 },
      ],
      rows: docRows,
      totalRow: {
        label: 'Summary',
        value: `${company._count.users} users · ${company._count.projects} projects · ${company._count.documents} docs`,
      },
      filenamePrefix: `company-profile_${company.legalName.toLowerCase().replace(/\s+/g, '-')}`,
    });
  }
}

function formatDateAU(date: Date): string {
  return new Date(date).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
