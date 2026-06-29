import type { PrismaService } from '../../prisma/prisma.service';

/**
 * The catalogue-derived codes snapshotted onto an RFQ/PO line item at create.
 *
 * `costCode` and `taxCode` act as catalogue DEFAULTS — they pre-fill the editable
 * per-line values; `upc` and `manufacturerPartNumber` are pure snapshots so a line
 * keeps the values it was created with even if the catalogue material later
 * changes. All four resolve the same way: an explicitly-provided value wins,
 * otherwise the linked material's value is used.
 */
export interface MaterialSnapshotFields {
  upc: string | null;
  manufacturerPartNumber: string | null;
  costCode: string | null;
  taxCode: string | null;
}

export type MaterialSnapshotMap = Map<string, MaterialSnapshotFields>;

/** Trim a possibly-blank string, collapsing empty/whitespace results to null. */
function blankToNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  // Note: not `trimmed ?? null` — an empty/whitespace string must also collapse
  // to null, which `??` would let through.
  if (trimmed === undefined || trimmed === '') return null;
  return trimmed;
}

/**
 * Load the snapshot fields for a set of catalogue material ids in ONE query
 * (no N+1). Blank/duplicate ids are ignored; the returned map is keyed by id.
 */
export async function loadMaterialSnapshots(
  prisma: PrismaService,
  materialIds: (string | null | undefined)[],
): Promise<MaterialSnapshotMap> {
  const uniqueIds = [...new Set(materialIds.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();

  const rows = await prisma.material.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      upc: true,
      manufacturerPartNumber: true,
      costCode: true,
      taxCode: true,
    },
  });

  return new Map(
    rows.map((r) => [
      r.id,
      {
        upc: r.upc,
        manufacturerPartNumber: r.manufacturerPartNumber,
        costCode: r.costCode,
        taxCode: r.taxCode,
      },
    ]),
  );
}

/**
 * Resolve the four snapshot fields for one line item: an explicitly-provided
 * value wins, otherwise it falls back to the linked material's value. Lines with
 * no catalogue material (free-text/BOM) keep only whatever was provided.
 */
export function resolveMaterialSnapshot(
  input: {
    upc?: string | null;
    manufacturerPartNumber?: string | null;
    costCode?: string | null;
    taxCode?: string | null;
  },
  materialId: string | null | undefined,
  snapshots: MaterialSnapshotMap,
): MaterialSnapshotFields {
  const snap = materialId ? snapshots.get(materialId) : undefined;
  return {
    upc: blankToNull(input.upc) ?? snap?.upc ?? null,
    manufacturerPartNumber:
      blankToNull(input.manufacturerPartNumber) ?? snap?.manufacturerPartNumber ?? null,
    costCode: blankToNull(input.costCode) ?? snap?.costCode ?? null,
    taxCode: blankToNull(input.taxCode) ?? snap?.taxCode ?? null,
  };
}
