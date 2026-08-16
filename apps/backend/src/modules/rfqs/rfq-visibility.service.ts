import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/** The slice of an RFQ the visibility check needs. */
export interface RfqVisibilityTarget {
  id: string;
  companyId: string;
  createdByUserId: string;
}

/**
 * Project-based RFQ read access (FOR-351), shared by the RFQ detail read and
 * the quote sub-reads (detail / audit / comparison): SuperAdmin sees
 * everything, CompanyAdmin everything in their company, a vendor only RFQs
 * they were invited to, and every other role only the RFQs of projects they
 * are a member of (any project the RFQ spans) or that they created themselves.
 * Mirrors the scoping RfqsService.buildListWhere applies to the list.
 */
@Injectable()
export class RfqVisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async assertRfqVisible(user: AuthenticatedUser, rfq: RfqVisibilityTarget): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;

    if (user.role === UserRole.VENDOR) {
      const invited = await this.prisma.rfqVendor.findFirst({
        where: { rfqId: rfq.id, vendor: { users: { some: { id: user.id } } } },
        select: { id: true },
      });
      if (!invited) throw new ForbiddenException(ERR.general.accessDenied);
      return;
    }

    if (user.companyId !== rfq.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
    if (user.role === UserRole.COMPANY_ADMIN) return;
    if (rfq.createdByUserId === user.id) return;

    const membership = await this.prisma.projectMember.findFirst({
      where: {
        userId: user.id,
        project: {
          OR: [{ rfqs: { some: { id: rfq.id } } }, { rfqProjects: { some: { rfqId: rfq.id } } }],
        },
      },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException(ERR.general.accessDenied);
  }
}
