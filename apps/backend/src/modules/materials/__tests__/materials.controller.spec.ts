import { MaterialsController } from '../materials.controller';

const mockService = {
  listMaterials: jest.fn(),
  listCategories: jest.fn(),
  getFacets: jest.fn(),
  suggestions: jest.fn(),
  createMaterial: jest.fn(),
  getMaterialById: jest.fn(),
  updateMaterial: jest.fn(),
  deleteMaterial: jest.fn(),
  detectDuplicates: jest.fn(),
  listChangeRequests: jest.fn(),
  approveChangeRequest: jest.fn(),
  rejectChangeRequest: jest.fn(),
  addFavourite: jest.fn(),
  removeFavourite: jest.fn(),
};

const mockStatusService = {
  approve: jest.fn(),
  reject: jest.fn(),
  archive: jest.fn(),
  restore: jest.fn(),
};

const user = { id: 'u-1', email: 'u@test.com', role: 'COMPANY_ADMIN', companyId: 'c-1' };

describe('MaterialsController', () => {
  let controller: MaterialsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MaterialsController(mockService as never, mockStatusService as never);
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

  it('facets delegates to service with the current user', async () => {
    const expected = {
      manufacturers: ['Nucor Steel'],
      uoms: ['bag'],
      materialTypes: [],
      countriesOfOrigin: [],
    };
    mockService.getFacets.mockResolvedValue(expected);

    const result = await controller.facets(user as never);
    expect(result).toBe(expected);
    expect(mockService.getFacets).toHaveBeenCalledWith(user);
  });

  it('suggestions delegates to service with the q term, limit, and the current user', async () => {
    const expected = {
      results: [{ id: 'm-1', name: 'Bolt' }],
      recentlyUsed: [],
      frequentlyUsed: [],
    };
    mockService.suggestions.mockResolvedValue(expected);

    const result = await controller.suggestions({ q: 'bolt', limit: 5 } as never, user as never);
    expect(result).toBe(expected);
    expect(mockService.suggestions).toHaveBeenCalledWith('bolt', user, 5);
  });

  it('suggestions accepts `search` as a legacy alias for `q`', async () => {
    mockService.suggestions.mockResolvedValue({
      results: [],
      recentlyUsed: [],
      frequentlyUsed: [],
    });

    await controller.suggestions({ search: 'cable' } as never, user as never);
    expect(mockService.suggestions).toHaveBeenCalledWith('cable', user, undefined);
  });

  it('suggestions passes empty string when neither q nor search is provided', async () => {
    mockService.suggestions.mockResolvedValue({
      results: [],
      recentlyUsed: [],
      frequentlyUsed: [],
    });

    await controller.suggestions({} as never, user as never);
    expect(mockService.suggestions).toHaveBeenCalledWith('', user, undefined);
  });

  it('createMaterial delegates to service', async () => {
    const dto = { name: 'Mat', categoryId: 'c-1', uom: 'kg' };
    const expected = { id: 'm-1', name: 'Mat' };
    mockService.createMaterial.mockResolvedValue(expected);

    const result = await controller.createMaterial(dto as never, user as never);
    expect(result).toBe(expected);
    expect(mockService.createMaterial).toHaveBeenCalledWith(dto, user);
  });

  it('getMaterial delegates to service', async () => {
    const expected = { id: 'm-1' };
    mockService.getMaterialById.mockResolvedValue(expected);

    const result = await controller.getMaterial('m-1', user as never);
    expect(result).toBe(expected);
    expect(mockService.getMaterialById).toHaveBeenCalledWith('m-1', user);
  });

  it('updateMaterial delegates to service', async () => {
    const dto = { description: 'Updated' };
    const expected = { id: 'm-1', description: 'Updated' };
    mockService.updateMaterial.mockResolvedValue(expected);

    const result = await controller.updateMaterial('m-1', dto as never, user as never);
    expect(result).toBe(expected);
    expect(mockService.updateMaterial).toHaveBeenCalledWith('m-1', dto, user);
  });

  it('deleteMaterial delegates to service', async () => {
    const expected = { success: true };
    mockService.deleteMaterial.mockResolvedValue(expected);

    const result = await controller.deleteMaterial('m-1', user as never);
    expect(result).toBe(expected);
    expect(mockService.deleteMaterial).toHaveBeenCalledWith('m-1', user);
  });

  it('approveMaterial delegates to status service', async () => {
    const expected = { id: 'm-1', status: 'PUBLIC' };
    mockStatusService.approve.mockResolvedValue(expected);

    const result = await controller.approveMaterial('m-1', user as never);
    expect(result).toBe(expected);
    expect(mockStatusService.approve).toHaveBeenCalledWith('m-1', user);
  });

  it('rejectMaterial delegates to status service with body', async () => {
    const dto = { reason: 'Bad data' };
    const expected = { id: 'm-1', status: 'ARCHIVED' };
    mockStatusService.reject.mockResolvedValue(expected);

    const result = await controller.rejectMaterial('m-1', dto as never, user as never);
    expect(result).toBe(expected);
    expect(mockStatusService.reject).toHaveBeenCalledWith('m-1', dto, user);
  });

  it('archiveMaterial delegates to status service', async () => {
    const expected = { id: 'm-1', status: 'ARCHIVED' };
    mockStatusService.archive.mockResolvedValue(expected);

    const result = await controller.archiveMaterial('m-1', user as never);
    expect(result).toBe(expected);
    expect(mockStatusService.archive).toHaveBeenCalledWith('m-1', user);
  });

  it('restoreMaterial delegates to status service', async () => {
    const expected = { id: 'm-1', status: 'PUBLIC' };
    mockStatusService.restore.mockResolvedValue(expected);

    const result = await controller.restoreMaterial('m-1', user as never);
    expect(result).toBe(expected);
    expect(mockStatusService.restore).toHaveBeenCalledWith('m-1', user);
  });

  // ── Phase 3 endpoints ───────────────────────────────────────────────────

  it('detectDuplicates delegates to service with the current user', async () => {
    const dto = { candidates: [{ name: 'Cement' }] };
    const expected = { results: [] };
    mockService.detectDuplicates.mockResolvedValue(expected);

    const result = await controller.detectDuplicates(dto as never, user as never);
    expect(result).toBe(expected);
    expect(mockService.detectDuplicates).toHaveBeenCalledWith(dto, user);
  });

  it('addFavourite delegates to service', async () => {
    const expected = { success: true };
    mockService.addFavourite.mockResolvedValue(expected);

    const result = await controller.addFavourite('m-1', user as never);
    expect(result).toBe(expected);
    expect(mockService.addFavourite).toHaveBeenCalledWith('m-1', user);
  });

  it('removeFavourite delegates to service', async () => {
    const expected = { success: true };
    mockService.removeFavourite.mockResolvedValue(expected);

    const result = await controller.removeFavourite('m-1', user as never);
    expect(result).toBe(expected);
    expect(mockService.removeFavourite).toHaveBeenCalledWith('m-1', user);
  });

  it('listChangeRequests passes the status filter through', async () => {
    const expected = [{ id: 'cr-1' }];
    mockService.listChangeRequests.mockResolvedValue(expected);

    const result = await controller.listChangeRequests('PENDING');
    expect(result).toBe(expected);
    expect(mockService.listChangeRequests).toHaveBeenCalledWith('PENDING');
  });

  it('approveChangeRequest delegates to service', async () => {
    const expected = { id: 'cr-1', status: 'APPROVED' };
    mockService.approveChangeRequest.mockResolvedValue(expected);

    const result = await controller.approveChangeRequest('cr-1', user as never);
    expect(result).toBe(expected);
    expect(mockService.approveChangeRequest).toHaveBeenCalledWith('cr-1', user);
  });

  it('rejectChangeRequest delegates to service with body', async () => {
    const dto = { reason: 'Inaccurate' };
    const expected = { id: 'cr-1', status: 'REJECTED' };
    mockService.rejectChangeRequest.mockResolvedValue(expected);

    const result = await controller.rejectChangeRequest('cr-1', dto as never, user as never);
    expect(result).toBe(expected);
    expect(mockService.rejectChangeRequest).toHaveBeenCalledWith('cr-1', dto, user);
  });
});
