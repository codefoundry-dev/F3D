import { randomUUID } from 'crypto';

import {
  type CatalogueExtractionResult,
  type CatalogueImportListDto,
  type CatalogueImportSummaryDto,
  type CatalogueLineItem,
  type DetectMaterialDuplicatesResponseDto,
  type DuplicateMatchField,
  type MaterialChangeRequestDto,
  type MaterialDetailDto,
  type MaterialDimensions,
  type MaterialFacetsDto,
  type MaterialFieldChange,
  type MaterialProperties,
  type MaterialSuggestionDto,
  type MaterialSuggestionsResponseDto,
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
import { ConfigService } from '@nestjs/config';
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
import { EmailService } from '../notifications/email.service';

const UNCATEGORISED = 'Uncategorised';
const IMPORT_BATCH_SIZE = 1000;
/** Fallback name for an upload-derived material list with no usable filename. */
const IMPORTED_LIST_FALLBACK_NAME = 'Imported catalogue';
/** material_lists.name is VARCHAR(255). */
const LIST_NAME_MAX = 255;

/**
 * Name the material list a catalogue upload lands in after the uploaded file,
 * minus its extension ("ACME Price List 2026.xlsx" → "ACME Price List 2026").
 * Leaves room for the " (2)" de-duplication suffix.
 */
function listNameFromFile(fileName: string | null): string {
  const base = (fileName ?? '').trim();
  if (base.length === 0) return IMPORTED_LIST_FALLBACK_NAME;
  const dot = base.lastIndexOf('.');
  const stem = (dot > 0 ? base.slice(0, dot) : base).trim();
  if (stem.length === 0) return IMPORTED_LIST_FALLBACK_NAME;
  return stem.slice(0, LIST_NAME_MAX - 10);
}

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
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    config: ConfigService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:5179');
  }

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
    'costCode',
    'taxCode',
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

    // Resolve the current user's favourites for this page in ONE query (no N+1).
    const favouriteIds = await this.loadFavouriteIds(
      user.id,
      items.map((i) => i.id),
    );

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
        costCode: m.costCode,
        taxCode: m.taxCode,
        status: m.status,
        companyId: m.companyId,
        isFavourite: favouriteIds.has(m.id),
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      meta: buildPaginationMeta(query.page ?? 1, query.take, total),
    };
  }

  // ── Filter facets (US 4.04) ───────────────────────────────────────────────

  /**
   * Distinct facet option lists (manufacturer / UoM / material type / country of
   * origin) for the catalogue filter dropdowns. Derived from the user's visible
   * catalogue so the dropdowns offer the FULL set of choices — unlike sampling a
   * single page, which only surfaces the values that happen to land on it. NULL
   * / blank values are excluded; each list is returned sorted ascending.
   */
  async getFacets(user: AuthenticatedUser): Promise<MaterialFacetsDto> {
    const where = this.buildVisibilityWhere(user);

    // Trim, drop blanks/nulls, de-duplicate and sort a raw column value list.
    const cleanSort = (values: (string | null)[]): string[] =>
      Array.from(new Set(values.filter((v): v is string => Boolean(v?.trim())))).sort((a, b) =>
        a.localeCompare(b),
      );

    const [manufacturers, uoms, materialTypes, countriesOfOrigin] = await Promise.all([
      this.prisma.material.findMany({
        where,
        select: { manufacturer: true },
        distinct: ['manufacturer'],
        orderBy: { manufacturer: 'asc' },
      }),
      this.prisma.material.findMany({
        where,
        select: { uom: true },
        distinct: ['uom'],
        orderBy: { uom: 'asc' },
      }),
      this.prisma.material.findMany({
        where,
        select: { materialType: true },
        distinct: ['materialType'],
        orderBy: { materialType: 'asc' },
      }),
      this.prisma.material.findMany({
        where,
        select: { countryOfOrigin: true },
        distinct: ['countryOfOrigin'],
        orderBy: { countryOfOrigin: 'asc' },
      }),
    ]);

    return {
      manufacturers: cleanSort(manufacturers.map((m) => m.manufacturer)),
      uoms: cleanSort(uoms.map((m) => m.uom)),
      materialTypes: cleanSort(materialTypes.map((m) => m.materialType)),
      countriesOfOrigin: cleanSort(countriesOfOrigin.map((m) => m.countryOfOrigin)),
    };
  }

  /**
   * Return the subset of `materialIds` the user has favourited, as a Set, in a
   * single query (avoids an N+1 over the page). Empty input short-circuits.
   */
  private async loadFavouriteIds(userId: string, materialIds: string[]): Promise<Set<string>> {
    if (materialIds.length === 0) return new Set();
    const favourites = await this.prisma.materialFavourite.findMany({
      where: { userId, materialId: { in: materialIds } },
      select: { materialId: true },
    });
    return new Set(favourites.map((f) => f.materialId));
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

  // ── Suggestions (catalogue search autocomplete, US 4.04) ────────────────────

  /** Default rows per group when the caller doesn't pass `limit`. */
  private static readonly SUGGESTIONS_DEFAULT_LIMIT = 8;
  /** Hard cap so a caller can't request an unbounded scan. */
  private static readonly SUGGESTIONS_MAX_LIMIT = 25;

  /** Columns selected for every suggestion row (matches MaterialSuggestionDto). */
  private static readonly suggestionSelect = {
    id: true,
    name: true,
    uom: true,
    description: true,
    imageUrl: true,
    category: { select: { name: true } },
  } satisfies Prisma.MaterialSelect;

  /**
   * Catalogue search autocomplete (US 4.04). Returns three groups:
   *  - `results`: name / UPC / manufacturer contains-match on the materials the
   *    user can see (PUBLIC shared catalogue + the user's own company-private
   *    rows, US 4.02), limited.
   *  - `recentlyUsed`: the caller's own materials by `lastUsedAt` desc.
   *  - `frequentlyUsed`: the caller's own materials by `useCount` desc.
   * The two usage groups are empty when the user has no usage history yet.
   */
  async suggestions(
    search: string,
    user: AuthenticatedUser,
    limit?: number,
  ): Promise<MaterialSuggestionsResponseDto> {
    const take = this.normaliseSuggestionLimit(limit);
    const term = search.trim();
    // Public shared catalogue PLUS the user's own company-private rows (US 4.02).
    const visibilityWhere: Prisma.MaterialWhereInput = {
      OR: [{ status: MaterialStatus.PUBLIC }, { companyId: user.companyId ?? '__none__' }],
    };

    const results = await this.prisma.material.findMany({
      where: {
        AND: [
          visibilityWhere,
          ...(term
            ? [
                {
                  OR: [
                    { name: { contains: term, mode: Prisma.QueryMode.insensitive } },
                    { upc: { contains: term, mode: Prisma.QueryMode.insensitive } },
                    { manufacturer: { contains: term, mode: Prisma.QueryMode.insensitive } },
                  ],
                } satisfies Prisma.MaterialWhereInput,
              ]
            : []),
        ],
      },
      take,
      orderBy: { name: 'asc' },
      select: MaterialsService.suggestionSelect,
    });

    const [recentlyUsed, frequentlyUsed] = await Promise.all([
      this.loadUsedSuggestions(user, take, { lastUsedAt: 'desc' }),
      this.loadUsedSuggestions(user, take, { useCount: 'desc' }),
    ]);

    return {
      results: results.map((m) => this.toSuggestion(m)),
      recentlyUsed,
      frequentlyUsed,
    };
  }

  /** Clamp the requested limit into [1, MAX], defaulting when absent/invalid. */
  private normaliseSuggestionLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit) || limit < 1) {
      return MaterialsService.SUGGESTIONS_DEFAULT_LIMIT;
    }
    return Math.min(Math.floor(limit), MaterialsService.SUGGESTIONS_MAX_LIMIT);
  }

  /**
   * Load the caller's used materials, ordered by the given usage signal, mapped
   * to suggestion rows. The joined material is re-filtered for visibility so a
   * material that has since been archived/made private isn't leaked back.
   */
  private async loadUsedSuggestions(
    user: AuthenticatedUser,
    take: number,
    orderBy: Prisma.MaterialUsageOrderByWithRelationInput,
  ): Promise<MaterialSuggestionDto[]> {
    const usages = await this.prisma.materialUsage.findMany({
      where: {
        userId: user.id,
        material: {
          OR: [{ status: MaterialStatus.PUBLIC }, { companyId: user.companyId ?? '__none__' }],
        },
      },
      orderBy,
      take,
      select: { material: { select: MaterialsService.suggestionSelect } },
    });
    return usages.map((u) => this.toSuggestion(u.material));
  }

  private toSuggestion(material: {
    id: string;
    name: string;
    uom: string | null;
    description: string | null;
    imageUrl: string | null;
    category: { name: string } | null;
  }): MaterialSuggestionDto {
    return {
      id: material.id,
      name: material.name,
      categoryName: material.category?.name ?? null,
      uom: material.uom,
      description: material.description,
      imageUrl: material.imageUrl,
    };
  }

  /**
   * Record (or bump) a per-user material usage signal (US 4.04) — one upsert per
   * material: first use inserts useCount=1, subsequent uses increment it and
   * refresh lastUsedAt. Best-effort and idempotent. Unknown/foreign materialIds
   * are skipped (the caller already validated visibility); a failed bump must
   * never fail the originating action, so errors are swallowed.
   */
  async recordMaterialUsage(userId: string, materialIds: string[]): Promise<void> {
    const ids = [...new Set(materialIds)].filter(Boolean);
    if (ids.length === 0) return;
    const now = new Date();
    await Promise.all(
      ids.map((materialId) =>
        this.prisma.materialUsage
          .upsert({
            where: { userId_materialId: { userId, materialId } },
            create: { userId, materialId, useCount: 1, lastUsedAt: now },
            update: { useCount: { increment: 1 }, lastUsedAt: now },
          })
          .catch(() => undefined),
      ),
    );
  }

  // ── Create Material ─────────────────────────────────────────────────────────

  async createMaterial(dto: CreateMaterialDto, user: AuthenticatedUser) {
    // Owning company: SuperAdmin creates a PUBLIC shared row (companyId null);
    // a Company-Admin / Procurement-Officer creates a company-private row scoped
    // to their company (US 4.02).
    const companyId = user.role === UserRole.SUPER_ADMIN ? null : (user.companyId ?? null);

    // Duplicate-name pre-check, scoped to the caller's visibility envelope: two
    // different companies may each privately hold the same name, but a row must
    // not collide with the public catalogue or the company's own rows.
    const existing = await this.prisma.material.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
        OR: [{ status: MaterialStatus.PUBLIC }, { companyId: companyId ?? '__none__' }],
      },
    });

    if (existing) {
      throw new ConflictException(ERR.materials.duplicateName);
    }

    // A Super-Admin publishes into the shared public catalogue; anyone else adds
    // to their own company's private catalogue, usable immediately and never
    // queued for publication (spec FR-R1-D04).
    const status =
      user.role === UserRole.SUPER_ADMIN ? MaterialStatus.PUBLIC : MaterialStatus.PRIVATE;

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
        costCode: dto.costCode ?? null,
        taxCode: dto.taxCode ?? null,
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.dimensions ? { dimensions: dto.dimensions as Prisma.InputJsonValue } : {}),
        ...(dto.properties ? { properties: dto.properties as Prisma.InputJsonValue } : {}),
        status,
        companyId,
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
      // The uploaded file's name becomes the material list's name for a company
      // import (see collectImportIntoList).
      include: { file: { select: { filename: true } } },
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
      return {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        categoriesCreated: 0,
        materialList: null,
      };
    }

    // Partition into importable rows (have a name) and skipped rows (no name).
    const items = rawItems.filter((i) => typeof i.name === 'string' && i.name.trim().length > 0);
    const skipped = rawItems.length - items.length;

    // ── Categories ─────────────────────────────────────────────────────────
    const { categoryMap, uncategorisedId, categoriesCreated } =
      await this.upsertCatalogueCategories(items);

    // Import scope: a SuperAdmin import publishes directly to the shared PUBLIC
    // catalogue (companyId null), so it is immediately visible to every company
    // and matchable by the BOM pipeline. A Company-Admin / Procurement-Officer
    // import lands as PRIVATE rows owned by their company — usable straight away,
    // invisible to everyone else, and never queued for Super-Admin publication
    // (the contribution flow is deferred to v2, spec FR-R1-D04).
    const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
    const status = isSuperAdmin ? MaterialStatus.PUBLIC : MaterialStatus.PRIVATE;
    const companyId = isSuperAdmin ? null : (user.companyId ?? null);

    let created = 0;
    let updated = 0;
    // Ids of every row this import touched, so a company import can collect them
    // into one material list (see collectImportIntoList).
    const importedIds: string[] = [];

    // ── SKU rows: batched raw upsert ───────────────────────────────────────
    const withSku = items.filter((i) => i.sku !== null && i.sku.trim().length > 0);
    for (let i = 0; i < withSku.length; i += IMPORT_BATCH_SIZE) {
      const batch = withSku.slice(i, i + IMPORT_BATCH_SIZE);
      const affected = await this.upsertSkuBatch(
        batch,
        categoryMap,
        uncategorisedId,
        status,
        companyId,
        user,
      );
      created += affected.created;
      updated += affected.updated;
      importedIds.push(...affected.ids);
    }

    // ── SKU-less rows: name-based dedupe (the minority) ─────────────────────
    const withoutSku = items.filter((i) => i.sku === null || i.sku.trim().length === 0);
    for (const item of withoutSku) {
      const outcome = await this.upsertByName(
        item,
        categoryMap,
        uncategorisedId,
        status,
        companyId,
        user,
      );
      if (outcome.wasUpdated) updated += 1;
      else created += 1;
      importedIds.push(outcome.id);
    }

    // A company import becomes a material list named after the uploaded file, so
    // the rows have a home in the "Material list" tab instead of disappearing
    // into a catalogue view that only shows PUBLIC rows.
    const materialList = companyId
      ? await this.collectImportIntoList({
          extractionId,
          companyId,
          userId: user.id,
          fileName: extraction.file?.filename ?? parsed?.sourceName ?? null,
          materialIds: importedIds,
        })
      : null;

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
      materialList,
    };
  }

  /**
   * Collect the rows a company import touched into one material list named after
   * the uploaded file. Re-importing the same extraction tops up the list it
   * already created rather than making a second one; a name already taken by
   * another list gets a " (2)" suffix so two uploads of the same filename stay
   * distinguishable.
   */
  private async collectImportIntoList(input: {
    extractionId: string;
    companyId: string;
    userId: string;
    fileName: string | null;
    materialIds: string[];
  }): Promise<CatalogueImportListDto | null> {
    const { extractionId, companyId, userId, fileName, materialIds } = input;
    if (materialIds.length === 0) return null;

    const existing = await this.prisma.materialList.findFirst({
      where: { companyId, sourceExtractionId: extractionId },
      select: { id: true, name: true },
    });

    const list =
      existing ??
      (await this.prisma.materialList.create({
        data: {
          name: await this.uniqueListName(companyId, listNameFromFile(fileName)),
          description: null,
          companyId,
          sourceExtractionId: extractionId,
          createdById: userId,
        },
        select: { id: true, name: true },
      }));

    await this.prisma.materialListItem.createMany({
      // De-duplicated because one uploaded file can carry the same SKU twice.
      data: [...new Set(materialIds)].map((materialId) => ({ listId: list.id, materialId })),
      skipDuplicates: true,
    });

    // createMany leaves updatedAt untouched; the list did change.
    await this.prisma.materialList.update({
      where: { id: list.id },
      data: { updatedAt: new Date() },
    });

    return list;
  }

  /** Suffix `base` with " (2)", " (3)"… until the company has no list by that name. */
  private async uniqueListName(companyId: string, base: string): Promise<string> {
    const taken = await this.prisma.materialList.findMany({
      where: { companyId, name: { startsWith: base } },
      select: { name: true },
    });
    const names = new Set(taken.map((l) => l.name));
    if (!names.has(base)) return base;

    for (let n = 2; n < 1000; n += 1) {
      const candidate = `${base} (${n})`;
      if (!names.has(candidate)) return candidate;
    }
    return base;
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
   * Returns created/updated counts (xmax=0 ⇒ inserted, else updated) plus the ids
   * of the affected rows — rows skipped by the owner guard below are absent from
   * both.
   */
  private async upsertSkuBatch(
    batch: CatalogueLineItem[],
    categoryMap: Map<string, string>,
    uncategorisedId: string,
    status: MaterialStatus,
    companyId: string | null,
    user: AuthenticatedUser,
  ): Promise<{ created: number; updated: number; ids: string[] }> {
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
        ${status}::"MaterialStatus", ${companyId}, ${user.id}, ${now}, ${now}
      )`;
    });

    const result = await this.prisma.$transaction(async (tx) => {
      return tx.$queryRaw<Array<{ id: string; inserted: boolean }>>(Prisma.sql`
        INSERT INTO materials (
          id, name, category_id, uom, upc, manufacturer, description,
          sku, brand, manufacturer_part_number, sub_category, image_url,
          status, company_id, created_by_id, created_at, updated_at
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
        -- Only update a row that already belongs to the SAME owner. A company
        -- import must not demote/overwrite a PUBLIC (company_id NULL) row or
        -- another company's private row that happens to share the SKU; those
        -- conflicting rows are skipped (neither insert nor update). US 4.02.
        WHERE materials.company_id IS NOT DISTINCT FROM ${companyId}
        RETURNING id, (xmax = 0) AS inserted
      `);
    });

    let created = 0;
    let updated = 0;
    const ids: string[] = [];
    for (const row of result) {
      if (row.inserted) created += 1;
      else updated += 1;
      ids.push(row.id);
    }
    return { created, updated, ids };
  }

  /**
   * SKU-less fallback: find a material by case-insensitive name + status, update
   * it if present, otherwise insert. Returns the affected row's id and whether it
   * already existed.
   */
  private async upsertByName(
    item: CatalogueLineItem,
    categoryMap: Map<string, string>,
    uncategorisedId: string,
    status: MaterialStatus,
    companyId: string | null,
    user: AuthenticatedUser,
  ): Promise<{ id: string; wasUpdated: boolean }> {
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
      companyId,
    };

    // Dedupe within the SAME owner+status so a company import only merges into
    // its own private rows, never a PUBLIC or another company's row (US 4.02).
    const existing = await this.prisma.material.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, status, companyId },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.material.update({ where: { id: existing.id }, data });
      return { id: existing.id, wasUpdated: true };
    }

    const created = await this.prisma.material.create({
      data: { ...data, createdById: user.id },
      select: { id: true },
    });
    return { id: created.id, wasUpdated: false };
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

  /**
   * Status + ownership visibility envelope shared by the list + facets queries.
   * A SuperAdmin sees the whole catalogue. A non-SuperAdmin sees the PUBLIC
   * shared catalogue PLUS their own company's private rows (any status, US 4.02)
   * — never another company's private rows.
   */
  private buildVisibilityWhere(user: AuthenticatedUser): Prisma.MaterialWhereInput {
    if (user.role === UserRole.SUPER_ADMIN) {
      return {};
    }
    return {
      OR: [
        { status: MaterialStatus.PUBLIC },
        // '__none__' is an unmatchable sentinel: a user with no company sees
        // only PUBLIC rows (no companyId can equal it).
        { companyId: user.companyId ?? '__none__' },
      ],
    };
  }

  /**
   * Normalise the `status` query (one value or a list) into a Prisma filter.
   * A single value stays a scalar equality so the emitted SQL is unchanged for
   * every existing caller; a list becomes `IN (…)`.
   */
  private static buildStatusFilter(
    status: MaterialStatus | MaterialStatus[] | undefined,
  ): MaterialStatus | Prisma.EnumMaterialStatusFilter | undefined {
    if (status === undefined) return undefined;
    const values = Array.isArray(status) ? status : [status];
    if (values.length === 0) return undefined;
    return values.length === 1 ? values[0] : { in: values };
  }

  private buildListWhere(
    query: MaterialListQueryDto,
    user: AuthenticatedUser,
  ): Prisma.MaterialWhereInput {
    const where: Prisma.MaterialWhereInput = {};

    // Status + ownership visibility (see buildVisibilityWhere). An explicit
    // `status` query is AND-ed inside that envelope, so e.g. the PRIVATE /
    // ARCHIVED views show only the company's own rows (public rows are always
    // PUBLIC).
    const statusFilter = MaterialsService.buildStatusFilter(query.status);
    if (user.role === UserRole.SUPER_ADMIN) {
      if (statusFilter) {
        where.status = statusFilter;
      }
    } else {
      where.AND = [
        this.buildVisibilityWhere(user),
        ...(statusFilter ? [{ status: statusFilter }] : []),
      ];
    }

    // ── Favourites filter (US 4.03) ──────────────────────────────────────────
    if (query.favourite === true) {
      where.favourites = { some: { userId: user.id } };
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
    isFavourite = false,
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
      costCode: m.costCode,
      taxCode: m.taxCode,
      dimensions: (m.dimensions as MaterialDimensions | null) ?? null,
      properties: (m.properties as MaterialProperties | null) ?? null,
      // Prisma's MaterialStatus union ↔ shared-types' MaterialStatus enum share
      // identical string values but are nominally distinct TS types.
      status: m.status as MaterialDetailDto['status'],
      companyId: m.companyId,
      isFavourite,
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

    // Visibility: a PUBLIC row is visible to everyone; otherwise only the
    // SuperAdmin or the owning company may see it (US 4.02). Anything else is a
    // 404 (don't leak that the row exists), never a 403.
    if (!this.isMaterialVisible(material, user)) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    const favourite = await this.prisma.materialFavourite.findUnique({
      where: { userId_materialId: { userId: user.id, materialId: id } },
      select: { id: true },
    });

    return this.toDetail(material, favourite !== null);
  }

  /**
   * Whether a material is visible to the user: PUBLIC rows to everyone, the
   * SuperAdmin sees all, and a company-private row only to its owning company
   * (US 4.02). Cross-company private rows are invisible (caller 404s).
   */
  private isMaterialVisible(
    material: { status: MaterialStatus; companyId: string | null },
    user: AuthenticatedUser,
  ): boolean {
    if (material.status === MaterialStatus.PUBLIC) return true;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    return material.companyId !== null && material.companyId === user.companyId;
  }

  /**
   * Assert the caller may run a destructive lifecycle action (archive / restore /
   * delete) on this material. A Super-Admin owns the whole catalogue. Anyone else
   * may only touch rows their OWN company owns: the shared public catalogue is
   * read-only for contractors (spec FR-R1-D04) → 403, while another company's
   * private row is invisible → 404, never confirming that it exists.
   *
   * Public (not private) because MaterialStatusService shares it.
   */
  assertCanManageMaterial(
    material: { status: MaterialStatus; companyId: string | null },
    user: AuthenticatedUser,
  ): void {
    if (user.role === UserRole.SUPER_ADMIN) return;

    if (!this.isMaterialVisible(material, user)) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    if (material.companyId === null || material.companyId !== user.companyId) {
      throw new ForbiddenException(ERR.materials.publicReadOnly);
    }
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

    // SuperAdmin edits apply directly to the live material (Phase 1 behaviour).
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.applyMaterialUpdate(id, dto, existing);
    }

    // Non-SuperAdmin: must be visible (PUBLIC or own-company private) — anything
    // else (e.g. another company's private row) is a 404, not a 403/leak.
    if (!this.isMaterialVisible(existing, user)) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    // A company's OWN private draft (companyId === user.companyId, not yet
    // PUBLIC) is theirs to edit directly — no approval queue (US 4.02).
    if (existing.status !== MaterialStatus.PUBLIC && existing.companyId === user.companyId) {
      return this.applyMaterialUpdate(id, dto, existing);
    }

    // Phase 3: a Company-Admin / Procurement-Officer edit of a PUBLIC shared row
    // is captured as a PENDING change request — the live material is left
    // untouched until the catalogue Super-Admin approves it. Validate up front so
    // the editor gets immediate feedback rather than a deferred approval-time error.
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
        // Optional note the contributor supplied explaining WHY they proposed the
        // edit (US 4.01 Phase 3). Shown to the reviewer on the pending diff card.
        reason: nullableTrim(dto.changeReason),
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
    existing: Pick<Material, 'name' | 'companyId' | 'status'>,
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
      // Duplicate check scoped to the row's visibility envelope (US 4.02): a
      // PUBLIC row collides only with the public catalogue; a private row
      // collides with the public catalogue or its own company's rows — never
      // another company's private materials. Self is excluded.
      const duplicate = await this.prisma.material.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
          OR: [{ status: MaterialStatus.PUBLIC }, { companyId: existing.companyId ?? '__none__' }],
        },
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
    assign('costCode', 'costCode');
    assign('taxCode', 'taxCode');
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
    const existing = await this.prisma.material.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });
    if (!existing) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    // A Super-Admin may delete anything; a company only its own rows (403 on the
    // shared public catalogue, 404 on another company's private row).
    this.assertCanManageMaterial(existing, user);

    // A material referenced by any procurement document cannot be hard-deleted —
    // it must be archived instead so historical documents keep their link.
    // Material-list membership is deliberately NOT a reference: a list is a
    // convenience collection, not a historical record, and every row of an
    // uploaded catalogue belongs to the list that upload created — counting it
    // would make a company's own imported materials undeletable.
    const [poLineItems, rfqLineItems, quoteResponseLineItems, bomItems] = await Promise.all([
      this.prisma.poLineItem.count({ where: { materialId: id } }),
      this.prisma.rfqLineItem.count({ where: { materialId: id } }),
      this.prisma.quoteResponseLineItem.count({ where: { substituteItemId: id } }),
      this.prisma.bomItem.count({ where: { matchedMaterialId: id } }),
    ]);

    const references = poLineItems + rfqLineItems + quoteResponseLineItems + bomItems;

    if (references > 0) {
      throw new ConflictException(ERR.materials.referenced(references));
    }

    await this.prisma.$transaction(async (tx) => {
      // material_list_items.material_id is ON DELETE RESTRICT, so drop the
      // memberships first. Favourites and usage rows cascade on their own.
      await tx.materialListItem.deleteMany({ where: { materialId: id } });
      await tx.material.delete({ where: { id } });
    });

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
    user: AuthenticatedUser,
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
      // Check against the public catalogue PLUS the user's own company-private
      // rows (US 4.02): the candidate's own envelope. AND-ed with the name/sku/upc
      // OR so we never surface another company's private rows as a "duplicate".
      where: {
        AND: [
          { OR: or },
          {
            OR: [{ status: MaterialStatus.PUBLIC }, { companyId: user.companyId ?? '__none__' }],
          },
        ],
      },
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
    const cr = await this.prisma.materialChangeRequest.findUnique({
      where: { id },
      include: {
        material: { select: { id: true, name: true } },
        requestedBy: { select: { email: true } },
      },
    });
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

    // Notify the contributor their edit went live (fire-and-forget).
    this.notifyMaterialChangeResolved(
      cr.requestedBy?.email,
      cr.material.name,
      cr.material.id,
      'approved',
    ).catch(() => {});

    return this.toChangeRequestDto(updated);
  }

  /** Reject a pending change request — discards it; the material is untouched. */
  async rejectChangeRequest(
    id: string,
    dto: ResolveMaterialChangeDto | undefined,
    user: AuthenticatedUser,
  ): Promise<MaterialChangeRequestDto> {
    const cr = await this.prisma.materialChangeRequest.findUnique({
      where: { id },
      include: {
        material: { select: { id: true, name: true } },
        requestedBy: { select: { email: true } },
      },
    });
    if (!cr) throw new NotFoundException(ERR.materials.changeRequestNotFound);
    if (cr.status !== MaterialChangeRequestStatus.PENDING) {
      throw new BadRequestException(ERR.materials.changeRequestNotPending);
    }

    const reason = nullableTrim(dto?.reason);

    const updated = await this.prisma.materialChangeRequest.update({
      where: { id },
      data: {
        status: MaterialChangeRequestStatus.REJECTED,
        reason,
        resolvedById: user.id,
        resolvedAt: new Date(),
      },
      include: {
        material: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    // Notify the contributor their edit was declined (fire-and-forget), passing
    // the reviewer's reason through when one was given.
    this.notifyMaterialChangeResolved(
      cr.requestedBy?.email,
      cr.material.name,
      cr.material.id,
      'rejected',
      reason ?? undefined,
    ).catch(() => {});

    return this.toChangeRequestDto(updated);
  }

  /**
   * Email the original contributor the outcome of their proposed catalogue edit
   * (US 4.01 Phase 3). No-op when the requester has no email on file. Best-effort:
   * every caller invokes this fire-and-forget so a mail failure never blocks the
   * (already committed) approval / rejection.
   */
  private async notifyMaterialChangeResolved(
    email: string | null | undefined,
    materialName: string,
    materialId: string,
    outcome: 'approved' | 'rejected',
    reason?: string,
  ): Promise<void> {
    if (!email) return;
    const viewUrl = `${this.webAppUrl}/material-catalogue/${materialId}`;
    if (outcome === 'approved') {
      await this.emailService.sendMaterialChangeApprovedEmail(email, materialName, viewUrl);
    } else {
      await this.emailService.sendMaterialChangeRejectedEmail(email, materialName, viewUrl, reason);
    }
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
        // Structured JSON fields — flatten to a readable "key: value" summary so
        // the reviewer sees the actual before/after, not an opaque marker.
        changes[key] = {
          from: this.formatStructuredValue(val.from),
          to: this.formatStructuredValue(val.to),
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

  /**
   * Flatten a structured material field (`dimensions` / `properties`) into a
   * readable "key: value" summary for the review diff (US 4.01 Phase 3). Empty or
   * absent values collapse to null so the card renders a clean "—".
   */
  private formatStructuredValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object') return this.formatStructuredLeaf(value);

    const parts: string[] = [];
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const leaf = this.formatStructuredLeaf(raw);
      if (leaf !== null) parts.push(`${key}: ${leaf}`);
    }
    return parts.length > 0 ? parts.join(', ') : null;
  }

  /**
   * Render a single leaf of a structured field. Dimension axes stored as
   * `{ value, uom }` become "10 mm"; nested objects (packaging) flatten one more
   * level; scalars pass through. Empty leaves return null so they are dropped.
   */
  private formatStructuredLeaf(raw: unknown): string | null {
    if (raw === null || raw === undefined || raw === '') return null;

    if (typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if ('value' in obj || 'uom' in obj) {
        const value = obj.value;
        const uom = obj.uom;
        if ((value === null || value === undefined) && (uom === null || uom === undefined)) {
          return null;
        }
        return (
          [value, uom]
            .filter((x) => x !== null && x !== undefined && x !== '')
            .map((x) => this.stringifyScalar(x))
            .join(' ')
            .trim() || null
        );
      }

      const inner: string[] = [];
      for (const [key, val] of Object.entries(obj)) {
        const leaf = this.formatStructuredLeaf(val);
        if (leaf !== null) inner.push(`${key}: ${leaf}`);
      }
      return inner.length > 0 ? inner.join(', ') : null;
    }

    return this.stringifyScalar(raw);
  }

  /** Coerce a leaf diff value to a display string without risking "[object Object]". */
  private stringifyScalar(v: unknown): string {
    if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  }

  // ── Favourites (US 4.03) ──────────────────────────────────────────────────

  /**
   * Mark a material as a favourite for the current user. Idempotent — a repeat
   * add is a no-op upsert on the (userId, materialId) composite unique. The
   * material must be visible to the user (PUBLIC or own-company private), else
   * 404 — you cannot favourite a row you can't see.
   */
  async addFavourite(materialId: string, user: AuthenticatedUser): Promise<{ success: true }> {
    await this.assertMaterialVisible(materialId, user);

    await this.prisma.materialFavourite.upsert({
      where: { userId_materialId: { userId: user.id, materialId } },
      create: { userId: user.id, materialId },
      update: {},
    });

    return { success: true };
  }

  /**
   * Remove a material from the current user's favourites. No-op safe — removing
   * a material that isn't favourited (or doesn't exist) succeeds silently via
   * deleteMany. No visibility check is needed: deleteMany is scoped to this
   * user's own rows, so there is nothing to leak.
   */
  async removeFavourite(materialId: string, user: AuthenticatedUser): Promise<{ success: true }> {
    await this.prisma.materialFavourite.deleteMany({
      where: { userId: user.id, materialId },
    });

    return { success: true };
  }

  /** Load a material and assert it is visible to the user, else 404. */
  private async assertMaterialVisible(id: string, user: AuthenticatedUser): Promise<void> {
    const material = await this.prisma.material.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });
    if (!material || !this.isMaterialVisible(material, user)) {
      throw new NotFoundException(ERR.materials.notFound);
    }
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
