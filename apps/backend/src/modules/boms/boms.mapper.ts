import type { BomWithCounts, BomWithItems } from './boms.service';

/**
 * Wire shapes for the BOM endpoints. Mirrors the api-client interfaces
 * (`packages/api-client/src/endpoints/boms.ts`) — keep the two in sync.
 */
export interface BomItemResponse {
  id: string;
  materialName: string;
  matchedMaterialId: string;
  matchedMaterialName: string | null;
  description: string | null;
  uom: string | null;
  quantity: number | null;
  category: string | null;
  materialType: string | null;
  matchConfidence: number | null;
  sortOrder: number;
}

export interface BomListItemResponse {
  id: string;
  bomNumber: string;
  projectId: string;
  status: string;
  extractionId: string | null;
  itemCount: number;
  matchedCount: number;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface BomDetailResponse extends BomListItemResponse {
  items: BomItemResponse[];
}

export function toBomListItemResponse(bom: BomWithCounts): BomListItemResponse {
  return {
    id: bom.id,
    bomNumber: bom.bomNumber,
    projectId: bom.projectId,
    status: bom.status,
    extractionId: bom.extractionId,
    itemCount: bom._count.items,
    // Every saved line is catalogue-matched (enforced at create), so the
    // "Matched" column reads n/n today; kept separate for future partial saves.
    matchedCount: bom._count.items,
    createdBy: { id: bom.createdBy.id, name: bom.createdBy.name },
    createdAt: bom.createdAt.toISOString(),
    updatedAt: bom.updatedAt.toISOString(),
  };
}

export function toBomDetailResponse(bom: BomWithItems): BomDetailResponse {
  return {
    ...toBomListItemResponse(bom),
    items: bom.items.map((item) => ({
      id: item.id,
      materialName: item.materialName,
      matchedMaterialId: item.matchedMaterialId,
      matchedMaterialName: item.matchedMaterial?.name ?? null,
      description: item.description,
      uom: item.uom,
      quantity: item.quantity === null ? null : Number(item.quantity),
      category: item.category,
      materialType: item.materialType,
      matchConfidence: item.matchConfidence,
      sortOrder: item.sortOrder,
    })),
  };
}
