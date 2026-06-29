import { BrandingService } from './branding.service';

describe('BrandingService', () => {
  let service: BrandingService;

  const mockFindUnique = jest.fn();
  const mockGetObject = jest.fn();
  const mockGetPublicUrl = jest.fn();

  const mockPrisma = { company: { findUnique: mockFindUnique } };
  const mockStorage = { getObject: mockGetObject, getPublicUrl: mockGetPublicUrl };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BrandingService(mockPrisma as never, mockStorage as never);
  });

  describe('getPdfBrand', () => {
    it('returns undefined (no DB hit) when no companyId is given', async () => {
      expect(await service.getPdfBrand(undefined)).toBeUndefined();
      expect(await service.getPdfBrand(null)).toBeUndefined();
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns undefined when the company is not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      expect(await service.getPdfBrand('comp-1')).toBeUndefined();
    });

    it('returns undefined when the company has no logo', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: null });
      expect(await service.getPdfBrand('comp-1')).toBeUndefined();
      expect(mockGetObject).not.toHaveBeenCalled();
    });

    it('skips unsupported logo formats without hitting storage', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/logo.svg' });
      expect(await service.getPdfBrand('comp-1')).toBeUndefined();
      expect(mockGetObject).not.toHaveBeenCalled();
    });

    it('returns name + logo bytes for a PNG logo', async () => {
      const bytes = Buffer.from('png-bytes');
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/logo.png' });
      mockGetObject.mockResolvedValue({ body: bytes });

      const brand = await service.getPdfBrand('comp-1');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        select: { legalName: true, logoUrl: true },
      });
      expect(mockGetObject).toHaveBeenCalledWith('logos/c1/logo.png');
      expect(brand).toEqual({ name: 'Acme', logo: bytes });
    });

    it('accepts JPG/JPEG logos (case-insensitive extension)', async () => {
      const bytes = Buffer.from('jpeg-bytes');
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/LOGO.JPG' });
      mockGetObject.mockResolvedValue({ body: bytes });

      expect(await service.getPdfBrand('comp-1')).toEqual({ name: 'Acme', logo: bytes });
    });

    it('returns undefined when storage yields no bytes', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/logo.png' });
      mockGetObject.mockResolvedValue({ body: null });
      expect(await service.getPdfBrand('comp-1')).toBeUndefined();
    });

    it('returns undefined when fetching the logo throws', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/logo.png' });
      mockGetObject.mockRejectedValue(new Error('S3 down'));
      expect(await service.getPdfBrand('comp-1')).toBeUndefined();
    });
  });

  describe('getEmailBrand', () => {
    it('returns undefined (no DB hit) when no companyId is given', async () => {
      expect(await service.getEmailBrand(undefined)).toBeUndefined();
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns undefined when the company has no logo', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: null });
      expect(await service.getEmailBrand('comp-1')).toBeUndefined();
      expect(mockGetPublicUrl).not.toHaveBeenCalled();
    });

    it('returns name + public logo URL when a logo is set', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/logo.png' });
      mockGetPublicUrl.mockReturnValue('https://cdn.test/logos/c1/logo.png');

      const brand = await service.getEmailBrand('comp-1');

      expect(mockGetPublicUrl).toHaveBeenCalledWith('logos/c1/logo.png');
      expect(brand).toEqual({ name: 'Acme', logoUrl: 'https://cdn.test/logos/c1/logo.png' });
    });
  });
});
