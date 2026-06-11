import { CreateBomDto } from '@forethread/shared-types';
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
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.$transaction(async (tx) => {
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
