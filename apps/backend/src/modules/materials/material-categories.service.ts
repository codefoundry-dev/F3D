import {
  type MaterialCategoryDto,
  CreateMaterialCategoryDto,
  UpdateMaterialCategoryDto,
} from '@forethread/shared-types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MaterialCategory, Prisma } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Fallback bucket for materials with no category (BOM quick-add, imports
 * lacking a main category). Resolved by NAME, so it can never be renamed or
 * deactivated.
 */
export const UNCATEGORISED = 'Uncategorised';

type CategoryWithCount = MaterialCategory & { _count: { materials: number } };

/**
 * Global material categories (FOR-362). Super Admin creates, renames and
 * deactivates them at runtime. A deactivated category stays on the materials
 * already filed under it (and in the filters), but pickers stop offering it
 * and create / recategorise requests targeting it are rejected.
 */
@Injectable()
export class MaterialCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every category, active or not — callers filter for pickers. */
  async listCategories(): Promise<MaterialCategoryDto[]> {
    const categories = await this.prisma.materialCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { materials: true } } },
    });
    return categories.map(toDto);
  }

  async createCategory(dto: CreateMaterialCategoryDto): Promise<MaterialCategoryDto> {
    const name = normaliseName(dto.name);
    await this.assertNameAvailable(name);
    const created = await this.createOrConflict(name);
    return toDto(created);
  }

  async updateCategory(id: string, dto: UpdateMaterialCategoryDto): Promise<MaterialCategoryDto> {
    const existing = await this.prisma.materialCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(ERR.materials.categoryNotFound);

    const name = dto.name !== undefined ? normaliseName(dto.name) : undefined;
    const renaming = name !== undefined && name !== existing.name;
    const deactivating = dto.isActive === false && existing.isActive;

    if (existing.name === UNCATEGORISED && (renaming || deactivating)) {
      throw new BadRequestException(ERR.materials.categoryProtected);
    }
    if (renaming && name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameAvailable(name, id);
    }

    try {
      const updated = await this.prisma.materialCategory.update({
        where: { id },
        data: {
          ...(renaming ? { name } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        include: { _count: { select: { materials: true } } },
      });
      return toDto(updated);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(ERR.materials.categoryDuplicateName);
      }
      throw err;
    }
  }

  /**
   * Resolve a category a material is being filed under. 404 when it doesn't
   * exist; 400 when it's been deactivated — unless the material already sits
   * in it (`currentCategoryId`), so editing other fields never forces a move.
   */
  async assertAssignable(id: string, currentCategoryId?: string): Promise<string> {
    const category = await this.prisma.materialCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException(ERR.materials.categoryNotFound);
    if (category.isActive === false && id !== currentCategoryId) {
      throw new BadRequestException(ERR.materials.categoryInactive);
    }
    return id;
  }

  /** Case-insensitive uniqueness, so "Timber" and "timber" can't coexist. */
  private async assertNameAvailable(name: string, excludeId?: string): Promise<void> {
    const clash = await this.prisma.materialCategory.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException(ERR.materials.categoryDuplicateName);
  }

  private async createOrConflict(name: string): Promise<CategoryWithCount> {
    try {
      return await this.prisma.materialCategory.create({
        data: { name },
        include: { _count: { select: { materials: true } } },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException(ERR.materials.categoryDuplicateName);
      }
      throw err;
    }
  }
}

function normaliseName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) throw new BadRequestException(ERR.materials.categoryNameRequired);
  return name;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function toDto(c: CategoryWithCount): MaterialCategoryDto {
  return {
    id: c.id,
    name: c.name,
    isActive: c.isActive,
    materialCount: c._count.materials,
  };
}
