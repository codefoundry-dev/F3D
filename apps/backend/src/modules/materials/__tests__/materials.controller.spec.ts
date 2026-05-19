import { MaterialsController } from '../materials.controller';

const mockService = {
  listMaterials: jest.fn(),
  listCategories: jest.fn(),
  suggestions: jest.fn(),
  createMaterial: jest.fn(),
};

const user = { id: 'u-1', email: 'u@test.com', role: 'COMPANY_ADMIN', companyId: 'c-1' };

describe('MaterialsController', () => {
  let controller: MaterialsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MaterialsController(mockService as never);
  });

  it('listMaterials delegates to service', async () => {
    const expected = { items: [], meta: {} };
    mockService.listMaterials.mockResolvedValue(expected);
    const query = { page: 1, take: 25, skip: 0 } as never;

    const result = await controller.listMaterials(query, user as never);
    expect(result).toBe(expected);
    expect(mockService.listMaterials).toHaveBeenCalledWith(query, user);
  });

  it('listCategories delegates to service', async () => {
    const expected = [{ id: 'c-1', name: 'Steel' }];
    mockService.listCategories.mockResolvedValue(expected);

    const result = await controller.listCategories();
    expect(result).toBe(expected);
  });

  it('suggestions delegates to service with search param', async () => {
    const expected = [{ id: 'm-1', name: 'Bolt' }];
    mockService.suggestions.mockResolvedValue(expected);

    const result = await controller.suggestions('bolt');
    expect(result).toBe(expected);
    expect(mockService.suggestions).toHaveBeenCalledWith('bolt');
  });

  it('suggestions passes empty string when search is undefined', async () => {
    mockService.suggestions.mockResolvedValue([]);

    await controller.suggestions(undefined as never);
    expect(mockService.suggestions).toHaveBeenCalledWith('');
  });

  it('createMaterial delegates to service', async () => {
    const dto = { name: 'Mat', categoryId: 'c-1', uom: 'kg' };
    const expected = { id: 'm-1', name: 'Mat' };
    mockService.createMaterial.mockResolvedValue(expected);

    const result = await controller.createMaterial(dto as never, user as never);
    expect(result).toBe(expected);
    expect(mockService.createMaterial).toHaveBeenCalledWith(dto, user);
  });
});
