import type { Prisma, PrismaClient } from '@prisma/client';

type CompanyReader = Pick<PrismaClient | Prisma.TransactionClient, 'company'>;

/**
 * The company's default general terms & conditions (FOR-398). Every PO
 * creation path snapshots this onto `PurchaseOrder.termsAndConditions`, so a
 * later edit to the default never rewrites a PO that was already issued.
 * Blank text counts as "no terms".
 */
export async function loadCompanyPoTerms(
  db: CompanyReader,
  companyId: string,
): Promise<string | null> {
  if (!companyId) return null;
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { poTermsAndConditions: true },
  });
  return normalisePoTerms(company?.poTermsAndConditions);
}

/** Trim T&C text; empty → null. */
export function normalisePoTerms(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return trimmed;
}
