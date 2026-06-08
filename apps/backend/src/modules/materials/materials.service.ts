import { randomUUID } from 'crypto';

import {
  type CatalogueExtractionResult,
  type CatalogueImportSummaryDto,
  type CatalogueLineItem,
  CreateMaterialDto,
  MaterialListQueryDto,
  buildPaginationMeta,
} from '@forethread/shared-types';
import {
  ForbiddenException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DocExtractionStatus, DocExtractionType, MaterialStatus, Prisma, UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { canonicalizeUnit } from '../doc-intelligence/doc-intelligence.bom';

const UNCATEGORISED = 'Uncategorised';
const IMPORT_BATCH_SIZE = 1000;

/** Trim a nullable string, collapsing empty results to null. */
function nullableTrim(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

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
        sku: m.sku,
        brand: m.brand,
        manufacturerPartNumber: m.manufacturerPartNumber,
        subCategory: m.subCategory,
        imageUrl: m.imageUrl,
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

  // ── Catalogue bulk import (FOR-228) ───────────────────────────────────────────

  /**
   * Bulk-import materials from a CONFIRMED catalogue extraction. SKU is the
   * natural unique key: rows with a SKU are upserted via raw `ON CONFLICT (sku)`
   * in batches (no per-row round-trips); sku-less rows fall back to a
   * case-insensitive name+status dedupe. Categories are auto-upserted, with an
   * "Uncategorised" fallback for rows lacking a main category.
   */
  async importCatalogueFromExtraction(
    extractionId: string,
    user: AuthenticatedUser,
  ): Promise<CatalogueImportSummaryDto> {
    const extraction = await this.prisma.docExtraction.findUnique({
      where: { id: extractionId },
    });
    if (!extraction) {
      throw new NotFoundException(ERR.docExtractions.notFound);
    }
    if (extraction.type !== DocExtractionType.CATALOGUE) {
      throw new NotFoundException(ERR.docExtractions.notFound);
    }
    if (!this.canAccessExtraction(extraction, user)) {
      throw new ForbiddenException(ERR.docExtractions.notFound);
    }
    // Importable once the extraction has produced a result. We accept COMPLETED
    // (the normal case — the parsed result is already persisted server-side) as
    // well as CONFIRMED, so the client never has to ship the (potentially 10MB+)
    // edited result back just to "confirm" it before importing.
    if (
      extraction.status !== DocExtractionStatus.COMPLETED &&
      extraction.status !== DocExtractionStatus.CONFIRMED
    ) {
      throw new ForbiddenException(ERR.docExtractions.notReadyForConfirm);
    }

    const parsed = extraction.editedResult as unknown as CatalogueExtractionResult | null;
    const rawItems = parsed && Array.isArray(parsed.items) ? parsed.items : [];
    if (rawItems.length === 0) {
      return { total: 0, created: 0, updated: 0, skipped: 0, categoriesCreated: 0 };
    }

    // Partition into importable rows (have a name) and skipped rows (no name).
    const items = rawItems.filter((i) => typeof i.name === 'string' && i.name.trim().length > 0);
    const skipped = rawItems.length - items.length;

    // ── Categories ─────────────────────────────────────────────────────────
    const { categoryMap, uncategorisedId, categoriesCreated } =
      await this.upsertCatalogueCategories(items);

    // Bulk catalogue import is a permissioned, authoritative action (only
    // COMPANY_ADMIN / PROCUREMENT_OFFICER / SUPER_ADMIN hold `material.import`),
    // and the catalogue is a single shared table with no approval flow yet.
    // Imported rows are therefore published directly so they are immediately
    // visible in the catalogue and matchable by the BOM pipeline (which only
    // considers PUBLIC materials). See FOR-228.
    const status = MaterialStatus.PUBLIC;

    let created = 0;
    let updated = 0;

    // ── SKU rows: batched raw upsert ───────────────────────────────────────
    const withSku = items.filter((i) => i.sku !== null && i.sku.trim().length > 0);
    for (let i = 0; i < withSku.length; i += IMPORT_BATCH_SIZE) {
      const batch = withSku.slice(i, i + IMPORT_BATCH_SIZE);
      const affected = await this.upsertSkuBatch(batch, categoryMap, uncategorisedId, status, user);
      created += affected.created;
      updated += affected.updated;
    }

    // ── SKU-less rows: name-based dedupe (the minority) ─────────────────────
    const withoutSku = items.filter((i) => i.sku === null || i.sku.trim().length === 0);
    for (const item of withoutSku) {
      const wasUpdated = await this.upsertByName(item, categoryMap, uncategorisedId, status, user);
      if (wasUpdated) updated += 1;
      else created += 1;
    }

    // Lock the extraction now that its rows have landed in the catalogue.
    if (extraction.status !== DocExtractionStatus.CONFIRMED) {
      await this.prisma.docExtraction.update({
        where: { id: extractionId },
        data: {
          status: DocExtractionStatus.CONFIRMED,
          confirmedAt: new Date(),
          confirmedByUserId: user.id,
        },
      });
    }

    return {
      total: items.length,
      created,
      updated,
      skipped,
      categoriesCreated,
    };
  }

  /** Resolve the main-category id for a catalogue line (Uncategorised fallback). */
  private resolveCategoryId(
    item: CatalogueLineItem,
    categoryMap: Map<string, string>,
    uncategorisedId: string,
  ): string {
    const main = item.mainCategory?.trim();
    if (!main) return uncategorisedId;
    return categoryMap.get(main.toLowerCase()) ?? uncategorisedId;
  }

  /**
   * Upsert every distinct main-category plus the Uncategorised fallback. Returns
   * a lowercased-name → id map and the count of newly-created categories.
   */
  private async upsertCatalogueCategories(
    items: CatalogueLineItem[],
  ): Promise<{
    categoryMap: Map<string, string>;
    uncategorisedId: string;
    categoriesCreated: number;
  }> {
    const distinct = new Map<string, string>(); // lowercased → original casing
    for (const item of items) {
      const main = item.mainCategory?.trim();
      if (main && !distinct.has(main.toLowerCase())) distinct.set(main.toLowerCase(), main);
    }
    // Always ensure the Uncategorised fallback exists.
    if (!distinct.has(UNCATEGORISED.toLowerCase())) {
      distinct.set(UNCATEGORISED.toLowerCase(), UNCATEGORISED);
    }

    const categoryMap = new Map<string, string>();
    let categoriesCreated = 0;

    for (const [lower, name] of distinct) {
      const existing = await this.prisma.materialCategory.findUnique({ where: { name } });
      if (existing) {
        categoryMap.set(lower, existing.id);
      } else {
        const createdCat = await this.prisma.materialCategory.create({ data: { name } });
        categoryMap.set(lower, createdCat.id);
        categoriesCreated += 1;
      }
    }

    return {
      categoryMap,
      uncategorisedId: categoryMap.get(UNCATEGORISED.toLowerCase()) ?? '',
      categoriesCreated,
    };
  }

  /**
   * Multi-row `INSERT ... ON CONFLICT (sku) DO UPDATE` for a batch of SKU rows.
   * Returns created/updated counts (xmax=0 ⇒ inserted, else updated).
   */
  private async upsertSkuBatch(
    batch: CatalogueLineItem[],
    categoryMap: Map<string, string>,
    uncategorisedId: string,
    status: MaterialStatus,
    user: AuthenticatedUser,
  ): Promise<{ created: number; updated: number }> {
    const now = new Date();
    const rows = batch.map((item) => {
      const categoryId = this.resolveCategoryId(item, categoryMap, uncategorisedId);
      const brand = nullableTrim(item.brand);
      const sku = nullableTrim(item.sku) ?? '';
      return Prisma.sql`(
        ${randomUUID()}, ${item.name.trim()}, ${categoryId}::uuid,
        ${canonicalizeUnit(item.uom) ?? ''}, ${item.upc ?? null}, ${brand},
        ${item.description ?? null}, ${sku}, ${brand},
        ${item.manufacturerPartNumber ?? null}, ${item.subCategory ?? null}, ${item.imageUrl ?? null},
        ${status}::"MaterialStatus", ${user.id}, ${now}, ${now}
      )`;
    });

    const result = await this.prisma.$transaction(async (tx) => {
      return tx.$queryRaw<Array<{ inserted: boolean }>>(Prisma.sql`
        INSERT INTO materials (
          id, name, category_id, uom, upc, manufacturer, description,
          sku, brand, manufacturer_part_number, sub_category, image_url,
          status, created_by_id, created_at, updated_at
        )
        VALUES ${Prisma.join(rows)}
        ON CONFLICT (sku) DO UPDATE SET
          name = EXCLUDED.name,
          category_id = EXCLUDED.category_id,
          uom = EXCLUDED.uom,
          upc = EXCLUDED.upc,
          manufacturer = EXCLUDED.manufacturer,
          description = EXCLUDED.description,
          brand = EXCLUDED.brand,
          manufacturer_part_number = EXCLUDED.manufacturer_part_number,
          sub_category = EXCLUDED.sub_category,
          image_url = EXCLUDED.image_url,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
        RETURNING (xmax = 0) AS inserted
      `);
    });

    let created = 0;
    let updated = 0;
    for (const row of result) {
      if (row.inserted) created += 1;
      else updated += 1;
    }
    return { created, updated };
  }

  /**
   * SKU-less fallback: find a material by case-insensitive name + status, update
   * it if present, otherwise insert. Returns true when an existing row was updated.
   */
  private async upsertByName(
    item: CatalogueLineItem,
    categoryMap: Map<string, string>,
    uncategorisedId: string,
    status: MaterialStatus,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    const name = item.name.trim();
    const categoryId = this.resolveCategoryId(item, categoryMap, uncategorisedId);
    const brand = nullableTrim(item.brand);
    const data = {
      name,
      categoryId,
      uom: canonicalizeUnit(item.uom) ?? '',
      upc: item.upc ?? null,
      manufacturer: brand,
      description: item.description ?? null,
      brand,
      manufacturerPartNumber: item.manufacturerPartNumber ?? null,
      subCategory: item.subCategory ?? null,
      imageUrl: item.imageUrl ?? null,
      status,
    };

    const existing = await this.prisma.material.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, status },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.material.update({ where: { id: existing.id }, data });
      return true;
    }

    await this.prisma.material.create({ data: { ...data, createdById: user.id } });
    return false;
  }

  /** Mirror of DocIntelligenceService.canAccess for extraction ownership. */
  private canAccessExtraction(
    extraction: { createdByUserId: string; companyId: string | null },
    user: AuthenticatedUser,
  ): boolean {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    if (extraction.createdByUserId === user.id) return true;
    if (extraction.companyId && user.companyId && extraction.companyId === user.companyId) {
      return true;
    }
    return false;
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
