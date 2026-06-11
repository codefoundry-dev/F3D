import {
  getBom,
  getBoms,
  getMaterialList,
  getMaterialLists,
  getProjects,
  type BomDetailDto,
  type BomItemDto,
  type BomListItemDto,
  type MaterialListDetailDto,
  type ProjectListItem,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  SourcePickerModal,
  type PickedSourceItem,
  type SourceEntity,
  type SourceItem,
} from './SourcePickerModal';
import type { WizardSeed } from './wizard-types';

/* ─── Data hooks ──────────────────────────────────────────────────── */

export function useBomEntities(projectIds?: string[]) {
  return useQuery({
    queryKey: ['boms', 'all'],
    queryFn: () => getBoms(),
    select: (boms: BomListItemDto[]) =>
      projectIds && projectIds.length > 0
        ? boms.filter((bom) => projectIds.includes(bom.projectId))
        : boms,
  });
}

function useBomItemsQuery(bomId: string | null) {
  return useQuery({
    queryKey: ['boms', bomId],
    queryFn: () => getBom(bomId as string),
    enabled: !!bomId,
  });
}

export function useMaterialListEntities() {
  return useQuery({
    queryKey: ['material-lists'],
    queryFn: () => getMaterialLists(),
  });
}

function useMaterialListItemsQuery(listId: string | null) {
  return useQuery({
    queryKey: ['material-lists', listId],
    queryFn: () => getMaterialList(listId as string),
    enabled: !!listId,
  });
}

/* ─── Mapping helpers ─────────────────────────────────────────────── */

function bomToEntity(bom: BomListItemDto, projectNames: Map<string, string>): SourceEntity {
  return {
    id: bom.id,
    name: projectNames.get(bom.projectId) ?? bom.bomNumber,
    description: bom.bomNumber,
  };
}

function bomItemToSourceItem(item: BomItemDto, bom: BomDetailDto): SourceItem {
  return {
    id: item.id,
    name: item.matchedMaterialName ?? item.materialName,
    materialId: item.matchedMaterialId ?? undefined,
    uom: item.uom ?? undefined,
    description: item.description ?? undefined,
    category: item.category ?? undefined,
    sourceQuantity: item.quantity ?? undefined,
    projectId: bom.projectId,
  };
}

function materialListItemToSourceItem(
  item: MaterialListDetailDto['items'][number],
): SourceItem {
  return {
    id: item.id,
    name: item.material.name,
    materialId: item.material.id,
    manufacturer: item.material.manufacturer ?? undefined,
    uom: item.material.uom,
    description: item.material.description ?? undefined,
    category: item.material.category?.name,
    sourceQuantity: item.quantity,
  };
}

function pickedToSeedItem(
  picked: PickedSourceItem,
  source: WizardSeed['source'],
): WizardSeed['items'][number] {
  return {
    source,
    materialId: picked.materialId,
    materialName: picked.name,
    description: picked.description,
    quantity: picked.quantity,
    uom: picked.pickedUom,
    projectId: picked.projectId,
  };
}

/* ─── In-wizard: Add from BOM ─────────────────────────────────────── */

interface AddFromBomModalProps {
  /** Wizard-selected projects ("BOM: show only list from chosen projects"). */
  projectIds: string[];
  projects: ProjectListItem[];
  onAdd: (items: WizardSeed['items']) => void;
  onClose: () => void;
}

export function AddFromBomModal({ projectIds, projects, onAdd, onClose }: AddFromBomModalProps) {
  const { t } = useTranslation('rfqs');
  const { data: boms = [], isLoading } = useBomEntities(projectIds);
  const [openEntity, setOpenEntity] = useState<SourceEntity | null>(null);
  const detail = useBomItemsQuery(openEntity?.id ?? null);

  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  const entities = useMemo(
    () => boms.map((bom) => bomToEntity(bom, projectNames)),
    [boms, projectNames],
  );
  const items = useMemo<SourceItem[]>(() => {
    const bom = detail.data;
    if (!bom || bom.id !== openEntity?.id) return [];
    return bom.items.map((item) => bomItemToSourceItem(item, bom));
  }, [detail.data, openEntity?.id]);

  return (
    <SourcePickerModal
      texts={{
        title: t('create.picker.addFromBomTitle'),
        subtitle: t('create.picker.addFromBomSubtitle'),
        // Design annotation: "When selected, add to table with exact qty as on BOM".
        defaultQuantity: (item) => item.sourceQuantity ?? 1,
      }}
      entities={entities}
      entitiesLoading={isLoading}
      openEntity={openEntity}
      onOpenEntityChange={setOpenEntity}
      items={items}
      itemsLoading={detail.isLoading}
      onClose={onClose}
      onCommit={(picked) => {
        onAdd(picked.map((item) => pickedToSeedItem(item, 'BOM')));
        onClose();
      }}
    />
  );
}

/* ─── In-wizard: Add from material list ───────────────────────────── */

interface AddFromMaterialListModalProps {
  onAdd: (items: WizardSeed['items']) => void;
  onClose: () => void;
}

export function AddFromMaterialListModal({ onAdd, onClose }: AddFromMaterialListModalProps) {
  const { t } = useTranslation('rfqs');
  const { data: lists = [], isLoading } = useMaterialListEntities();
  const [openEntity, setOpenEntity] = useState<SourceEntity | null>(null);
  const detail = useMaterialListItemsQuery(openEntity?.id ?? null);

  const entities = useMemo<SourceEntity[]>(
    () =>
      lists.map((list) => ({
        id: list.id,
        name: list.name,
        description: list.description ?? undefined,
      })),
    [lists],
  );
  const items = useMemo<SourceItem[]>(() => {
    const list = detail.data;
    if (!list || list.id !== openEntity?.id) return [];
    return list.items.map(materialListItemToSourceItem);
  }, [detail.data, openEntity?.id]);

  return (
    <SourcePickerModal
      texts={{
        title: t('create.picker.addFromMaterialListTitle'),
        subtitle: t('create.picker.addFromMaterialListSubtitle'),
        // Design annotation: "When selected, add to table with 1 qty".
        defaultQuantity: () => 1,
      }}
      entities={entities}
      entitiesLoading={isLoading}
      openEntity={openEntity}
      onOpenEntityChange={setOpenEntity}
      items={items}
      itemsLoading={detail.isLoading}
      onClose={onClose}
      onCommit={(picked) => {
        onAdd(picked.map((item) => pickedToSeedItem(item, 'MATERIAL_LIST')));
        onClose();
      }}
    />
  );
}

/* ─── Standalone: Converting BOM / Create from material list ──────── */

interface ConvertSourceModalProps {
  kind: 'BOM' | 'MATERIAL_LIST';
  onClose: () => void;
  /** Receives the wizard seed once the selection is resolved. */
  onContinue: (seed: WizardSeed) => void;
}

/**
 * "Converting BOM" / "Create from material list" (Figma 5.05 sections 1.3/1.4):
 * pick whole containers (Select all / per-row ⊕) and/or drill in to cherry-pick
 * items, then Continue → the Create-RFQ wizard opens prefilled.
 */
export function ConvertSourceModal({ kind, onClose, onContinue }: ConvertSourceModalProps) {
  const { t } = useTranslation('rfqs');
  const isBom = kind === 'BOM';
  const { data: projectsPage } = useQuery({
    queryKey: ['projects', { limit: 100 }],
    queryFn: () => getProjects({ limit: 100 }),
  });
  const projects = useMemo<ProjectListItem[]>(() => projectsPage?.items ?? [], [projectsPage]);
  const bomQuery = useBomEntities(undefined);
  const listQuery = useMaterialListEntities();
  const [openEntity, setOpenEntity] = useState<SourceEntity | null>(null);
  const bomDetail = useBomItemsQuery(isBom ? (openEntity?.id ?? null) : null);
  const listDetail = useMaterialListItemsQuery(isBom ? null : (openEntity?.id ?? null));
  const [resolving, setResolving] = useState(false);

  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const entities = useMemo<SourceEntity[]>(() => {
    if (isBom) return (bomQuery.data ?? []).map((bom) => bomToEntity(bom, projectNames));
    return (listQuery.data ?? []).map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description ?? undefined,
    }));
  }, [isBom, bomQuery.data, listQuery.data, projectNames]);

  const items = useMemo<SourceItem[]>(() => {
    if (isBom) {
      const bom = bomDetail.data;
      if (!bom || bom.id !== openEntity?.id) return [];
      return bom.items.map((item) => bomItemToSourceItem(item, bom));
    }
    const list = listDetail.data;
    if (!list || list.id !== openEntity?.id) return [];
    return list.items.map(materialListItemToSourceItem);
  }, [isBom, bomDetail.data, listDetail.data, openEntity?.id]);

  /** Resolve picked items + every item of fully-selected entities into a seed. */
  const handleCommit = async (picked: PickedSourceItem[], selectedEntityIds: string[]) => {
    setResolving(true);
    try {
      const seedItems: WizardSeed['items'] = picked.map((item) => pickedToSeedItem(item, kind));
      const pickedIds = new Set(picked.map((item) => item.id));

      for (const entityId of selectedEntityIds) {
        if (isBom) {
          const detail = await getBom(entityId);
          for (const item of detail.items) {
            if (pickedIds.has(item.id)) continue;
            seedItems.push({
              source: 'BOM',
              materialId: item.matchedMaterialId ?? undefined,
              materialName: item.matchedMaterialName ?? item.materialName,
              description: item.description ?? undefined,
              quantity: item.quantity ?? 1,
              uom: item.uom ?? 'unit',
              projectId: detail.projectId,
            });
          }
        } else {
          const detail = await getMaterialList(entityId);
          for (const item of detail.items) {
            if (pickedIds.has(item.id)) continue;
            seedItems.push({
              source: 'MATERIAL_LIST',
              materialId: item.material.id,
              materialName: item.material.name,
              description: item.material.description ?? undefined,
              quantity: item.quantity,
              uom: item.material.uom,
            });
          }
        }
      }

      const projectIds = new Set<string>();
      for (const item of seedItems) if (item.projectId) projectIds.add(item.projectId);

      onContinue({
        source: kind,
        projectIds: isBom ? [...projectIds] : undefined,
        items: seedItems,
      });
    } finally {
      setResolving(false);
    }
  };

  return (
    <SourcePickerModal
      texts={{
        title: isBom
          ? t('create.picker.convertBomTitle')
          : t('create.picker.convertMaterialListTitle'),
        subtitle: isBom
          ? t('create.picker.convertBomSubtitle')
          : t('create.picker.convertMaterialListSubtitle'),
        defaultQuantity: (item) => item.sourceQuantity ?? 1,
      }}
      entities={entities}
      entitiesLoading={isBom ? bomQuery.isLoading : listQuery.isLoading}
      openEntity={openEntity}
      onOpenEntityChange={setOpenEntity}
      items={items}
      itemsLoading={isBom ? bomDetail.isLoading : listDetail.isLoading}
      convertMode
      onClose={onClose}
      onCommit={(picked, selectedEntityIds) => void handleCommit(picked, selectedEntityIds)}
      commitBusy={resolving}
    />
  );
}
