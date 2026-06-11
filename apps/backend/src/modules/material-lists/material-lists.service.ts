import {
  MaterialListDetailDto,
  MaterialListSummaryDto,
  MaterialListsQueryDto,
} from '@forethread/shared-types';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const materialListDetailInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      material: {
        select: {
          id: true,
          name: true,
          uom: true,
          manufacturer: true,
          description: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.MaterialListInclude;

/**
 * Saved material lists (US 5.05): reusable, company-scoped collections of
 * catalogue materials that buyers pick during RFQ creation to pre-fill line
 * items. Read-only in this release — lists are seeded/managed out of band.
 */
@Injectable()
export class MaterialListsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMaterialLists(
    query: MaterialListsQueryDto,
    user: AuthenticatedUser,
  ): Promise<MaterialListSummaryDto[]> {
    const companyId = user.companyId;
    if (!companyId) throw new ForbiddenException(ERR.general.accessDenied);

    const search = query.search?.trim();
    const lists = await this.prisma.materialList.findMany({
      where: {
        companyId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    });

    return lists.map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description,
      itemCount: list._count.items,
      updatedAt: list.updatedAt.toISOString(),
    }));
  }

  async getMaterialList(id: string, user: AuthenticatedUser): Promise<MaterialListDetailDto> {
    const companyId = user.companyId;
    if (!companyId) throw new ForbiddenException(ERR.general.accessDenied);

    const list = await this.prisma.materialList.findFirst({
      where: { id, companyId },
      include: materialListDetailInclude,
    });
    if (!list) throw new NotFoundException(ERR.materialLists.notFound);

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      items: list.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        material: {
          id: item.material.id,
          name: item.material.name,
          uom: item.material.uom,
          manufacturer: item.material.manufacturer,
          description: item.material.description,
          category: { id: item.material.category.id, name: item.material.category.name },
        },
      })),
    };
  }
}
