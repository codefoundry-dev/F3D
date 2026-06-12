import { randomUUID } from 'crypto';

import {
  type CatalogueExtractionResult,
  type CatalogueImportSummaryDto,
  type CatalogueLineItem,
  type DetectMaterialDuplicatesResponseDto,
  type DuplicateMatchField,
  type MaterialChangeRequestDto,
  type MaterialDetailDto,
  type MaterialDimensions,
  type MaterialFieldChange,
  type MaterialProperties,
  CreateMaterialDto,
  DetectMaterialDuplicatesDto,
  MaterialListQueryDto,
  ResolveMaterialChangeDto,
  UpdateMaterialDto,
  buildPaginationMeta,
} from '@forethread/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  DocExtractionStatus,
  DocExtractionType,
  Material,
  MaterialChangeRequestStatus,
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

/** A change request loaded with its material + requester/resolver names. */
type ChangeRequestWithRelations = Prisma.MaterialChangeRequestGetPayload<{
  include: {
    material: { select: { id: true; name: true } };
    requestedBy: { select: { id: true; name: true } };
    resolvedBy: { select: { id: true; name: true } };
  };
}>;

/** Trim a nullable string, collapsing empty results to null. */
function nullableTrim(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  /** String/number columns diffable 1:1 from UpdateMaterialDto (US 4.01 Phase 3). */
  private static readonly EDITABLE_SCALAR_FIELDS: (keyof UpdateMaterialDto)[] = [
    'name',
    'uom',
    'upc',
    'manufacturer',
    'description',
    'sku',
    'brand',
    'manufacturerPartNumber',
    'subCategory',
    'imageUrl',
    'materialType',
    'itemType',
    'countryOfOrigin',
    'manufacturerSeriesModel',
    'gradeClass',
    'standardNorm',
    'colourFinish',
    'size',
    'currency',
  ];

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

    // Resolve the target category. A supplied id must exist; when omitted (the
    // BOM "create private material" quick-add has no category field) the row
    // falls back to the shared "Uncategorised" bucket, mirroring the catalogue
    // bulk-import.
    const categoryId = dto.categoryId
      ? await this.assertCategoryExists(dto.categoryId)
      : await this.resolveUncategorisedCategoryId();

    const material = await this.prisma.material.create({
      // Persist the full Core-identification + Additional-properties payload from
      // the "Add new material item" wizard (US 4.01 Phase 2). Optional string
      // columns collapse to null when omitted; currency keeps its DB default
      // ("AUD") unless the caller supplies one.
      data: {
        name: dto.name,
        categoryId,
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

  /** Assert a supplied category id exists, returning it; 404 otherwise. */
  private async assertCategoryExists(id: string): Promise<string> {
    const category = await this.prisma.materialCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Material category not found');
    }
    return id;
  }

  /** Find-or-create the shared "Uncategorised" category and return its id. */
  private async resolveUncategorisedCategoryId(): Promise<string> {
    const existing = await this.prisma.materialCategory.findUnique({
      where: { name: UNCATEGORISED },
    });
    if (existing) return existing.id;
    const created = await this.prisma.materialCategory.create({ data: { name: UNCATEGORISED } });
    return created.id;
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
    const existing = await this.prisma.material.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    // Don't leak unpublished catalogue rows to non-SuperAdmins — 404, not 403.
    // (Non-SuperAdmins can only ever reach a PUBLIC material via the catalogue.)
    if (existing.status !== MaterialStatus.PUBLIC && user.role !== UserRole.SUPER_ADMIN) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    // SuperAdmin edits apply directly to the live material (Phase 1 behaviour).
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.applyMaterialUpdate(id, dto, existing);
    }

    // Phase 3: a Company-Admin / Procurement-Officer edit is captured as a
    // PENDING change request — the live material is left untouched until the
    // catalogue Super-Admin approves it. Validate up front so the editor gets
    // immediate feedback rather than a deferred approval-time error.
    await this.validateMaterialEdit(existing, dto, id);

    const changedFields = this.computeChangedFields(existing, dto);
    if (Object.keys(changedFields).length === 0) {
      // No effective change — nothing to review, return the material as-is.
      return this.getMaterialById(id, user);
    }

    await this.prisma.materialChangeRequest.create({
      data: {
        materialId: id,
        changedFields: changedFields as Prisma.InputJsonValue,
        requestedById: user.id,
      },
    });

    return this.getMaterialById(id, user);
  }

  /**
   * Validate a proposed edit (target category exists, case-insensitive name
   * uniqueness excluding self). Shared by the direct-apply and change-request
   * paths; re-run at approval time since catalogue state may have drifted.
   */
  private async validateMaterialEdit(
    existing: Pick<Material, 'name'>,
    dto: UpdateMaterialDto,
    id: string,
  ): Promise<void> {
    if (dto.categoryId !== undefined) {
      const category = await this.prisma.materialCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Material category not found');
      }
    }

    if (dto.name !== undefined && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.material.findFirst({
        where: { name: { equals: dto.name, mode: 'insensitive' }, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(ERR.materials.duplicateName);
      }
    }
  }

  /** Apply a supplied-fields-only update to the live material and return detail. */
  private async applyMaterialUpdate(
    id: string,
    dto: UpdateMaterialDto,
    existing?: Material,
  ): Promise<MaterialDetailDto> {
    const current = existing ?? (await this.prisma.material.findUnique({ where: { id } }));
    if (!current) {
      throw new NotFoundException(ERR.materials.notFound);
    }
    await this.validateMaterialEdit(current, dto, id);

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

  /**
   * Compute the supplied-vs-current before/after diff for a proposed edit. Only
   * fields that actually change are included. Stored raw on the change request
   * (categoryId keeps its id, dimensions/properties keep their JSON) so approval
   * can re-apply faithfully; the list endpoint resolves display values.
   */
  private computeChangedFields(
    existing: Material,
    dto: UpdateMaterialDto,
  ): Record<string, { from: unknown; to: unknown }> {
    const changed: Record<string, { from: unknown; to: unknown }> = {};

    for (const key of MaterialsService.EDITABLE_SCALAR_FIELDS) {
      if (dto[key] === undefined) continue;
      const from = (existing as unknown as Record<string, unknown>)[key] ?? null;
      const to = dto[key] ?? null;
      if ((from ?? '') !== (to ?? '')) changed[key] = { from, to };
    }

    if (dto.pricePerUnit !== undefined) {
      const from = existing.pricePerUnit !== null ? Number(existing.pricePerUnit) : null;
      const to = dto.pricePerUnit ?? null;
      if (from !== to) changed.pricePerUnit = { from, to };
    }

    if (dto.categoryId !== undefined && dto.categoryId !== existing.categoryId) {
      changed.categoryId = { from: existing.categoryId, to: dto.categoryId };
    }

    if (
      dto.dimensions !== undefined &&
      JSON.stringify(existing.dimensions ?? null) !== JSON.stringify(dto.dimensions ?? null)
    ) {
      changed.dimensions = { from: existing.dimensions ?? null, to: dto.dimensions };
    }
    if (
      dto.properties !== undefined &&
      JSON.stringify(existing.properties ?? null) !== JSON.stringify(dto.properties ?? null)
    ) {
      changed.properties = { from: existing.properties ?? null, to: dto.properties };
    }

    return changed;
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

  // ── Duplicate detection (US 4.01 Phase 3) ─────────────────────────────────────

  /**
   * Check candidate rows (upload/import wizard) against the PUBLIC catalogue.
   * A candidate collides when its name (case-insensitive, via the `nameCi`
   * generated column), SKU, or UPC matches an existing material. Results keep
   * the submitted index so the wizard can highlight the right rows.
   */
  async detectDuplicates(
    dto: DetectMaterialDuplicatesDto,
  ): Promise<DetectMaterialDuplicatesResponseDto> {
    const candidates = dto.candidates ?? [];
    if (candidates.length === 0) return { results: [] };

    const lowerNames = new Set<string>();
    const skus = new Set<string>();
    const upcs = new Set<string>();
    for (const c of candidates) {
      const n = c.name?.trim().toLowerCase();
      if (n) lowerNames.add(n);
      const s = c.sku?.trim();
      if (s) skus.add(s);
      const u = c.upc?.trim();
      if (u) upcs.add(u);
    }

    const or: Prisma.MaterialWhereInput[] = [];
    if (lowerNames.size) or.push({ nameCi: { in: [...lowerNames] } });
    if (skus.size) or.push({ sku: { in: [...skus] } });
    if (upcs.size) or.push({ upc: { in: [...upcs] } });
    if (or.length === 0) return { results: [] };

    const existing = await this.prisma.material.findMany({
      where: { status: MaterialStatus.PUBLIC, OR: or },
      select: { id: true, name: true, nameCi: true, sku: true, upc: true, status: true },
    });

    type ExistingMatch = (typeof existing)[number];
    const byName = new Map<string, ExistingMatch[]>();
    const bySku = new Map<string, ExistingMatch>();
    const byUpc = new Map<string, ExistingMatch>();
    for (const m of existing) {
      const nk = m.nameCi ?? m.name.toLowerCase();
      const arr = byName.get(nk) ?? [];
      arr.push(m);
      byName.set(nk, arr);
      if (m.sku) bySku.set(m.sku, m);
      if (m.upc) byUpc.set(m.upc, m);
    }

    const results = candidates.flatMap((c, index) => {
      const matchMap = new Map<
        string,
        { material: ExistingMatch; fields: Set<DuplicateMatchField> }
      >();
      const add = (m: ExistingMatch, field: DuplicateMatchField) => {
        const entry = matchMap.get(m.id) ?? { material: m, fields: new Set<DuplicateMatchField>() };
        entry.fields.add(field);
        matchMap.set(m.id, entry);
      };

      const n = c.name?.trim().toLowerCase();
      if (n) for (const m of byName.get(n) ?? []) add(m, 'name');
      const s = c.sku?.trim();
      const skuMatch = s ? bySku.get(s) : undefined;
      if (skuMatch) add(skuMatch, 'sku');
      const u = c.upc?.trim();
      const upcMatch = u ? byUpc.get(u) : undefined;
      if (upcMatch) add(upcMatch, 'upc');

      if (matchMap.size === 0) return [];
      return [
        {
          index,
          matches: [...matchMap.values()].map(({ material, fields }) => ({
            id: material.id,
            name: material.name,
            code: this.displayCode(material),
            status: material.status as MaterialDetailDto['status'],
            matchedOn: [...fields],
          })),
        },
      ];
    });

    return { results };
  }

  /** Human-facing material code: the SKU when present, else a short derived id. */
  private displayCode(m: { sku: string | null; id: string }): string {
    const sku = m.sku?.trim();
    if (sku) return sku;
    return `MAT-${m.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  // ── Material change requests (US 4.01 Phase 3) ────────────────────────────────

  /** List change requests (newest first), optionally filtered by status. */
  async listChangeRequests(
    status?: MaterialChangeRequestStatus,
  ): Promise<MaterialChangeRequestDto[]> {
    const crs = await this.prisma.materialChangeRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        material: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    // Resolve category names referenced by any categoryId diff in one query.
    const catIds = new Set<string>();
    for (const cr of crs) {
      const raw = cr.changedFields as Record<string, { from: unknown; to: unknown }> | null;
      const cat = raw?.categoryId;
      if (cat) {
        if (typeof cat.from === 'string') catIds.add(cat.from);
        if (typeof cat.to === 'string') catIds.add(cat.to);
      }
    }
    const catName = await this.loadCategoryNames(catIds);
    return crs.map((cr) => this.serializeChangeRequest(cr, catName));
  }

  /** Approve a pending change request — applies the diff to the live material. */
  async approveChangeRequest(
    id: string,
    user: AuthenticatedUser,
  ): Promise<MaterialChangeRequestDto> {
    const cr = await this.prisma.materialChangeRequest.findUnique({ where: { id } });
    if (!cr) throw new NotFoundException(ERR.materials.changeRequestNotFound);
    if (cr.status !== MaterialChangeRequestStatus.PENDING) {
      throw new BadRequestException(ERR.materials.changeRequestNotPending);
    }

    // Re-build an UpdateMaterialDto from the stored `to` values and apply it.
    // applyMaterialUpdate re-validates (category exists, name still unique), so a
    // request that has gone stale surfaces a clear error instead of corrupting data.
    const raw = (cr.changedFields ?? {}) as Record<string, { from: unknown; to: unknown }>;
    const applyDto = Object.fromEntries(
      Object.entries(raw).map(([key, val]) => [key, val.to]),
    ) as UpdateMaterialDto;
    await this.applyMaterialUpdate(cr.materialId, applyDto);

    const updated = await this.prisma.materialChangeRequest.update({
      where: { id },
      data: {
        status: MaterialChangeRequestStatus.APPROVED,
        resolvedById: user.id,
        resolvedAt: new Date(),
      },
      include: {
        material: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });
    return this.toChangeRequestDto(updated);
  }

  /** Reject a pending change request — discards it; the material is untouched. */
  async rejectChangeRequest(
    id: string,
    dto: ResolveMaterialChangeDto | undefined,
    user: AuthenticatedUser,
  ): Promise<MaterialChangeRequestDto> {
    const cr = await this.prisma.materialChangeRequest.findUnique({ where: { id } });
    if (!cr) throw new NotFoundException(ERR.materials.changeRequestNotFound);
    if (cr.status !== MaterialChangeRequestStatus.PENDING) {
      throw new BadRequestException(ERR.materials.changeRequestNotPending);
    }

    const updated = await this.prisma.materialChangeRequest.update({
      where: { id },
      data: {
        status: MaterialChangeRequestStatus.REJECTED,
        reason: dto?.reason ?? null,
        resolvedById: user.id,
        resolvedAt: new Date(),
      },
      include: {
        material: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });
    return this.toChangeRequestDto(updated);
  }

  /** Map of category id → name for the supplied ids (empty set → empty map). */
  private async loadCategoryNames(ids: Set<string>): Promise<Map<string, string>> {
    if (ids.size === 0) return new Map();
    const cats = await this.prisma.materialCategory.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, name: true },
    });
    return new Map(cats.map((c) => [c.id, c.name]));
  }

  /** Serialize a single change request, resolving its own category names. */
  private async toChangeRequestDto(
    cr: ChangeRequestWithRelations,
  ): Promise<MaterialChangeRequestDto> {
    const raw = cr.changedFields as Record<string, { from: unknown; to: unknown }> | null;
    const catIds = new Set<string>();
    const cat = raw?.categoryId;
    if (cat) {
      if (typeof cat.from === 'string') catIds.add(cat.from);
      if (typeof cat.to === 'string') catIds.add(cat.to);
    }
    const catName = await this.loadCategoryNames(catIds);
    return this.serializeChangeRequest(cr, catName);
  }

  /**
   * Shape a loaded change request into the response DTO. The raw stored diff is
   * translated to display values: categoryId → category name, structured
   * JSON fields → a terse marker (the full before/after isn't rendered on the
   * edit-diff card), scalars pass through.
   */
  private serializeChangeRequest(
    cr: ChangeRequestWithRelations,
    catName: Map<string, string>,
  ): MaterialChangeRequestDto {
    const raw = (cr.changedFields ?? {}) as Record<string, { from: unknown; to: unknown }>;
    const changes: Record<string, MaterialFieldChange> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (key === 'categoryId') {
        changes.category = {
          from: typeof val.from === 'string' ? (catName.get(val.from) ?? val.from) : null,
          to: typeof val.to === 'string' ? (catName.get(val.to) ?? val.to) : null,
        };
      } else if (key === 'dimensions' || key === 'properties') {
        changes[key] = {
          from: val.from === null || val.from === undefined ? null : 'Provided',
          to: val.to === null || val.to === undefined ? null : 'Updated',
        };
      } else {
        changes[key] = { from: this.scalarOrNull(val.from), to: this.scalarOrNull(val.to) };
      }
    }

    return {
      id: cr.id,
      materialId: cr.material.id,
      materialName: cr.material.name,
      status: cr.status as MaterialChangeRequestDto['status'],
      changes,
      reason: cr.reason ?? null,
      requestedBy: cr.requestedBy ? { id: cr.requestedBy.id, name: cr.requestedBy.name } : null,
      resolvedBy: cr.resolvedBy ? { id: cr.resolvedBy.id, name: cr.resolvedBy.name } : null,
      resolvedAt: cr.resolvedAt ? cr.resolvedAt.toISOString() : null,
      createdAt: cr.createdAt.toISOString(),
    };
  }

  /** Coerce a stored diff value to the DTO's scalar union. */
  private scalarOrNull(v: unknown): string | number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' || typeof v === 'string') return v;
    if (typeof v === 'boolean') return String(v);
    // Unexpected non-scalar — serialize defensively rather than "[object Object]".
    return JSON.stringify(v);
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
