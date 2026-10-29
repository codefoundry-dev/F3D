import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Asserts that a user may act on a vendor company. Rep-lifecycle authority is
 * relational (ADR-0016): the vendor acting on its own company, OR a contractor
 * whose company has a CompanyVendorAssignment to that vendor.
 */
export async function assertVendorAccess(
  prisma: PrismaService,
  vendorCompanyId: string,
  user: AuthenticatedUser,
): Promise<void> {
  // Vendor accessing own company
  if (user.role === UserRole.VENDOR) {
    if (user.companyId !== vendorCompanyId) {
      throw new ForbiddenException(ERR.vendors.accessDenied);
    }
    return;
  }

  // Contractor roles: check vendor is in their assignment list
  if (!user.companyId) {
    throw new ForbiddenException(ERR.vendors.accessDenied);
  }

  const assignment = await prisma.companyVendorAssignment.findFirst({
    where: {
      vendorId: vendorCompanyId,
      contractorId: user.companyId,
    },
  });

  if (!assignment) {
    throw new ForbiddenException(ERR.vendors.accessDenied);
  }
}

/**
 * A one-off vendor (FOR-395) serves only the project it was added for. Throws a
 * 400 when `vendorCompanyId` is a one-off of `contractorId` on a different
 * project; full vendors (and vendors with no assignment, which callers judge
 * themselves) pass.
 */
export async function assertVendorUsableOnProject(
  prisma: PrismaService,
  vendorCompanyId: string,
  contractorId: string,
  projectId: string,
): Promise<void> {
  const assignment = await prisma.companyVendorAssignment.findUnique({
    where: { vendorId_contractorId: { vendorId: vendorCompanyId, contractorId } },
    select: { oneOffProjectId: true },
  });
  if (assignment?.oneOffProjectId && assignment.oneOffProjectId !== projectId) {
    throw new BadRequestException(ERR.vendors.oneOffWrongProject);
  }
}
