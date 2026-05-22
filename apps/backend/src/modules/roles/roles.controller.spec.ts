import { Request } from 'express';

import { RolesController } from './roles.controller';

const mockService = {
  listCatalog: jest.fn(),
  listRoles: jest.fn(),
  getRoleDetail: jest.fn(),
  updateRolePermissions: jest.fn(),
};

const authUser = { id: 'actor-1', role: 'COMPANY_ADMIN', companyId: 'co-1' };

describe('RolesController', () => {
  let controller: RolesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new RolesController(mockService as never);
  });

  it('listCatalog wraps the service result in { items }', () => {
    mockService.listCatalog.mockReturnValue([{ key: 'rfq.read', description: 'Read an RFQ' }]);
    expect(controller.listCatalog()).toEqual({
      items: [{ key: 'rfq.read', description: 'Read an RFQ' }],
    });
  });

  it('listRoles wraps the resolved service value in { items }', async () => {
    mockService.listRoles.mockResolvedValue([{ role: 'VENDOR', permissionCount: 30 }]);
    await expect(controller.listRoles()).resolves.toEqual({
      items: [{ role: 'VENDOR', permissionCount: 30 }],
    });
  });

  it('getRole delegates the path param to the service', async () => {
    mockService.getRoleDetail.mockResolvedValue({ role: 'VENDOR', permissionKeys: [] });
    await expect(controller.getRole('VENDOR')).resolves.toEqual({
      role: 'VENDOR',
      permissionKeys: [],
    });
    expect(mockService.getRoleDetail).toHaveBeenCalledWith('VENDOR');
  });

  it('updatePermissions forwards the actor id and IP to the service', async () => {
    mockService.updateRolePermissions.mockResolvedValue({
      role: 'VENDOR',
      permissionKeys: ['rfq.read'],
    });
    const req = { ip: '10.0.0.5', socket: { remoteAddress: '10.0.0.5' } } as unknown as Request;

    const result = await controller.updatePermissions(
      'VENDOR',
      { permissionKeys: ['rfq.read'] },
      authUser,
      req,
    );

    expect(mockService.updateRolePermissions).toHaveBeenCalledWith(
      'VENDOR',
      ['rfq.read'],
      'actor-1',
      '10.0.0.5',
      undefined,
    );
    expect(result).toEqual({ role: 'VENDOR', permissionKeys: ['rfq.read'] });
  });
});
