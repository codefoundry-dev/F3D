import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { EmailBrand } from '../notifications/email.service';
import { StorageService } from '../storage/storage.service';

import type { PdfBrand } from './pdf-export.service';

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
   * Resolve a company's email brand: display name + public logo URL. Returns
   * `undefined` when the company is unknown or has no logo, so the email simply
   * renders without a logo header.
   */
  async getEmailBrand(companyId?: string | null): Promise<EmailBrand | undefined> {
    const company = await this.findCompany(companyId);
    if (!company?.logoUrl) return undefined;

    return { name: company.legalName, logoUrl: this.storage.getPublicUrl(company.logoUrl) };
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
   * Fetch logo bytes from object storage. pdfkit only renders PNG and JPEG, so any
   * other format (SVG, WebP, …) is skipped rather than risk a render error.
   */
  private async loadLogoBytes(key: string): Promise<Buffer | undefined> {
    if (!/\.(png|jpe?g)$/i.test(key)) return undefined;
    try {
      const { body } = await this.storage.getObject(key);
      return body ?? undefined;
    } catch {
      return undefined;
    }
  }
}
