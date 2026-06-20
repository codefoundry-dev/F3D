import { CreateBomDto, UpdateBomDto } from '@forethread/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BomStatus, Prisma } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { nextSequentialNumber } from '../../common/utils/sequential-number.util';
import { PrismaService } from '../../prisma/prisma.service';
import { MaterialsService } from '../materials/materials.service';

const bomListInclude = {
  createdBy: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.BomInclude;

const bomDetailInclude = {
  ...bomListInclude,
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { matchedMaterial: { select: { id: true, name: true } } },
  },
} satisfies Prisma.BomInclude;

export type BomWithCounts = Prisma.BomGetPayload<{ include: typeof bomListInclude }>;
export type BomWithItems = Prisma.BomGetPayload<{ include: typeof bomDetailInclude }>;

/**
 * Project Bills of Materials (US 5.01). A BOM is created from a reviewed BOM
 * extraction; the newest BOM per project is ACTIVE and any previous ones are
 * flipped to SUPERSEDED in the same transaction ("Historical BOM versions").
 */
@Injectable()
export class BomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly materials: MaterialsService,
  ) {}

  async createBom(dto: CreateBomDto, user: AuthenticatedUser): Promise<BomWithItems> {
    const companyId = user.companyId;
    if (!companyId) throw new ForbiddenException(ERR.general.accessDenied);

    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException(ERR.projects.notFound);

    // Every line must already be matched to a real material (the review step
    // enforces this in the UI; re-validate here for nicer errors than a raw FK
    // violation).
    const materialIds = [...new Set(dto.items.map((item) => item.matchedMaterialId))];
    const materialCount = await this.prisma.material.count({
      where: { id: { in: materialIds } },
    });
    if (materialCount !== materialIds.length) {
      throw new BadRequestException(ERR.materials.notFound);
    }

    const bomNumber = await nextSequentialNumber(this.prisma, 'bom', 'BOM', companyId);

    const bom = await this.prisma.$transaction(async (tx) => {
      await tx.bom.updateMany({
        where: { projectId: dto.projectId, status: BomStatus.ACTIVE },
        data: { status: BomStatus.SUPERSEDED },
      });
      return tx.bom.create({
        data: {
          bomNumber,
          companyId,
          projectId: dto.projectId,
          extractionId: dto.extractionId ?? null,
          createdByUserId: user.id,
          items: {
            create: dto.items.map((item, index) => ({
              materialName: item.materialName,
              matchedMaterialId: item.matchedMaterialId,
              description: item.description ?? null,
              uom: item.uom ?? null,
              quantity: item.quantity ?? null,
              category: item.category ?? null,
              materialType: item.materialType ?? null,
              matchConfidence: item.matchConfidence ?? null,
              sortOrder: item.sortOrder ?? index,
            })),
          },
        },
        include: bomDetailInclude,
      });
    });

    // Record a per-user usage signal for the matched catalogue materials
    // (US 4.04), backing the catalogue search "recently/frequently used"
    // groups. Best-effort, outside the transaction so it never fails the create.
    await this.materials.recordMaterialUsage(
      user.id,
      dto.items.map((item) => item.matchedMaterialId),
    );

    return bom;
  }

  /**
   * Edit an existing BOM's line items IN PLACE (US 4.04 BOM editing). Unlike
   * {@link createBom} this does NOT supersede / create a new version: the whole
   * line-item set is replaced inside one transaction (delete existing items,
   * recreate from the payload preserving sortOrder) and the BOM's updatedAt is
   * touched. Editing is allowed regardless of ACTIVE/SUPERSEDED status. The BOM
   * must belong to the caller's company, else 404 (no leak).
   */
  async updateBom(id: string, dto: UpdateBomDto, user: AuthenticatedUser): Promise<BomWithItems> {
    const companyId = user.companyId;
    if (!companyId) throw new ForbiddenException(ERR.general.accessDenied);

    const existing = await this.prisma.bom.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(ERR.boms.notFound);

    // Re-validate matches against the catalogue (same as create) for a nicer
    // error than a raw FK violation. Skipped when the edit clears all lines.
    const materialIds = [...new Set(dto.items.map((item) => item.matchedMaterialId))];
    if (materialIds.length > 0) {
      const materialCount = await this.prisma.material.count({
        where: { id: { in: materialIds } },
      });
      if (materialCount !== materialIds.length) {
        throw new BadRequestException(ERR.materials.notFound);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.bomItem.deleteMany({ where: { bomId: id } });
      if (dto.items.length > 0) {
        await tx.bomItem.createMany({
          data: dto.items.map((item, index) => ({
            bomId: id,
            materialName: item.materialName,
            matchedMaterialId: item.matchedMaterialId,
            description: item.description ?? null,
            uom: item.uom ?? null,
            quantity: item.quantity ?? null,
            category: item.category ?? null,
            materialType: item.materialType ?? null,
            matchConfidence: item.matchConfidence ?? null,
            sortOrder: item.sortOrder ?? index,
          })),
        });
      }
      // Touch updatedAt — createMany/deleteMany don't bump it on the parent.
      return tx.bom.update({
        where: { id },
        data: { updatedAt: new Date() },
        include: bomDetailInclude,
      });
    });
  }

  async listBoms(projectId: string | undefined, user: AuthenticatedUser): Promise<BomWithCounts[]> {
    const companyId = user.companyId;
    if (!companyId) throw new ForbiddenException(ERR.general.accessDenied);

    return this.prisma.bom.findMany({
      where: { companyId, ...(projectId ? { projectId } : {}) },
      include: bomListInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBom(id: string, user: AuthenticatedUser): Promise<BomWithItems> {
    const companyId = user.companyId;
    if (!companyId) throw new ForbiddenException(ERR.general.accessDenied);

    const bom = await this.prisma.bom.findFirst({
      where: { id, companyId },
      include: bomDetailInclude,
    });
    if (!bom) throw new NotFoundException(ERR.boms.notFound);
    return bom;
  }
}
