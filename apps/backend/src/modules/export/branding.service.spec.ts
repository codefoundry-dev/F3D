import sharp from 'sharp';

import { BrandingService } from './branding.service';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const SVG_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="36"><rect width="120" height="36" fill="#f60"/></svg>',
);

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

    it('returns name + logo bytes for a PNG logo', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/logo.png' });
      mockGetObject.mockResolvedValue({ body: PNG_BYTES });

      const brand = await service.getPdfBrand('comp-1');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        select: { legalName: true, logoUrl: true },
      });
      expect(mockGetObject).toHaveBeenCalledWith('logos/c1/logo.png');
      expect(brand).toEqual({ name: 'Acme', logo: PNG_BYTES });
    });

    it('detects JPEG from the bytes, whatever the key extension (FOR-389)', async () => {
      // `.jfif` from phones, or no extension at all, used to be skipped.
      for (const logoUrl of ['logos/c1/LOGO.JPG', 'logos/c1/photo.jfif', 'logos/c1/logo']) {
        mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl });
        mockGetObject.mockResolvedValue({ body: JPEG_BYTES });
        expect(await service.getPdfBrand('comp-1')).toEqual({ name: 'Acme', logo: JPEG_BYTES });
      }
    });

    it('rasterises an SVG logo to PNG (FOR-389)', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/logo.svg' });
      mockGetObject.mockResolvedValue({ body: SVG_BYTES });

      const brand = await service.getPdfBrand('comp-1');

      expect(brand?.name).toBe('Acme');
      expect(brand?.logo.subarray(0, 4)).toEqual(PNG_BYTES.subarray(0, 4));
    });

    it('rasterises a WebP logo to PNG (FOR-389)', async () => {
      const webp = await sharp(SVG_BYTES).webp().toBuffer();
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/logo.webp' });
      mockGetObject.mockResolvedValue({ body: webp });

      const brand = await service.getPdfBrand('comp-1');

      expect(brand?.logo.subarray(0, 4)).toEqual(PNG_BYTES.subarray(0, 4));
    });

    it('falls back (undefined) when the bytes are not an image', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: 'logos/c1/logo.png' });
      mockGetObject.mockResolvedValue({ body: Buffer.from('not an image') });
      expect(await service.getPdfBrand('comp-1')).toBeUndefined();
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

    it('returns undefined when the company is not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      expect(await service.getEmailBrand('comp-1')).toBeUndefined();
    });

    it('still names the company when it has no logo (FOR-383)', async () => {
      mockFindUnique.mockResolvedValue({ legalName: 'Acme', logoUrl: null });
      expect(await service.getEmailBrand('comp-1')).toEqual({ name: 'Acme' });
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
