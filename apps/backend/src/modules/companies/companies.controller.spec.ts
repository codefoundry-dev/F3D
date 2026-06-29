import { BadRequestException } from '@nestjs/common';

import { CompaniesController } from './companies.controller';
import { CompaniesService, CompanyListQueryDto, AssignVendorsDto } from './companies.service';
import { CompanyExportService } from './company-export.service';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let companiesService: jest.Mocked<CompaniesService>;
  let companyExportService: {
    exportDocumentsToPDF: jest.Mock;
    exportDocumentsToCSV: jest.Mock;
    exportCompanyProfilePDF: jest.Mock;
  };
  let storageService: {
    upload: jest.Mock;
    getSignedUrl: jest.Mock;
    getPublicUrl: jest.Mock;
    delete: jest.Mock;
  };
  let prisma: {
    file: { create: jest.Mock; delete: jest.Mock };
    company: { update: jest.Mock; findUnique: jest.Mock };
    companyDocument: {
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };

  const superAdmin = { id: 'u1', role: 'SUPER_ADMIN', companyId: null };

  beforeEach(() => {
    companiesService = {
      listCompanies: jest.fn(),
      createCompany: jest.fn(),
      getCompany: jest.fn(),
      updateCompany: jest.fn(),
      getCompanyVendors: jest.fn(),
      assignVendorsToContractor: jest.fn(),
      removeVendorFromContractor: jest.fn(),
    } as unknown as jest.Mocked<CompaniesService>;

    companyExportService = {
      exportDocumentsToPDF: jest.fn(),
      exportDocumentsToCSV: jest.fn(),
      exportCompanyProfilePDF: jest.fn(),
    };

    storageService = {
      upload: jest.fn(),
      getSignedUrl: jest.fn((key: string) => Promise.resolve(`https://signed.test/${key}?sig=abc`)),
      getPublicUrl: jest.fn((key: string) => `http://localhost:9000/forethread-dev/${key}`),
      delete: jest.fn(),
    };

    prisma = {
      file: { create: jest.fn(), delete: jest.fn() },
      company: { update: jest.fn(), findUnique: jest.fn() },
      companyDocument: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };

    controller = new CompaniesController(
      companiesService,
      companyExportService as unknown as CompanyExportService,
      storageService as never,
      prisma as never,
    );
  });

  describe('listCompanies', () => {
    it('should delegate to service', async () => {
      const query: CompanyListQueryDto = { page: 1, limit: 25 };
      const expected = { items: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } };
      companiesService.listCompanies.mockResolvedValue(expected);

      const result = await controller.listCompanies(query, superAdmin);

      expect(companiesService.listCompanies).toHaveBeenCalledWith(query, superAdmin);
      expect(result).toEqual(expected);
    });
  });

  describe('createCompany', () => {
    it('should delegate to service', async () => {
      const dto = { type: 'CONTRACTOR' as never, legalName: 'Acme' };
      const expected = { id: 'c1', ...dto };
      companiesService.createCompany.mockResolvedValue(expected as never);

      const result = await controller.createCompany(dto, superAdmin);

      expect(companiesService.createCompany).toHaveBeenCalledWith(dto, superAdmin);
      expect(result).toEqual(expected);
    });
  });

  describe('getCompany', () => {
    it('should delegate to service with id and user', async () => {
      const expected = { id: 'c1', legalName: 'Acme' };
      companiesService.getCompany.mockResolvedValue(expected as never);

      const result = await controller.getCompany('c1', superAdmin);

      expect(companiesService.getCompany).toHaveBeenCalledWith('c1', superAdmin);
      expect(result).toEqual(expected);
    });
  });

  describe('updateCompany', () => {
    it('should delegate to service with id, dto, and user', async () => {
      const dto = { legalName: 'Acme Updated' };
      const expected = { id: 'c1', legalName: 'Acme Updated' };
      companiesService.updateCompany.mockResolvedValue(expected as never);

      const result = await controller.updateCompany('c1', dto, superAdmin);

      expect(companiesService.updateCompany).toHaveBeenCalledWith('c1', dto, superAdmin);
      expect(result).toEqual(expected);
    });
  });

  describe('getCompanyVendors', () => {
    it('should delegate to service', async () => {
      const expected = [{ id: 'v1', legalName: 'Vendor Co' }];
      companiesService.getCompanyVendors.mockResolvedValue(expected as never);

      const result = await controller.getCompanyVendors('c1');

      expect(companiesService.getCompanyVendors).toHaveBeenCalledWith('c1');
      expect(result).toEqual(expected);
    });
  });

  describe('assignVendors', () => {
    it('should delegate to service', async () => {
      const dto: AssignVendorsDto = { contractorIds: ['v1', 'v2'] };
      const expected = [{ id: 'v1' }, { id: 'v2' }];
      companiesService.assignVendorsToContractor.mockResolvedValue(expected as never);

      const result = await controller.assignVendors('c1', dto, superAdmin);

      expect(companiesService.assignVendorsToContractor).toHaveBeenCalledWith(
        'c1',
        dto,
        superAdmin,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('removeVendor', () => {
    it('should delegate to service', async () => {
      const expected = { message: 'Vendor unassigned successfully' };
      companiesService.removeVendorFromContractor.mockResolvedValue(expected);

      const result = await controller.removeVendor('c1', 'v1');

      expect(companiesService.removeVendorFromContractor).toHaveBeenCalledWith('c1', 'v1');
      expect(result).toEqual(expected);
    });
  });

  describe('uploadLogo', () => {
    const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
      ({
        originalname: 'logo.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('fake'),
        ...overrides,
      }) as Express.Multer.File;

    it('should upload logo and update company', async () => {
      const file = makeFile();
      storageService.upload.mockResolvedValue({ bucket: 'b', key: 'logos/c1/uuid.png' });
      prisma.file.create.mockResolvedValue({ id: 'f1' });
      prisma.company.update.mockResolvedValue({ id: 'c1', logoUrl: 'logos/c1/uuid.png' });

      const result = await controller.uploadLogo('c1', file, superAdmin);

      expect(storageService.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^logos\/c1\/.+\.png$/),
        file.buffer,
        'image/png',
      );
      expect(prisma.file.create).toHaveBeenCalled();
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { logoUrl: 'logos/c1/uuid.png' },
      });
      expect(result).toEqual({
        id: 'c1',
        logoUrl: 'https://signed.test/logos/c1/uuid.png?sig=abc',
      });
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(controller.uploadLogo('c1', undefined as never, superAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid mime type', async () => {
      const file = makeFile({ mimetype: 'application/pdf' });

      await expect(controller.uploadLogo('c1', file, superAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when file is too large', async () => {
      const file = makeFile({ size: 10 * 1024 * 1024 });

      await expect(controller.uploadLogo('c1', file, superAdmin)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getLogoUrl', () => {
    it('should return a presigned URL when logo exists', async () => {
      prisma.company.findUnique.mockResolvedValue({ logoUrl: 'logos/c1/logo.png' });

      const result = await controller.getLogoUrl('c1');

      expect(result).toEqual({ url: 'https://signed.test/logos/c1/logo.png?sig=abc' });
    });

    it('should return null URL when company has no logo', async () => {
      prisma.company.findUnique.mockResolvedValue({ logoUrl: null });

      const result = await controller.getLogoUrl('c1');

      expect(result).toEqual({ url: null });
    });

    it('should return null URL when company is not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      const result = await controller.getLogoUrl('c1');

      expect(result).toEqual({ url: null });
    });
  });

  describe('getDocuments', () => {
    it('should return company documents from prisma', async () => {
      const docs = [{ id: 'd1', companyId: 'c1', file: { id: 'f1' } }];
      prisma.companyDocument.findMany.mockResolvedValue(docs);

      const result = await controller.getDocuments('c1');

      expect(prisma.companyDocument.findMany).toHaveBeenCalledWith({
        where: { companyId: 'c1' },
        include: { file: { include: { uploadedBy: { select: { email: true } } } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(docs);
    });
  });

  describe('uploadDocument', () => {
    const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
      ({
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('fake'),
        ...overrides,
      }) as Express.Multer.File;

    it('should upload document and create records', async () => {
      const file = makeFile();
      storageService.upload.mockResolvedValue({ bucket: 'b', key: 'documents/c1/uuid.pdf' });
      prisma.file.create.mockResolvedValue({ id: 'f1' });
      prisma.companyDocument.create.mockResolvedValue({ id: 'd1', fileId: 'f1' });

      const result = await controller.uploadDocument('c1', file, superAdmin, { type: 'INSURANCE' });

      expect(storageService.upload).toHaveBeenCalled();
      expect(prisma.file.create).toHaveBeenCalled();
      expect(prisma.companyDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'c1',
            type: 'INSURANCE',
            fileId: 'f1',
          }),
        }),
      );
      expect(result).toEqual({ id: 'd1', fileId: 'f1' });
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(
        controller.uploadDocument('c1', undefined as never, superAdmin, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file is too large', async () => {
      const file = makeFile({ size: 15 * 1024 * 1024 });

      await expect(controller.uploadDocument('c1', file, superAdmin, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should default type to Other and handle expiresAt', async () => {
      const file = makeFile();
      storageService.upload.mockResolvedValue({ bucket: 'b', key: 'documents/c1/uuid.pdf' });
      prisma.file.create.mockResolvedValue({ id: 'f1' });
      prisma.companyDocument.create.mockResolvedValue({ id: 'd2' });

      await controller.uploadDocument('c1', file, superAdmin, {
        expiresAt: '2027-01-01',
      });

      expect(prisma.companyDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'OTHER',
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should handle null expiresAt', async () => {
      const file = makeFile();
      storageService.upload.mockResolvedValue({ bucket: 'b', key: 'documents/c1/uuid.pdf' });
      prisma.file.create.mockResolvedValue({ id: 'f1' });
      prisma.companyDocument.create.mockResolvedValue({ id: 'd3' });

      await controller.uploadDocument('c1', file, superAdmin, {
        type: 'LICENSE',
      });

      expect(prisma.companyDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'LICENSE',
            expiresAt: null,
          }),
        }),
      );
    });
  });

  describe('exportDocuments', () => {
    it('exports documents to PDF', async () => {
      companyExportService.exportDocumentsToPDF.mockResolvedValue({
        url: 'https://storage/docs.pdf',
      });

      const result = await controller.exportDocuments('c1', 'pdf');

      expect(companyExportService.exportDocumentsToPDF).toHaveBeenCalledWith('c1');
      expect(result).toEqual({ url: 'https://storage/docs.pdf' });
    });

    it('exports documents to CSV', async () => {
      companyExportService.exportDocumentsToCSV.mockResolvedValue({
        url: 'https://storage/docs.csv',
      });

      const result = await controller.exportDocuments('c1', 'csv');

      expect(companyExportService.exportDocumentsToCSV).toHaveBeenCalledWith('c1');
      expect(result).toEqual({ url: 'https://storage/docs.csv' });
    });

    it('throws BadRequestException for invalid format', async () => {
      await expect(controller.exportDocuments('c1', 'xlsx')).rejects.toThrow(BadRequestException);
    });
  });

  describe('exportCompanyProfile', () => {
    it('delegates to export service', async () => {
      companyExportService.exportCompanyProfilePDF.mockResolvedValue({
        url: 'https://storage/profile.pdf',
      });

      const result = await controller.exportCompanyProfile('c1');

      expect(companyExportService.exportCompanyProfilePDF).toHaveBeenCalledWith('c1');
      expect(result).toEqual({ url: 'https://storage/profile.pdf' });
    });
  });

  describe('deleteDocument', () => {
    it('should delete document and associated file', async () => {
      prisma.companyDocument.findFirst.mockResolvedValue({
        id: 'd1',
        companyId: 'c1',
        fileId: 'f1',
        file: { id: 'f1', key: 'documents/c1/doc.pdf' },
      });
      storageService.delete.mockResolvedValue(undefined);
      prisma.companyDocument.delete.mockResolvedValue({});
      prisma.file.delete.mockResolvedValue({});

      const result = await controller.deleteDocument('c1', 'd1');

      expect(storageService.delete).toHaveBeenCalledWith('documents/c1/doc.pdf');
      expect(prisma.companyDocument.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
      expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
      expect(result).toEqual({ message: 'Document deleted' });
    });

    it('should throw BadRequestException when document is not found', async () => {
      prisma.companyDocument.findFirst.mockResolvedValue(null);

      await expect(controller.deleteDocument('c1', 'd1')).rejects.toThrow(BadRequestException);
    });
  });
});
