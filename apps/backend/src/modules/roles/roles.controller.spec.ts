import { Request } from 'express';

import { RolesController } from './roles.controller';

const mockService = {
  listCatalog: jest.fn(),
  listRoles: jest.fn(),
  getRoleDetail: jest.fn(),
  updateRolePermissions: jest.fn(),
  listCustomRoles: jest.fn(),
  createCustomRole: jest.fn(),
  getCustomRoleDetail: jest.fn(),
  updateCustomRole: jest.fn(),
  deleteCustomRole: jest.fn(),
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

  it('listCustomRoles scopes to the caller company and wraps in { items }', async () => {
    mockService.listCustomRoles.mockResolvedValue([{ id: 'cr-1', name: 'Junior Buyer' }]);

    await expect(controller.listCustomRoles(authUser)).resolves.toEqual({
      items: [{ id: 'cr-1', name: 'Junior Buyer' }],
    });
    expect(mockService.listCustomRoles).toHaveBeenCalledWith('co-1');
  });

  it('createCustomRole forwards the caller company, actor id and IP', async () => {
    mockService.createCustomRole.mockResolvedValue({ id: 'cr-1', name: 'Junior Buyer' });
    const req = { ip: '10.0.0.5', socket: { remoteAddress: '10.0.0.5' } } as unknown as Request;

    const result = await controller.createCustomRole({ name: 'Junior Buyer' }, authUser, req);

    expect(mockService.createCustomRole).toHaveBeenCalledWith(
      'co-1',
      { name: 'Junior Buyer' },
      'actor-1',
      '10.0.0.5',
    );
    expect(result).toEqual({ id: 'cr-1', name: 'Junior Buyer' });
  });

  it('getCustomRole delegates the id and caller company to the service', async () => {
    mockService.getCustomRoleDetail.mockResolvedValue({ id: 'cr-1', permissionKeys: [] });

    await expect(controller.getCustomRole('cr-1', authUser)).resolves.toEqual({
      id: 'cr-1',
      permissionKeys: [],
    });
    expect(mockService.getCustomRoleDetail).toHaveBeenCalledWith('cr-1', 'co-1');
  });

  it('updateCustomRole forwards the dto, actor id and IP', async () => {
    mockService.updateCustomRole.mockResolvedValue({ id: 'cr-1', name: 'Site Buyer' });
    const req = { ip: '10.0.0.6', socket: { remoteAddress: '10.0.0.6' } } as unknown as Request;

    await controller.updateCustomRole('cr-1', { name: 'Site Buyer' }, authUser, req);

    expect(mockService.updateCustomRole).toHaveBeenCalledWith(
      'cr-1',
      'co-1',
      { name: 'Site Buyer' },
      'actor-1',
      '10.0.0.6',
    );
  });

  it('deleteCustomRole forwards the id, caller company, actor id and IP', async () => {
    mockService.deleteCustomRole.mockResolvedValue({ message: 'Custom role deleted' });
    const req = { ip: '10.0.0.7', socket: { remoteAddress: '10.0.0.7' } } as unknown as Request;

    await expect(controller.deleteCustomRole('cr-1', authUser, req)).resolves.toEqual({
      message: 'Custom role deleted',
    });
    expect(mockService.deleteCustomRole).toHaveBeenCalledWith(
      'cr-1',
      'co-1',
      'actor-1',
      '10.0.0.7',
    );
  });
});
