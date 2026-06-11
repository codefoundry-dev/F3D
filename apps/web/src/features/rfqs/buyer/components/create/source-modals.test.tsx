import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const getBoms = vi.hoisted(() => vi.fn());
const getBom = vi.hoisted(() => vi.fn());
const getMaterialLists = vi.hoisted(() => vi.fn());
const getMaterialList = vi.hoisted(() => vi.fn());
const getProjects = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@forethread/api-client', () => ({
  getBoms,
  getBom,
  getMaterialLists,
  getMaterialList,
  getProjects,
}));

// Capture the props handed to the picker and expose buttons that fire the
// real onCommit / onOpenEntityChange callbacks so the wiring runs.
vi.mock('./SourcePickerModal', () => ({
  SourcePickerModal: (p: any) => (
    <div data-testid="picker">
      <span data-testid="picker-title">{p.texts.title}</span>
      <span data-testid="picker-subtitle">{p.texts.subtitle}</span>
      <span data-testid="picker-entities-loading">{String(p.entitiesLoading)}</span>
      <span data-testid="picker-items-loading">{String(p.itemsLoading)}</span>
      <span data-testid="picker-convert">{String(!!p.convertMode)}</span>
      <span data-testid="picker-commit-busy">{String(!!p.commitBusy)}</span>
      <span data-testid="picker-entity-count">{p.entities.length}</span>
      <span data-testid="picker-default-qty">{p.texts.defaultQuantity({ sourceQuantity: 9 })}</span>
      <span data-testid="picker-item-count">{p.items.length}</span>
      <span data-testid="picker-item-names">{p.items.map((i: any) => i.name).join(',')}</span>
      <button
        type="button"
        data-testid="commit"
        onClick={() =>
          p.onCommit(
            [
              {
                id: 'i1',
                name: 'Item',
                materialId: 'm1',
                description: 'd',
                quantity: 2,
                pickedUom: 'unit',
                projectId: 'p1',
                entityId: 'b1',
              },
            ],
            ['b1'],
          )
        }
      >
        commit
      </button>
      <button
        type="button"
        data-testid="open"
        onClick={() => p.onOpenEntityChange({ id: 'b1', name: 'BOM 1' })}
      >
        open
      </button>
      <button type="button" data-testid="close" onClick={() => p.onClose()}>
        close
      </button>
    </div>
  ),
}));

import { AddFromBomModal, AddFromMaterialListModal, ConvertSourceModal } from './source-modals';

const BOM_LIST = [
  { id: 'b1', projectId: 'p1', bomNumber: 'BOM-1' },
  { id: 'b2', projectId: 'p2', bomNumber: 'BOM-2' },
];

const BOM_DETAIL = {
  id: 'b1',
  projectId: 'p1',
  items: [
    {
      id: 'i1',
      materialName: 'M',
      matchedMaterialId: 'm1',
      matchedMaterialName: 'M',
      uom: 'unit',
      quantity: 3,
      description: 'd',
      category: 'c',
    },
    { id: 'i2', materialName: 'M2', quantity: 1 },
  ],
};

const MATERIAL_LISTS = [{ id: 'l1', name: 'List 1', description: 'd' }];

const MATERIAL_LIST_DETAIL = {
  id: 'l1',
  name: 'List 1',
  items: [
    {
      id: 'li1',
      quantity: 2,
      material: {
        id: 'm2',
        name: 'Mat2',
        uom: 'unit',
        manufacturer: 'x',
        description: 'd',
        category: { name: 'c' },
      },
    },
  ],
};

const PROJECTS = { items: [{ id: 'p1', name: 'Proj 1' }] };

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getBoms.mockResolvedValue(BOM_LIST);
  getBom.mockResolvedValue(BOM_DETAIL);
  getMaterialLists.mockResolvedValue(MATERIAL_LISTS);
  getMaterialList.mockResolvedValue(MATERIAL_LIST_DETAIL);
  getProjects.mockResolvedValue(PROJECTS);
});

describe('AddFromBomModal', () => {
  it('renders the picker with BOM texts and mapped entities', async () => {
    render(
      <AddFromBomModal
        projectIds={['p1']}
        projects={[{ id: 'p1', name: 'Proj 1' } as any]}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper: wrapper() },
    );
    expect(screen.getByTestId('picker-title')).toHaveTextContent('create.picker.addFromBomTitle');
    expect(screen.getByTestId('picker-subtitle')).toHaveTextContent(
      'create.picker.addFromBomSubtitle',
    );
    // BOM uses sourceQuantity as the default quantity (9).
    expect(screen.getByTestId('picker-default-qty')).toHaveTextContent('9');
    await waitFor(() => expect(getBoms).toHaveBeenCalled());
    // Only the p1 BOM should survive the projectIds filter → entity name = project name.
    await waitFor(() => expect(screen.getByTestId('picker-entity-count')).toHaveTextContent('1'));
  });

  it('drills in and maps the BOM detail items', async () => {
    render(
      <AddFromBomModal
        projectIds={['p1']}
        projects={[{ id: 'p1', name: 'Proj 1' } as any]}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper: wrapper() },
    );
    fireEvent.click(screen.getByTestId('open'));
    await waitFor(() => expect(getBom).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(screen.getByTestId('picker-item-count')).toHaveTextContent('2'));
    // matchedMaterialName falls back to materialName for i2.
    expect(screen.getByTestId('picker-item-names')).toHaveTextContent('M,M2');
  });

  it('maps picked items to BOM seed items and closes on commit', async () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(
      <AddFromBomModal
        projectIds={['p1']}
        projects={[{ id: 'p1', name: 'Proj 1' } as any]}
        onAdd={onAdd}
        onClose={onClose}
      />,
      { wrapper: wrapper() },
    );
    fireEvent.click(screen.getByTestId('commit'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toEqual([
      {
        source: 'BOM',
        materialId: 'm1',
        materialName: 'Item',
        description: 'd',
        quantity: 2,
        uom: 'unit',
        projectId: 'p1',
      },
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('passes no project filter loading entities when projectIds is empty', async () => {
    render(<AddFromBomModal projectIds={[]} projects={[]} onAdd={vi.fn()} onClose={vi.fn()} />, {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(getBoms).toHaveBeenCalled());
    // No projectIds filter → both BOMs surface, named by their bomNumber fallback.
    await waitFor(() => expect(screen.getByTestId('picker-entity-count')).toHaveTextContent('2'));
  });
});

describe('AddFromMaterialListModal', () => {
  it('renders the picker with material-list texts and a default qty of 1', async () => {
    render(<AddFromMaterialListModal onAdd={vi.fn()} onClose={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.getByTestId('picker-title')).toHaveTextContent(
      'create.picker.addFromMaterialListTitle',
    );
    expect(screen.getByTestId('picker-subtitle')).toHaveTextContent(
      'create.picker.addFromMaterialListSubtitle',
    );
    // Material list always defaults to qty 1 regardless of sourceQuantity.
    expect(screen.getByTestId('picker-default-qty')).toHaveTextContent('1');
    await waitFor(() => expect(getMaterialLists).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('picker-entity-count')).toHaveTextContent('1'));
  });

  it('drills in and maps the material-list detail items', async () => {
    // The drill-in maps items only when the resolved detail id matches the
    // opened entity id (the mock "open" button opens id 'b1').
    getMaterialList.mockResolvedValue({ ...MATERIAL_LIST_DETAIL, id: 'b1' });
    render(<AddFromMaterialListModal onAdd={vi.fn()} onClose={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByTestId('open'));
    await waitFor(() => expect(getMaterialList).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(screen.getByTestId('picker-item-count')).toHaveTextContent('1'));
    expect(screen.getByTestId('picker-item-names')).toHaveTextContent('Mat2');
  });

  it('maps picked items to MATERIAL_LIST seed items and closes on commit', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<AddFromMaterialListModal onAdd={onAdd} onClose={onClose} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByTestId('commit'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toEqual([
      {
        source: 'MATERIAL_LIST',
        materialId: 'm1',
        materialName: 'Item',
        description: 'd',
        quantity: 2,
        uom: 'unit',
        projectId: 'p1',
      },
    ]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ConvertSourceModal — BOM', () => {
  it('renders the picker in convert mode with BOM texts', async () => {
    render(<ConvertSourceModal kind="BOM" onClose={vi.fn()} onContinue={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.getByTestId('picker-convert')).toHaveTextContent('true');
    expect(screen.getByTestId('picker-title')).toHaveTextContent('create.picker.convertBomTitle');
    expect(screen.getByTestId('picker-subtitle')).toHaveTextContent(
      'create.picker.convertBomSubtitle',
    );
    await waitFor(() => expect(getBoms).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('picker-entity-count')).toHaveTextContent('2'));
  });

  it('resolves selected entities into a BOM seed and calls onContinue', async () => {
    const onContinue = vi.fn();
    render(<ConvertSourceModal kind="BOM" onClose={vi.fn()} onContinue={onContinue} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByTestId('commit'));
    await waitFor(() => expect(onContinue).toHaveBeenCalled());
    // getBom is called for the selected entity id 'b1'.
    expect(getBom).toHaveBeenCalledWith('b1');
    const seed = onContinue.mock.calls[0][0];
    expect(seed.source).toBe('BOM');
    // The picked item (i1) + the non-picked BOM detail item (i2) are merged.
    expect(seed.items).toHaveLength(2);
    // Picked item kept as-is.
    expect(seed.items[0]).toMatchObject({ source: 'BOM', materialId: 'm1', quantity: 2 });
    // i2 expanded from the BOM detail (matchedMaterialName falls back to materialName).
    expect(seed.items[1]).toMatchObject({
      source: 'BOM',
      materialName: 'M2',
      quantity: 1,
      uom: 'unit',
      projectId: 'p1',
    });
    // projectIds derived from the seed items.
    expect(seed.projectIds).toEqual(['p1']);
  });

  it('drills into a BOM entity and maps its items', async () => {
    render(<ConvertSourceModal kind="BOM" onClose={vi.fn()} onContinue={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByTestId('open'));
    await waitFor(() => expect(getBom).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(screen.getByTestId('picker-item-count')).toHaveTextContent('2'));
  });
});

describe('ConvertSourceModal — MATERIAL_LIST', () => {
  it('renders the picker in convert mode with material-list texts', async () => {
    render(<ConvertSourceModal kind="MATERIAL_LIST" onClose={vi.fn()} onContinue={vi.fn()} />, {
      wrapper: wrapper(),
    });
    expect(screen.getByTestId('picker-convert')).toHaveTextContent('true');
    expect(screen.getByTestId('picker-title')).toHaveTextContent(
      'create.picker.convertMaterialListTitle',
    );
    expect(screen.getByTestId('picker-subtitle')).toHaveTextContent(
      'create.picker.convertMaterialListSubtitle',
    );
    await waitFor(() => expect(getMaterialLists).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('picker-entity-count')).toHaveTextContent('1'));
  });

  it('resolves selected entities into a MATERIAL_LIST seed and calls onContinue', async () => {
    const onContinue = vi.fn();
    render(<ConvertSourceModal kind="MATERIAL_LIST" onClose={vi.fn()} onContinue={onContinue} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByTestId('commit'));
    await waitFor(() => expect(onContinue).toHaveBeenCalled());
    expect(getMaterialList).toHaveBeenCalledWith('b1');
    const seed = onContinue.mock.calls[0][0];
    expect(seed.source).toBe('MATERIAL_LIST');
    // projectIds is undefined for the material-list flow.
    expect(seed.projectIds).toBeUndefined();
    // Picked item (i1) + the list detail item (li1) merged.
    expect(seed.items).toHaveLength(2);
    expect(seed.items[1]).toMatchObject({
      source: 'MATERIAL_LIST',
      materialId: 'm2',
      materialName: 'Mat2',
      quantity: 2,
      uom: 'unit',
    });
  });

  it('drills into a material list entity and maps its items', async () => {
    // Detail id must match the opened entity id ('b1') for items to map.
    getMaterialList.mockResolvedValue({ ...MATERIAL_LIST_DETAIL, id: 'b1' });
    render(<ConvertSourceModal kind="MATERIAL_LIST" onClose={vi.fn()} onContinue={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByTestId('open'));
    await waitFor(() => expect(getMaterialList).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(screen.getByTestId('picker-item-count')).toHaveTextContent('1'));
  });

  it('toggles commitBusy off after the async resolve completes', async () => {
    const onContinue = vi.fn();
    render(<ConvertSourceModal kind="MATERIAL_LIST" onClose={vi.fn()} onContinue={onContinue} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByTestId('commit'));
    await waitFor(() => expect(onContinue).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId('picker-commit-busy')).toHaveTextContent('false'),
    );
  });
});
