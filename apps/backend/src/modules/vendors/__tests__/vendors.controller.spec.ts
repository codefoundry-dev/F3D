import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { VendorInviteService } from '../vendor-invite.service';
import { VendorUserInviteService } from '../vendor-user-invite.service';
import { VendorsController } from '../vendors.controller';
import { VendorsService } from '../vendors.service';

const mockVendorsService = {
  listVendors: jest.fn(),
  getVendorProfile: jest.fn(),
  updateVendorProfile: jest.fn(),
  addWarehouse: jest.fn(),
  updateWarehouse: jest.fn(),
  deleteWarehouse: jest.fn(),
  getRepresentatives: jest.fn(),
};
const mockInviteService = { inviteVendor: jest.fn() };
const mockUserInviteService = {
  inviteVendorUser: jest.fn(),
  resendInvitation: jest.fn(),
  cancelInvitation: jest.fn(),
};

const mockUser = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};

const mockVendorUser = {
  id: 'vu-1',
  email: 'vendor@test.com',
  role: UserRole.VENDOR,
  companyId: 'vendor-comp-1',
};

describe('VendorsController', () => {
  let controller: VendorsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorsController],
      providers: [
        { provide: VendorsService, useValue: mockVendorsService },
        { provide: VendorInviteService, useValue: mockInviteService },
        { provide: VendorUserInviteService, useValue: mockUserInviteService },
      ],
    }).compile();
    controller = module.get<VendorsController>(VendorsController);
  });

  it('listVendors delegates to VendorsService', async () => {
    const expected = { items: [], meta: { page: 1, limit: 25, total: 0, totalPages: 0 } };
    mockVendorsService.listVendors.mockResolvedValue(expected);
    const result = await controller.listVendors({} as never, mockUser as never);
    expect(mockVendorsService.listVendors).toHaveBeenCalledWith({}, mockUser);
    expect(result).toEqual(expected);
  });

  it('inviteVendor delegates to VendorInviteService', async () => {
    const expected = { message: 'ok', vendorCompanyId: 'v-1', alreadyExisted: false };
    mockInviteService.inviteVendor.mockResolvedValue(expected);
    const dto = { companyName: 'V', companyEmail: 'v@v.com', userName: 'U', userEmail: 'u@v.com' };
    const result = await controller.inviteVendor(dto as never, mockUser as never);
    expect(mockInviteService.inviteVendor).toHaveBeenCalledWith(dto, mockUser);
    expect(result).toEqual(expected);
  });

  // ── Vendor Profile (US-3.07) ──────────────────────────────────────────────

  it('getVendorProfile delegates to VendorsService', async () => {
    const expected = { id: 'v-1', legalName: 'VendorCo' };
    mockVendorsService.getVendorProfile.mockResolvedValue(expected);
    const result = await controller.getVendorProfile('v-1', mockUser as never);
    expect(mockVendorsService.getVendorProfile).toHaveBeenCalledWith('v-1', mockUser);
    expect(result).toEqual(expected);
  });

  it('updateVendorProfile delegates to VendorsService', async () => {
    const expected = { id: 'v-1', legalName: 'Updated' };
    mockVendorsService.updateVendorProfile.mockResolvedValue(expected);
    const dto = { legalName: 'Updated' };
    const result = await controller.updateVendorProfile('v-1', dto as never, mockUser as never);
    expect(mockVendorsService.updateVendorProfile).toHaveBeenCalledWith('v-1', dto, mockUser);
    expect(result).toEqual(expected);
  });

  // ── Warehouses (US-3.07) ──────────────────────────────────────────────────

  it('addWarehouse delegates to VendorsService', async () => {
    const expected = { id: 'wh-1', name: 'Warehouse 1' };
    mockVendorsService.addWarehouse.mockResolvedValue(expected);
    const dto = { name: 'Warehouse 1', city: 'Sydney', postcode: '2000', address: '123 Main St' };
    const result = await controller.addWarehouse('v-1', dto as never, mockUser as never);
    expect(mockVendorsService.addWarehouse).toHaveBeenCalledWith('v-1', dto, mockUser);
    expect(result).toEqual(expected);
  });

  it('updateWarehouse delegates to VendorsService', async () => {
    const expected = { id: 'wh-1', name: 'Updated' };
    mockVendorsService.updateWarehouse.mockResolvedValue(expected);
    const dto = { name: 'Updated', city: 'Melbourne', postcode: '3000', address: '456 Other St' };
    const result = await controller.updateWarehouse('v-1', 'wh-1', dto as never, mockUser as never);
    expect(mockVendorsService.updateWarehouse).toHaveBeenCalledWith('v-1', 'wh-1', dto, mockUser);
    expect(result).toEqual(expected);
  });

  it('deleteWarehouse delegates to VendorsService', async () => {
    const expected = { success: true };
    mockVendorsService.deleteWarehouse.mockResolvedValue(expected);
    const result = await controller.deleteWarehouse('v-1', 'wh-1', mockUser as never);
    expect(mockVendorsService.deleteWarehouse).toHaveBeenCalledWith('v-1', 'wh-1', mockUser);
    expect(result).toEqual(expected);
  });

  // ── Vendor User Invitation (US-3.10) ──────────────────────────────────────

  it('inviteVendorUser delegates to VendorUserInviteService', async () => {
    const expected = { id: 'u-new', name: 'New User', status: 'INVITED' };
    mockUserInviteService.inviteVendorUser.mockResolvedValue(expected);
    const dto = { name: 'New User', email: 'new@vendor.com', position: 'Manager' };
    const result = await controller.inviteVendorUser(
      'vendor-comp-1',
      dto as never,
      mockVendorUser as never,
    );
    expect(mockUserInviteService.inviteVendorUser).toHaveBeenCalledWith(
      'vendor-comp-1',
      dto,
      mockVendorUser,
    );
    expect(result).toEqual(expected);
  });

  it('resendInvitation delegates to VendorUserInviteService', async () => {
    const expected = { message: 'Invitation resent successfully' };
    mockUserInviteService.resendInvitation.mockResolvedValue(expected);
    const result = await controller.resendInvitation(
      'vendor-comp-1',
      'u-1',
      mockVendorUser as never,
    );
    expect(mockUserInviteService.resendInvitation).toHaveBeenCalledWith(
      'vendor-comp-1',
      'u-1',
      mockVendorUser,
    );
    expect(result).toEqual(expected);
  });

  it('cancelInvitation delegates to VendorUserInviteService', async () => {
    const expected = { message: 'Invitation cancelled successfully' };
    mockUserInviteService.cancelInvitation.mockResolvedValue(expected);
    const result = await controller.cancelInvitation(
      'vendor-comp-1',
      'u-1',
      mockVendorUser as never,
    );
    expect(mockUserInviteService.cancelInvitation).toHaveBeenCalledWith(
      'vendor-comp-1',
      'u-1',
      mockVendorUser,
    );
    expect(result).toEqual(expected);
  });

  // ── Representatives (US-3.12) ─────────────────────────────────────────────

  it('getRepresentatives delegates to VendorsService', async () => {
    const expected = [{ id: 'u-1', name: 'Rep', email: 'rep@vendor.com' }];
    mockVendorsService.getRepresentatives.mockResolvedValue(expected);
    const result = await controller.getRepresentatives('v-1', mockUser as never);
    expect(mockVendorsService.getRepresentatives).toHaveBeenCalledWith('v-1', mockUser);
    expect(result).toEqual(expected);
  });
});
