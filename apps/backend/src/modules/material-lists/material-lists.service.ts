import {
  AddMaterialListItemsDto,
  CreateMaterialListDto,
  MaterialListDetailDto,
  MaterialListSummaryDto,
  MaterialListsQueryDto,
  UpdateMaterialListDto,
} from '@forethread/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MaterialStatus, Prisma } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MaterialsService } from '../materials/materials.service';

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
          // Surfaced so the US 4.03 single-list table renders the same columns
          // as the catalogue (Status / Material type / UPC / Last Price / Updated).
          status: true,
          materialType: true,
          upc: true,
          pricePerUnit: true,
          currency: true,
          costCode: true,
          taxCode: true,
          imageUrl: true,
          updatedAt: true,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly materials: MaterialsService,
  ) {}

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
          // Prisma's MaterialStatus union ↔ shared-types' enum share string
          // values but are nominally distinct TS types (mirrors materials.service).
          status: item.material
            .status as MaterialListDetailDto['items'][number]['material']['status'],
          materialType: item.material.materialType,
          upc: item.material.upc,
          pricePerUnit:
            item.material.pricePerUnit !== null && item.material.pricePerUnit !== undefined
              ? item.material.pricePerUnit.toString()
              : null,
          currency: item.material.currency,
          costCode: item.material.costCode,
          taxCode: item.material.taxCode,
          imageUrl: item.material.imageUrl,
          updatedAt: item.material.updatedAt.toISOString(),
          category: { id: item.material.category.id, name: item.material.category.name },
        },
      })),
    };
  }

  // ── Create / update / delete (US 4.03) ────────────────────────────────────

  async createList(
    dto: CreateMaterialListDto,
    user: AuthenticatedUser,
  ): Promise<MaterialListSummaryDto> {
    const companyId = this.requireCompany(user);

    const list = await this.prisma.materialList.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        companyId,
        createdById: user.id,
      },
      include: { _count: { select: { items: true } } },
    });

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      itemCount: list._count.items,
      updatedAt: list.updatedAt.toISOString(),
    };
  }

  async updateList(
    id: string,
    dto: UpdateMaterialListDto,
    user: AuthenticatedUser,
  ): Promise<MaterialListSummaryDto> {
    await this.assertListInCompany(id, user);

    const list = await this.prisma.materialList.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
      include: { _count: { select: { items: true } } },
    });

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      itemCount: list._count.items,
      updatedAt: list.updatedAt.toISOString(),
    };
  }

  async deleteList(id: string, user: AuthenticatedUser): Promise<{ success: true }> {
    await this.assertListInCompany(id, user);
    // Items cascade (material_list_items.list_id ON DELETE CASCADE).
    await this.prisma.materialList.delete({ where: { id } });
    return { success: true };
  }

  // ── Item management (US 4.03) ─────────────────────────────────────────────

  async addItems(
    id: string,
    dto: AddMaterialListItemsDto,
    user: AuthenticatedUser,
  ): Promise<MaterialListDetailDto> {
    const companyId = await this.assertListInCompany(id, user);

    // Every material must be visible to the company (PUBLIC or own private,
    // US 4.02). De-duplicate the input ids first, then verify they all resolve.
    const materialIds = [...new Set(dto.materialIds)];
    const visible = await this.prisma.material.findMany({
      where: {
        id: { in: materialIds },
        OR: [{ status: MaterialStatus.PUBLIC }, { companyId }],
      },
      select: { id: true },
    });
    if (visible.length !== materialIds.length) {
      throw new BadRequestException(ERR.materialLists.invalidMaterialIds);
    }

    await this.prisma.materialListItem.createMany({
      data: materialIds.map((materialId) => ({ listId: id, materialId })),
      skipDuplicates: true,
    });

    // Touch the list so its updatedAt reflects the change (createMany doesn't).
    await this.prisma.materialList.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Record a per-user usage signal for the added materials (US 4.04), backing
    // the catalogue search "recently/frequently used" groups. Best-effort.
    await this.materials.recordMaterialUsage(user.id, materialIds);

    return this.getMaterialList(id, user);
  }

  async removeItem(
    id: string,
    itemId: string,
    user: AuthenticatedUser,
  ): Promise<MaterialListDetailDto> {
    await this.assertListInCompany(id, user);

    // Scoped to this list so an itemId from another list can't be removed.
    await this.prisma.materialListItem.deleteMany({ where: { id: itemId, listId: id } });

    await this.prisma.materialList.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return this.getMaterialList(id, user);
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  /** Require the user to belong to a company, returning its id (else 403). */
  private requireCompany(user: AuthenticatedUser): string {
    if (!user.companyId) throw new ForbiddenException(ERR.general.accessDenied);
    return user.companyId;
  }

  /**
   * Assert a list exists and belongs to the user's company, returning the
   * company id. A list owned by another company (or missing) is a 404 — never
   * a leak. Used as the write-path ownership guard.
   */
  private async assertListInCompany(id: string, user: AuthenticatedUser): Promise<string> {
    const companyId = this.requireCompany(user);
    const list = await this.prisma.materialList.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!list) throw new NotFoundException(ERR.materialLists.notFound);
    return companyId;
  }
}
