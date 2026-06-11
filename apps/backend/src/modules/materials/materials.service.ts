import { randomUUID } from 'crypto';

import {
  type CatalogueExtractionResult,
  type CatalogueImportSummaryDto,
  type CatalogueLineItem,
  type MaterialDetailDto,
  type MaterialDimensions,
  type MaterialProperties,
  CreateMaterialDto,
  MaterialListQueryDto,
  UpdateMaterialDto,
  buildPaginationMeta,
} from '@forethread/shared-types';
import {
  ForbiddenException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DocExtractionStatus,
  DocExtractionType,
  Material,
  MaterialStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

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
        materialType: m.materialType,
        countryOfOrigin: m.countryOfOrigin,
        pricePerUnit:
          m.pricePerUnit !== null && m.pricePerUnit !== undefined
            ? m.pricePerUnit.toString()
            : null,
        currency: m.currency,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
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
      // Persist the full Core-identification + Additional-properties payload from
      // the "Add new material item" wizard (US 4.01 Phase 2). Optional string
      // columns collapse to null when omitted; currency keeps its DB default
      // ("AUD") unless the caller supplies one.
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
        uom: dto.uom,
        upc: dto.upc ?? null,
        manufacturer: dto.manufacturer ?? null,
        description: dto.description ?? null,
        sku: dto.sku ?? null,
        brand: dto.brand ?? null,
        manufacturerPartNumber: dto.manufacturerPartNumber ?? null,
        subCategory: dto.subCategory ?? null,
        imageUrl: dto.imageUrl ?? null,
        materialType: dto.materialType ?? null,
        itemType: dto.itemType ?? null,
        countryOfOrigin: dto.countryOfOrigin ?? null,
        manufacturerSeriesModel: dto.manufacturerSeriesModel ?? null,
        gradeClass: dto.gradeClass ?? null,
        standardNorm: dto.standardNorm ?? null,
        colourFinish: dto.colourFinish ?? null,
        size: dto.size ?? null,
        pricePerUnit: dto.pricePerUnit ?? null,
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.dimensions ? { dimensions: dto.dimensions as Prisma.InputJsonValue } : {}),
        ...(dto.properties ? { properties: dto.properties as Prisma.InputJsonValue } : {}),
        status,
        createdById: user.id,
      },
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return this.toDetail(material);
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
  private async upsertCatalogueCategories(items: CatalogueLineItem[]): Promise<{
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

    // Status visibility. Non-SuperAdmin users are ALWAYS clamped to PUBLIC — an
    // explicit `status` query (e.g. PENDING_APPROVAL/ARCHIVED) must not let them
    // see unpublished catalogue rows. Only SuperAdmin may request a specific
    // non-public status.
    if (user.role === UserRole.SUPER_ADMIN) {
      if (query.status) {
        where.status = query.status as MaterialStatus;
      }
    } else {
      where.status = MaterialStatus.PUBLIC;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    // ── Facet filters (US 4.01) ─────────────────────────────────────────────
    if (query.manufacturer) {
      where.manufacturer = { contains: query.manufacturer, mode: 'insensitive' };
    }

    if (query.uom) {
      where.uom = query.uom;
    }

    if (query.materialType) {
      where.materialType = query.materialType;
    }

    if (query.countryOfOrigin) {
      where.countryOfOrigin = query.countryOfOrigin;
    }

    return where;
  }

  // ── Detail mapper ─────────────────────────────────────────────────────────

  /** Shape a loaded Material (with category + createdBy) into the detail DTO. */
  private toDetail(
    m: Material & {
      category: { id: string; name: string };
      createdBy: { id: string; name: string } | null;
    },
  ): MaterialDetailDto {
    return {
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
      materialType: m.materialType,
      itemType: m.itemType,
      countryOfOrigin: m.countryOfOrigin,
      manufacturerSeriesModel: m.manufacturerSeriesModel,
      gradeClass: m.gradeClass,
      standardNorm: m.standardNorm,
      colourFinish: m.colourFinish,
      size: m.size,
      pricePerUnit:
        m.pricePerUnit !== null && m.pricePerUnit !== undefined ? m.pricePerUnit.toString() : null,
      currency: m.currency,
      dimensions: (m.dimensions as MaterialDimensions | null) ?? null,
      properties: (m.properties as MaterialProperties | null) ?? null,
      // Prisma's MaterialStatus union ↔ shared-types' MaterialStatus enum share
      // identical string values but are nominally distinct TS types.
      status: m.status as MaterialDetailDto['status'],
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      createdBy: m.createdBy ? { id: m.createdBy.id, name: m.createdBy.name } : null,
    };
  }

  // ── Get Material by id ──────────────────────────────────────────────────────

  async getMaterialById(id: string, user: AuthenticatedUser): Promise<MaterialDetailDto> {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!material) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    // Don't leak unpublished catalogue rows to non-SuperAdmins — 404, not 403.
    if (material.status !== MaterialStatus.PUBLIC && user.role !== UserRole.SUPER_ADMIN) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    return this.toDetail(material);
  }

  // ── Update Material ─────────────────────────────────────────────────────────

  async updateMaterial(
    id: string,
    dto: UpdateMaterialDto,
    user: AuthenticatedUser,
  ): Promise<MaterialDetailDto> {
    // Phase 1: only SuperAdmin may directly edit a material. The CA/PO
    // change-request branch (which routes edits to PENDING_APPROVAL review)
    // arrives in Phase 3.
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const existing = await this.prisma.material.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    // Validate the target category up front when a re-category is requested.
    if (dto.categoryId !== undefined) {
      const category = await this.prisma.materialCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Material category not found');
      }
    }

    // Re-check the case-insensitive name uniqueness (excluding self) on rename.
    if (dto.name !== undefined && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.material.findFirst({
        where: { name: { equals: dto.name, mode: 'insensitive' }, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(ERR.materials.duplicateName);
      }
    }

    // Apply only the fields that were actually supplied — never overwrite a
    // column with `undefined`.
    const data: Prisma.MaterialUpdateInput = {};
    const assign = <K extends keyof UpdateMaterialDto>(
      key: K,
      target: keyof Prisma.MaterialUpdateInput,
    ) => {
      if (dto[key] !== undefined) {
        (data as Record<string, unknown>)[target as string] = dto[key];
      }
    };

    if (dto.categoryId !== undefined) {
      data.category = { connect: { id: dto.categoryId } };
    }
    assign('name', 'name');
    assign('uom', 'uom');
    assign('upc', 'upc');
    assign('manufacturer', 'manufacturer');
    assign('description', 'description');
    assign('sku', 'sku');
    assign('brand', 'brand');
    assign('manufacturerPartNumber', 'manufacturerPartNumber');
    assign('subCategory', 'subCategory');
    assign('imageUrl', 'imageUrl');
    assign('materialType', 'materialType');
    assign('itemType', 'itemType');
    assign('countryOfOrigin', 'countryOfOrigin');
    assign('manufacturerSeriesModel', 'manufacturerSeriesModel');
    assign('gradeClass', 'gradeClass');
    assign('standardNorm', 'standardNorm');
    assign('colourFinish', 'colourFinish');
    assign('size', 'size');
    assign('currency', 'currency');
    if (dto.pricePerUnit !== undefined) {
      data.pricePerUnit = dto.pricePerUnit;
    }
    if (dto.dimensions !== undefined) {
      data.dimensions = dto.dimensions as Prisma.InputJsonValue;
    }
    if (dto.properties !== undefined) {
      data.properties = dto.properties as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.material.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return this.toDetail(updated);
  }

  // ── Delete Material ─────────────────────────────────────────────────────────

  async deleteMaterial(id: string, user: AuthenticatedUser): Promise<{ success: true }> {
    // SuperAdmin-only. The controller's `material.delete` permission already
    // gates this; the service stays defensive in case it is called elsewhere.
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const existing = await this.prisma.material.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    // A material referenced by any procurement document cannot be hard-deleted —
    // it must be archived instead so historical documents keep their link.
    const [poLineItems, rfqLineItems, quoteResponseLineItems, bomItems, materialListItems] =
      await Promise.all([
        this.prisma.poLineItem.count({ where: { materialId: id } }),
        this.prisma.rfqLineItem.count({ where: { materialId: id } }),
        this.prisma.quoteResponseLineItem.count({ where: { substituteItemId: id } }),
        this.prisma.bomItem.count({ where: { matchedMaterialId: id } }),
        this.prisma.materialListItem.count({ where: { materialId: id } }),
      ]);

    const references =
      poLineItems + rfqLineItems + quoteResponseLineItems + bomItems + materialListItems;

    if (references > 0) {
      throw new ConflictException(ERR.materials.referenced(references));
    }

    await this.prisma.material.delete({ where: { id } });

    return { success: true };
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
        // Sort by the case-insensitive key (lower(name)) so the catalogue is
        // true alphabetical A->Z regardless of the column's collation.
        return { nameCi: sortDir };
    }
  }
}
