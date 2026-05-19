import { NotFoundException } from '@nestjs/common';

import { CompanyExportService } from './company-export.service';

describe('CompanyExportService', () => {
  let service: CompanyExportService;

  const mockPrisma = {
    company: {
      findUnique: jest.fn(),
    },
    companyDocument: {
      findMany: jest.fn(),
    },
  };

  const mockPdfExportService = {
    exportToPDF: jest.fn().mockResolvedValue({ url: 'https://signed.url/pdf' }),
    exportToCSV: jest.fn().mockResolvedValue({ url: 'https://signed.url/csv' }),
    exportInvoicePDF: jest.fn().mockResolvedValue({ url: 'https://signed.url/invoice-pdf' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CompanyExportService(mockPrisma as never, mockPdfExportService as never);
  });

  describe('exportDocumentsToPDF', () => {
    const companyId = 'company-123';

    it('exports documents to PDF with company trade name', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        legalName: 'Legal Co',
        tradeName: 'Trade Co',
      });
      mockPrisma.companyDocument.findMany.mockResolvedValue([
        {
          type: 'LICENSE',
          createdAt: new Date('2026-01-15'),
          file: { filename: 'license.pdf', uploadedBy: { email: 'user@test.com' } },
        },
      ]);

      const result = await service.exportDocumentsToPDF(companyId);

      expect(result).toEqual({ url: 'https://signed.url/pdf' });
      expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: companyId },
        select: { legalName: true, tradeName: true },
      });
      expect(mockPdfExportService.exportToPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Trade Co — Documents',
          filenamePrefix: 'company-documents',
        }),
      );
    });

    it('falls back to legal name when trade name is null', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        legalName: 'Legal Co',
        tradeName: null,
      });
      mockPrisma.companyDocument.findMany.mockResolvedValue([]);

      await service.exportDocumentsToPDF(companyId);

      expect(mockPdfExportService.exportToPDF).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Legal Co — Documents' }),
      );
    });

    it('falls back to "Company" when company is not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);
      mockPrisma.companyDocument.findMany.mockResolvedValue([]);

      await service.exportDocumentsToPDF(companyId);

      expect(mockPdfExportService.exportToPDF).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Company — Documents' }),
      );
    });

    it('maps document rows correctly with uploadedBy email', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        legalName: 'Co',
        tradeName: null,
      });
      mockPrisma.companyDocument.findMany.mockResolvedValue([
        {
          type: 'INSURANCE',
          createdAt: new Date('2026-03-10'),
          file: { filename: 'insurance.pdf', uploadedBy: { email: 'admin@co.com' } },
        },
        {
          type: 'LICENSE',
          createdAt: new Date('2026-02-20'),
          file: { filename: 'license.pdf', uploadedBy: null },
        },
      ]);

      await service.exportDocumentsToPDF(companyId);

      const callArgs = mockPdfExportService.exportToPDF.mock.calls[0][0];
      expect(callArgs.rows).toHaveLength(2);
      expect(callArgs.rows[0]).toEqual(
        expect.objectContaining({
          Filename: 'insurance.pdf',
          Type: 'INSURANCE',
          'Uploaded By': 'admin@co.com',
        }),
      );
      // Null uploadedBy should show dash
      expect(callArgs.rows[1]['Uploaded By']).toBe('—');
    });

    it('passes correct columns to exportToPDF', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ legalName: 'Co', tradeName: null });
      mockPrisma.companyDocument.findMany.mockResolvedValue([]);

      await service.exportDocumentsToPDF(companyId);

      const callArgs = mockPdfExportService.exportToPDF.mock.calls[0][0];
      expect(callArgs.columns).toEqual([
        { header: 'Filename', width: 200 },
        { header: 'Type', width: 80 },
        { header: 'Uploaded By', width: 140 },
        { header: 'Date', width: 90 },
      ]);
    });
  });

  describe('exportDocumentsToCSV', () => {
    const companyId = 'company-456';

    it('exports documents to CSV', async () => {
      mockPrisma.companyDocument.findMany.mockResolvedValue([
        {
          type: 'INSURANCE',
          createdAt: new Date('2026-01-10'),
          expiresAt: new Date('2027-01-10'),
          file: { filename: 'insurance.pdf', uploadedBy: { email: 'user@test.com' } },
        },
      ]);

      const result = await service.exportDocumentsToCSV(companyId);

      expect(result).toEqual({ url: 'https://signed.url/csv' });
      expect(mockPrisma.companyDocument.findMany).toHaveBeenCalledWith({
        where: { companyId },
        include: { file: { include: { uploadedBy: { select: { email: true } } } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('passes correct headers', async () => {
      mockPrisma.companyDocument.findMany.mockResolvedValue([]);

      await service.exportDocumentsToCSV(companyId);

      const callArgs = mockPdfExportService.exportToCSV.mock.calls[0][0];
      expect(callArgs.headers).toEqual(['Filename', 'Type', 'Uploaded By', 'Date', 'Expires At']);
      expect(callArgs.filenamePrefix).toBe('company-documents');
    });

    it('maps rows correctly with expiresAt', async () => {
      mockPrisma.companyDocument.findMany.mockResolvedValue([
        {
          type: 'LICENSE',
          createdAt: new Date('2026-06-15'),
          expiresAt: new Date('2027-06-15'),
          file: { filename: 'lic.pdf', uploadedBy: { email: 'a@b.com' } },
        },
      ]);

      await service.exportDocumentsToCSV(companyId);

      const callArgs = mockPdfExportService.exportToCSV.mock.calls[0][0];
      expect(callArgs.rows[0][0]).toBe('lic.pdf');
      expect(callArgs.rows[0][1]).toBe('LICENSE');
      expect(callArgs.rows[0][2]).toBe('a@b.com');
      // expiresAt should not be empty
      expect(callArgs.rows[0][4]).not.toBe('');
    });

    it('handles null expiresAt', async () => {
      mockPrisma.companyDocument.findMany.mockResolvedValue([
        {
          type: 'OTHER',
          createdAt: new Date('2026-01-01'),
          expiresAt: null,
          file: { filename: 'doc.pdf', uploadedBy: null },
        },
      ]);

      await service.exportDocumentsToCSV(companyId);

      const callArgs = mockPdfExportService.exportToCSV.mock.calls[0][0];
      expect(callArgs.rows[0][2]).toBe(''); // null uploadedBy
      expect(callArgs.rows[0][4]).toBe(''); // null expiresAt
    });

    it('handles empty documents list', async () => {
      mockPrisma.companyDocument.findMany.mockResolvedValue([]);

      const result = await service.exportDocumentsToCSV(companyId);

      expect(result).toEqual({ url: 'https://signed.url/csv' });
      const callArgs = mockPdfExportService.exportToCSV.mock.calls[0][0];
      expect(callArgs.rows).toEqual([]);
    });
  });

  describe('exportCompanyProfilePDF', () => {
    const companyId = 'company-789';

    const fullCompany = {
      id: companyId,
      legalName: 'Acme Legal Pty Ltd',
      tradeName: 'Acme',
      type: 'BUILDER',
      abn: '12345678901',
      taxCode: 'TX-001',
      legalAddress: '123 Main St, Sydney',
      contactEmail: 'info@acme.com',
      contactPhone: '+61 2 1234 5678',
      website: 'https://acme.com',
      specialisations: ['Electrical', 'Plumbing'],
      status: 'ACTIVE',
      _count: { users: 5, projects: 10, documents: 3 },
      documents: [
        {
          type: 'LICENSE',
          createdAt: new Date('2026-01-15'),
          file: { filename: 'license.pdf', mimeType: 'application/pdf', size: 1048576 },
        },
        {
          type: 'INSURANCE',
          createdAt: new Date('2026-02-20'),
          file: { filename: 'insurance.pdf', mimeType: 'application/pdf', size: 512000 },
        },
      ],
    };

    it('exports company profile as invoice-style PDF', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(fullCompany);

      const result = await service.exportCompanyProfilePDF(companyId);

      expect(result).toEqual({ url: 'https://signed.url/invoice-pdf' });
      expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: companyId },
        include: {
          _count: { select: { users: true, projects: true, documents: true } },
          documents: {
            include: { file: { select: { filename: true, mimeType: true, size: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });

    it('throws NotFoundException when company does not exist', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.exportCompanyProfilePDF(companyId)).rejects.toThrow(NotFoundException);
    });

    it('includes company details in infoLeft', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(fullCompany);

      await service.exportCompanyProfilePDF(companyId);

      const callArgs = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      expect(callArgs.infoLeft.label).toBe('Company Details');
      expect(callArgs.infoLeft.lines).toContain('Acme');
      expect(callArgs.infoLeft.lines).toContain('BUILDER');
      expect(callArgs.infoLeft.lines).toContain('ABN: 12345678901');
      expect(callArgs.infoLeft.lines).toContain('Tax Code: TX-001');
      expect(callArgs.infoLeft.lines).toContain('123 Main St, Sydney');
    });

    it('includes contact info in infoRight', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(fullCompany);

      await service.exportCompanyProfilePDF(companyId);

      const callArgs = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      expect(callArgs.infoRight.label).toBe('Contact');
      expect(callArgs.infoRight.lines).toContain('info@acme.com');
      expect(callArgs.infoRight.lines).toContain('Phone: +61 2 1234 5678');
      expect(callArgs.infoRight.lines).toContain('https://acme.com');
      expect(callArgs.infoRight.lines).toContain('Specialisations: Electrical, Plumbing');
      expect(callArgs.infoRight.lines).toContain('Status: ACTIVE');
    });

    it('includes totalRow with summary counts', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(fullCompany);

      await service.exportCompanyProfilePDF(companyId);

      const callArgs = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      expect(callArgs.totalRow).toEqual({
        label: 'Summary',
        value: '5 users · 10 projects · 3 docs',
      });
    });

    it('maps documents to table rows with formatted sizes', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(fullCompany);

      await service.exportCompanyProfilePDF(companyId);

      const callArgs = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      expect(callArgs.rows).toHaveLength(2);
      expect(callArgs.rows[0]).toEqual(
        expect.objectContaining({
          Document: 'license.pdf',
          Type: 'LICENSE',
          Size: '1.0 MB',
        }),
      );
      expect(callArgs.rows[1]).toEqual(
        expect.objectContaining({
          Document: 'insurance.pdf',
          Type: 'INSURANCE',
          Size: '500.0 KB',
        }),
      );
    });

    it('uses legal name when trade name is null', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        ...fullCompany,
        tradeName: null,
      });

      await service.exportCompanyProfilePDF(companyId);

      const callArgs = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      expect(callArgs.infoLeft.lines).toContain('Acme Legal Pty Ltd');
    });

    it('filters out empty detail lines (no abn, no taxCode)', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        ...fullCompany,
        abn: null,
        taxCode: null,
        legalAddress: null,
      });

      await service.exportCompanyProfilePDF(companyId);

      const callArgs = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      const lines = callArgs.infoLeft.lines as string[];
      expect(lines.every((l: string) => l.length > 0)).toBe(true);
      expect(lines).not.toContain('');
    });

    it('filters out empty contact lines', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        ...fullCompany,
        contactEmail: null,
        contactPhone: null,
        website: null,
        specialisations: [],
      });

      await service.exportCompanyProfilePDF(companyId);

      const callArgs = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      const lines = callArgs.infoRight.lines as string[];
      expect(lines.every((l: string) => l.length > 0)).toBe(true);
    });

    it('handles company with no documents', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        ...fullCompany,
        documents: [],
      });

      await service.exportCompanyProfilePDF(companyId);

      const callArgs = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      expect(callArgs.rows).toEqual([]);
    });

    it('formats filename prefix using lowercase legal name', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(fullCompany);

      await service.exportCompanyProfilePDF(companyId);

      const callArgs = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      expect(callArgs.filenamePrefix).toBe('company-profile_acme-legal-pty-ltd');
    });

    it('formats small file sizes in bytes', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        ...fullCompany,
        documents: [
          {
            type: 'OTHER',
            createdAt: new Date('2026-01-01'),
            file: { filename: 'tiny.txt', mimeType: 'text/plain', size: 500 },
          },
        ],
      });

      await service.exportCompanyProfilePDF(companyId);

      const callArgs = mockPdfExportService.exportInvoicePDF.mock.calls[0][0];
      expect(callArgs.rows[0].Size).toBe('500 B');
    });
  });
});
