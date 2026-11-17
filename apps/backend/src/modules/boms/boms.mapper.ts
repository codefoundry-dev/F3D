import type { BomWithCounts, BomWithItems } from './boms.service';

/**
 * Wire shapes for the BOM endpoints. Mirrors the api-client interfaces
 * (`packages/api-client/src/endpoints/boms.ts`) — keep the two in sync.
 */
export interface BomItemResponse {
  id: string;
  materialName: string;
  /** Null for a line saved without a catalogue match. */
  matchedMaterialId: string | null;
  matchedMaterialName: string | null;
  /** Catalogue image of the matched material, or null. */
  imageUrl: string | null;
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
    matchedCount: bom._count.items - (bom.unmatchedCount ?? 0),
    createdBy: { id: bom.createdBy.id, name: bom.createdBy.name },
    createdAt: bom.createdAt.toISOString(),
    updatedAt: bom.updatedAt.toISOString(),
  };
}

export function toBomDetailResponse(bom: BomWithItems): BomDetailResponse {
  return {
    ...toBomListItemResponse(bom),
    matchedCount: bom.items.filter((item) => item.matchedMaterialId !== null).length,
    items: bom.items.map((item) => ({
      id: item.id,
      materialName: item.materialName,
      matchedMaterialId: item.matchedMaterialId,
      matchedMaterialName: item.matchedMaterial?.name ?? null,
      imageUrl: item.matchedMaterial?.imageUrl ?? null,
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
