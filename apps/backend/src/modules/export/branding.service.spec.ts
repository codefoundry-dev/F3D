import { BrandingService } from './branding.service';

describe('BrandingService', () => {
  let service: BrandingService;

  const mockFindUnique = jest.fn();
  const mockGetObject = jest.fn();
  const mockGetSignedUrl = jest.fn();

  const mockPrisma = { company: { findUnique: mockFindUnique } };
  const mockStorage = { getObject: mockGetObject, getSignedUrl: mockGetSignedUrl };

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
      expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('returns name + a presigned logo URL when a logo is set', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/logo.png' });
      mockGetSignedUrl.mockResolvedValue('https://signed.test/logos/c1/logo.png?sig=abc');

      const brand = await service.getEmailBrand('comp-1');

      // Presign with the 7-day max so the logo survives until the email is opened.
      expect(mockGetSignedUrl).toHaveBeenCalledWith('logos/c1/logo.png', 7 * 24 * 60 * 60);
      expect(brand).toEqual({
        name: 'Acme',
        logoUrl: 'https://signed.test/logos/c1/logo.png?sig=abc',
      });
    });
  });
});
