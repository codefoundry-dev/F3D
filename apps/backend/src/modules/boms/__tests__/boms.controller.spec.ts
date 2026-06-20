import { BomsController } from '../boms.controller';

const user = {
  id: 'user-1',
  email: 'po@example.com',
  role: 'PROCUREMENT_OFFICER',
  companyId: 'company-1',
};

/**
 * Minimal BOM shaped enough for `toBomDetailResponse` (the controller maps the
 * service result before returning). Mirrors the `bomDetailInclude` payload.
 */
function makeBom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bom-1',
    bomNumber: 'BOM-00001',
    projectId: 'project-1',
    status: 'ACTIVE',
    extractionId: null,
    createdBy: { id: 'user-1', name: 'Pat Officer' },
    createdAt: new Date('2026-06-19T00:00:00.000Z'),
    updatedAt: new Date('2026-06-19T01:00:00.000Z'),
    _count: { items: 1 },
    items: [
      {
        id: 'item-1',
        materialName: 'Portland Cement Type I',
        matchedMaterialId: 'mat-1',
        matchedMaterial: { id: 'mat-1', name: 'Cement 25kg' },
        description: null,
        uom: 'bag',
        quantity: 50,
        category: null,
        materialType: null,
        matchConfidence: 0.9,
        sortOrder: 0,
      },
    ],
    ...overrides,
  };
}

const mockService = {
  createBom: jest.fn(),
  listBoms: jest.fn(),
  getBom: jest.fn(),
  updateBom: jest.fn(),
};

describe('BomsController', () => {
  let controller: BomsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new BomsController(mockService as never);
  });

  it('create delegates to the service and maps the detail response', async () => {
    mockService.createBom.mockResolvedValue(makeBom());
    const dto = { projectId: 'project-1', items: [] } as never;

    const result = await controller.create(dto, user as never);

    expect(mockService.createBom).toHaveBeenCalledWith(dto, user);
    expect(result).toMatchObject({ id: 'bom-1', bomNumber: 'BOM-00001', itemCount: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].matchedMaterialName).toBe('Cement 25kg');
  });

  it('list delegates to the service with the project filter and maps list items', async () => {
    mockService.listBoms.mockResolvedValue([makeBom()]);

    const result = await controller.list({ projectId: 'project-9' } as never, user as never);

    expect(mockService.listBoms).toHaveBeenCalledWith('project-9', user);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'bom-1', itemCount: 1, matchedCount: 1 });
  });

  it('get delegates to the service and maps the detail response', async () => {
    mockService.getBom.mockResolvedValue(makeBom());

    const result = await controller.get('bom-1', user as never);

    expect(mockService.getBom).toHaveBeenCalledWith('bom-1', user);
    expect(result.id).toBe('bom-1');
    expect(result.items).toHaveLength(1);
  });

  it('update delegates to the service with id + dto and maps the detail response', async () => {
    const updatedBom = makeBom({
      _count: { items: 2 },
      items: [
        {
          id: 'item-9',
          materialName: 'Reinforcing Bar 12mm',
          matchedMaterialId: 'mat-3',
          matchedMaterial: { id: 'mat-3', name: 'Rebar 12mm' },
          description: null,
          uom: 'm',
          quantity: 200,
          category: null,
          materialType: null,
          matchConfidence: null,
          sortOrder: 0,
        },
        {
          id: 'item-10',
          materialName: 'Cement',
          matchedMaterialId: 'mat-1',
          matchedMaterial: { id: 'mat-1', name: 'Cement 25kg' },
          description: null,
          uom: 'bag',
          quantity: 75,
          category: null,
          materialType: null,
          matchConfidence: null,
          sortOrder: 1,
        },
      ],
    });
    mockService.updateBom.mockResolvedValue(updatedBom);
    const dto = { items: [{ materialName: 'Cement', matchedMaterialId: 'mat-1' }] } as never;

    const result = await controller.update('bom-1', dto, user as never);

    expect(mockService.updateBom).toHaveBeenCalledWith('bom-1', dto, user);
    expect(result).toMatchObject({ id: 'bom-1', itemCount: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].matchedMaterialName).toBe('Rebar 12mm');
  });
});
