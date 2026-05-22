import {
  CreateMaterialDto,
  MaterialListQueryDto,
  buildPaginationMeta,
} from '@forethread/shared-types';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MaterialStatus, Prisma, UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List Materials ──────────────────────────────────────────────────────────

  async listMaterials(query: MaterialListQueryDto, user: AuthenticatedUser) {
    const where = this.buildListWhere(query, user);
    const orderBy = this.buildOrderBy(query.sortBy ?? 'name', query.sortDir ?? 'asc');

    const [items, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.material.count({ where }),
    ]);

    return {
      items: items.map((m) => ({
        id: m.id,
        name: m.name,
        categoryId: m.category.id,
        categoryName: m.category.name,
        uom: m.uom,
        upc: m.upc,
        manufacturer: m.manufacturer,
        description: m.description,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
      meta: buildPaginationMeta(query.page ?? 1, query.take, total),
    };
  }

  // ── List Categories ─────────────────────────────────────────────────────────

  async listCategories() {
    const categories = await this.prisma.materialCategory.findMany({
      orderBy: { name: 'asc' },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
    }));
  }

  // ── Suggestions (quick search) ──────────────────────────────────────────────

  async suggestions(search: string) {
    const items = await this.prisma.material.findMany({
      where: {
        status: MaterialStatus.PUBLIC,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      take: 10,
      orderBy: { name: 'asc' },
      include: { category: { select: { name: true } } },
    });

    return items.map((m) => ({
      id: m.id,
      name: m.name,
      categoryName: m.category.name,
      uom: m.uom,
    }));
  }

  // ── Create Material ─────────────────────────────────────────────────────────

  async createMaterial(dto: CreateMaterialDto, user: AuthenticatedUser) {
    // Check for duplicate name (case-insensitive)
    const existing = await this.prisma.material.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException(ERR.materials.duplicateName);
    }

    const status =
      user.role === UserRole.SUPER_ADMIN ? MaterialStatus.PUBLIC : MaterialStatus.PENDING_APPROVAL;

    // Verify category exists
    const category = await this.prisma.materialCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Material category not found');
    }

    const material = await this.prisma.material.create({
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
        uom: dto.uom,
        upc: dto.upc ?? null,
        manufacturer: dto.manufacturer ?? null,
        description: dto.description ?? null,
        status,
        createdById: user.id,
      },
      include: { category: { select: { id: true, name: true } } },
    });

    return {
      id: material.id,
      name: material.name,
      categoryId: material.category.id,
      categoryName: material.category.name,
      uom: material.uom,
      upc: material.upc,
      manufacturer: material.manufacturer,
      description: material.description,
      status: material.status,
      createdAt: material.createdAt.toISOString(),
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private buildListWhere(
    query: MaterialListQueryDto,
    user: AuthenticatedUser,
  ): Prisma.MaterialWhereInput {
    const where: Prisma.MaterialWhereInput = {};

    // Default status filter: non-SuperAdmin users only see PUBLIC materials
    if (query.status) {
      where.status = query.status as MaterialStatus;
    } else if (user.role !== UserRole.SUPER_ADMIN) {
      where.status = MaterialStatus.PUBLIC;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    return where;
  }

  private buildOrderBy(
    sortBy: string,
    sortDir: 'asc' | 'desc',
  ): Prisma.MaterialOrderByWithRelationInput {
    switch (sortBy) {
      case 'createdAt':
        return { createdAt: sortDir };
      case 'name':
      default:
        return { name: sortDir };
    }
  }
}
