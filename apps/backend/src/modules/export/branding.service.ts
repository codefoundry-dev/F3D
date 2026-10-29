import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { EmailBrand } from '../notifications/email.service';
import { StorageService } from '../storage/storage.service';

import type { PdfBrand } from './pdf-export.service';

/** Presign window for logos embedded in emails. Emails are opened long after
 *  they're sent, so we request the SigV4 maximum (7 days). NOTE: when the backend
 *  signs with the EC2 instance role (staging/prod), the URL is also bound to the
 *  lifetime of those temporary credentials, so it can stop working sooner than 7
 *  days. A permanently-loading email logo needs a public image proxy or CDN —
 *  tracked as a follow-up. Most mail clients (Gmail/Outlook) proxy-cache the image
 *  on first open, which masks the expiry in practice. */
const EMAIL_LOGO_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Resolves a company's branding (name + logo) for generated documents and emails
 * (FOR-267).
 *
 * Documents and vendor-facing emails carry the *issuing* company's logo so they
 * reflect the buyer's brand rather than the platform. When a company has no logo
 * set, callers fall back to the plain "Forethread" wordmark — branding must never
 * be a reason a document or email fails to generate.
 */
@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Resolve a company's PDF brand: display name + logo bytes for pdfkit. Returns
   * `undefined` — signalling the "Forethread" text fallback — when the company is
   * unknown, has no logo, the logo is an unsupported format, or its bytes can't be
   * fetched.
   */
  async getPdfBrand(companyId?: string | null): Promise<PdfBrand | undefined> {
    const company = await this.findCompany(companyId);
    if (!company?.logoUrl) return undefined;

    const logo = await this.loadLogoBytes(company.logoUrl);
    if (!logo) return undefined;

    return { name: company.legalName, logo };
  }

  /**
   * Resolve a company's email brand: display name, plus a presigned logo URL when
   * the company has a logo. Every known company is branded (FOR-383) — a missing
   * logo only drops the image, never the company name — so `undefined` means the
   * company is unknown and the email renders the plain platform layout. The
   * uploads bucket blocks public access, so the raw object URL 403s in mail
   * clients — a presigned URL is required (see {@link EMAIL_LOGO_URL_TTL_SECONDS}
   * for the expiry caveat).
   */
  async getEmailBrand(companyId?: string | null): Promise<EmailBrand | undefined> {
    const company = await this.findCompany(companyId);
    if (!company) return undefined;
    if (!company.logoUrl) return { name: company.legalName };

    return {
      name: company.legalName,
      logoUrl: await this.storage.getSignedUrl(company.logoUrl, EMAIL_LOGO_URL_TTL_SECONDS),
    };
  }

  private findCompany(
    companyId?: string | null,
  ): Promise<{ legalName: string; logoUrl: string | null } | null> {
    if (!companyId) return Promise.resolve(null);
    return this.prisma.company.findUnique({
      where: { id: companyId },
      select: { legalName: true, logoUrl: true },
    });
  }

  /**
   * Fetch logo bytes from object storage in a format pdfkit can draw (FOR-389).
   * pdfkit only renders PNG and JPEG, but uploads also accept SVG and WebP, and
   * keys can lack an extension (or be `.jfif`) — so the format is sniffed from the
   * bytes, not the key, and anything that isn't PNG/JPEG is rasterised to PNG.
   */
  private async loadLogoBytes(key: string): Promise<Buffer | undefined> {
    let body: Buffer | undefined;
    try {
      body = (await this.storage.getObject(key)).body ?? undefined;
    } catch {
      return undefined;
    }
    if (!body?.length) return undefined;
    if (isPng(body) || isJpeg(body)) return body;
    return rasteriseLogo(body);
  }
}

function isPng(buf: Buffer): boolean {
  return buf.length >= 4 && buf.readUInt32BE(0) === 0x89504e47;
}

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

/** Bounding box for rasterised logos — 4× the 120×36pt header slot, so print stays crisp. */
const LOGO_RASTER_BOX = { width: 480, height: 144 } as const;

/**
 * Convert an SVG/WebP/other image to PNG with sharp. sharp is a native module and
 * is loaded lazily: if it can't load, or the bytes aren't an image, the caller
 * falls back to the text wordmark rather than failing the document.
 */
async function rasteriseLogo(buf: Buffer): Promise<Buffer | undefined> {
  try {
    const { default: sharp } = await import('sharp');
    return await sharp(buf, { density: 300 })
      .resize({ ...LOGO_RASTER_BOX, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    return undefined;
  }
}
