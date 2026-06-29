import { BadRequestException } from '@nestjs/common';

import { UsersController } from './users.controller';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUsersService = {
  getMe: jest.fn(),
  updateMe: jest.fn(),
  changePassword: jest.fn(),
  listUsers: jest.fn(),
  createUser: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn(),
  deactivateUser: jest.fn(),
  reactivateUser: jest.fn(),
  initiateResetPassword: jest.fn(),
  resendInvitation: jest.fn(),
  cancelInvitation: jest.fn(),
};

const mockStorageService = {
  upload: jest.fn(),
  getSignedUrl: jest.fn((key: string) => Promise.resolve(`https://signed.test/${key}?sig=abc`)),
  getPublicUrl: jest.fn((key: string) => `http://localhost:9000/forethread-dev/${key}`),
};

const mockPrisma = {
  file: { create: jest.fn() },
  user: { update: jest.fn(), findUnique: jest.fn() },
};

const authUser = { id: 'user-1', role: 'COMPANY_ADMIN', companyId: 'comp-1' };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new UsersController(
      mockUsersService as never,
      mockStorageService as never,
      mockPrisma as never,
    );
  });

  // ── getMe ────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('delegates to usersService.getMe with the user id', async () => {
      mockUsersService.getMe.mockResolvedValue({ id: 'user-1' });
      const result = controller.getMe(authUser);
      expect(mockUsersService.getMe).toHaveBeenCalledWith('user-1');
      await expect(result).resolves.toEqual({ id: 'user-1' });
    });
  });

  // ── updateMe ─────────────────────────────────────────────────────────────

  describe('updateMe', () => {
    it('delegates to usersService.updateMe', async () => {
      const dto = { name: 'New Name' };
      mockUsersService.updateMe.mockResolvedValue({ id: 'user-1', name: 'New Name' });
      const result = controller.updateMe(authUser, dto);
      expect(mockUsersService.updateMe).toHaveBeenCalledWith('user-1', dto);
      await expect(result).resolves.toEqual({ id: 'user-1', name: 'New Name' });
    });
  });

  // ── changePassword ───────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('delegates to usersService.changePassword', async () => {
      const dto = { currentPassword: 'old', newPassword: 'newpass12' };
      mockUsersService.changePassword.mockResolvedValue({
        message: 'Password changed successfully. Please log in again.',
      });
      const result = controller.changePassword(authUser, dto);
      expect(mockUsersService.changePassword).toHaveBeenCalledWith('user-1', dto);
      await expect(result).resolves.toEqual({
        message: 'Password changed successfully. Please log in again.',
      });
    });
  });

  // ── uploadAvatar ─────────────────────────────────────────────────────────

  describe('uploadAvatar', () => {
    const validFile = {
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('img'),
    } as Express.Multer.File;

    it('uploads a valid image and returns updated user', async () => {
      mockStorageService.upload.mockResolvedValue({ bucket: 'b', key: 'avatars/user-1/uuid.png' });
      mockPrisma.file.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        avatarUrl: 'avatars/user-1/uuid.png',
      });

      const result = await controller.uploadAvatar(validFile, authUser);

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        expect.stringContaining('avatars/user-1/'),
        validFile.buffer,
        'image/png',
      );
      expect(mockPrisma.file.create).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'user-1',
        avatarUrl: 'https://signed.test/avatars/user-1/uuid.png?sig=abc',
      });
    });

    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        controller.uploadAvatar(undefined as unknown as Express.Multer.File, authUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid mime type', async () => {
      const badFile = { ...validFile, mimetype: 'application/pdf' } as Express.Multer.File;
      await expect(controller.uploadAvatar(badFile, authUser)).rejects.toThrow(
        'Only image files are allowed',
      );
    });

    it('throws BadRequestException when file exceeds 5MB', async () => {
      const bigFile = { ...validFile, size: 6 * 1024 * 1024 } as Express.Multer.File;
      await expect(controller.uploadAvatar(bigFile, authUser)).rejects.toThrow('File too large');
    });
  });

  // ── getAvatarUrl ─────────────────────────────────────────────────────────

  describe('getAvatarUrl', () => {
    it('returns a presigned URL when avatar exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ avatarUrl: 'avatars/user-1/photo.jpg' });

      const result = await controller.getAvatarUrl(authUser);
      expect(result).toEqual({
        url: 'https://signed.test/avatars/user-1/photo.jpg?sig=abc',
      });
    });

    it('returns null url when user has no avatar', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ avatarUrl: null });

      const result = await controller.getAvatarUrl(authUser);
      expect(result).toEqual({ url: null });
    });

    it('returns null url when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await controller.getAvatarUrl(authUser);
      expect(result).toEqual({ url: null });
    });
  });

  // ── listUsers ────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('delegates to usersService.listUsers with query and user', async () => {
      const query = { page: 1, limit: 25 };
      mockUsersService.listUsers.mockResolvedValue({ items: [], meta: {} });
      await controller.listUsers(query as never, authUser);
      expect(mockUsersService.listUsers).toHaveBeenCalledWith(query, authUser);
    });
  });

  // ── createUser ───────────────────────────────────────────────────────────

  describe('createUser', () => {
    it('delegates to usersService.createUser', async () => {
      const dto = { name: 'John', email: 'j@x.com', role: 'COMPANY_ADMIN', companyId: 'comp-1' };
      mockUsersService.createUser.mockResolvedValue({ id: 'new-1' });
      await controller.createUser(dto as never, authUser);
      expect(mockUsersService.createUser).toHaveBeenCalledWith(dto, authUser);
    });
  });

  // ── getUser ──────────────────────────────────────────────────────────────

  describe('getUser', () => {
    it('delegates to usersService.getUser', async () => {
      mockUsersService.getUser.mockResolvedValue({ id: 'user-2', avatarUrl: null });
      const result = await controller.getUser('user-2', authUser);
      expect(mockUsersService.getUser).toHaveBeenCalledWith('user-2', authUser);
      expect(result.avatarUrl).toBeNull();
    });

    it('resolves avatarUrl to a presigned URL when present', async () => {
      mockUsersService.getUser.mockResolvedValue({
        id: 'user-2',
        avatarUrl: 'avatars/user-2/photo.png',
      });
      const result = await controller.getUser('user-2', authUser);
      expect(result.avatarUrl).toBe('https://signed.test/avatars/user-2/photo.png?sig=abc');
    });
  });

  // ── updateUser ───────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('delegates to usersService.updateUser', async () => {
      const dto = { name: 'Updated' };
      mockUsersService.updateUser.mockResolvedValue({ id: 'user-2', name: 'Updated' });
      await controller.updateUser('user-2', dto as never, authUser);
      expect(mockUsersService.updateUser).toHaveBeenCalledWith('user-2', dto, authUser);
    });
  });

  // ── deactivateUser ───────────────────────────────────────────────────────

  describe('deactivateUser', () => {
    it('delegates to usersService.deactivateUser', async () => {
      mockUsersService.deactivateUser.mockResolvedValue({ id: 'user-2', status: 'INACTIVE' });
      await controller.deactivateUser('user-2', authUser);
      expect(mockUsersService.deactivateUser).toHaveBeenCalledWith('user-2', authUser);
    });
  });

  // ── reactivateUser ───────────────────────────────────────────────────────

  describe('reactivateUser', () => {
    it('delegates to usersService.reactivateUser', async () => {
      mockUsersService.reactivateUser.mockResolvedValue({ id: 'user-2', status: 'ACTIVE' });
      await controller.reactivateUser('user-2');
      expect(mockUsersService.reactivateUser).toHaveBeenCalledWith('user-2');
    });
  });

  // ── initiateResetPassword ────────────────────────────────────────────────

  describe('initiateResetPassword', () => {
    it('delegates to usersService.initiateResetPassword', async () => {
      mockUsersService.initiateResetPassword.mockResolvedValue({ message: 'ok' });
      await controller.initiateResetPassword('user-2');
      expect(mockUsersService.initiateResetPassword).toHaveBeenCalledWith('user-2');
    });
  });

  // ── resendInvitation ─────────────────────────────────────────────────────

  describe('resendInvitation', () => {
    it('delegates to usersService.resendInvitation', async () => {
      mockUsersService.resendInvitation.mockResolvedValue({ message: 'ok' });
      await controller.resendInvitation('user-2');
      expect(mockUsersService.resendInvitation).toHaveBeenCalledWith('user-2');
    });
  });

  // ── cancelInvitation ─────────────────────────────────────────────────────

  describe('cancelInvitation', () => {
    it('delegates to usersService.cancelInvitation', async () => {
      mockUsersService.cancelInvitation.mockResolvedValue({ message: 'ok' });
      await controller.cancelInvitation('user-2');
      expect(mockUsersService.cancelInvitation).toHaveBeenCalledWith('user-2');
    });
  });
});
