import { Response } from 'express';

import {
  AuthController,
  LoginDto,
  VerifyOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ActivateAccountDto,
} from './auth.controller';
import { AuthService } from './auth.service';
import { RequestNewInvitationDto } from './dto/request-new-invitation.dto';
import { ValidateActivationTokenDto } from './dto/validate-activation-token.dto';

function mockResponse(): Response {
  const res = {
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function mockRequest(overrides: Record<string, unknown> = {}) {
  return { headers: {}, ...overrides } as never;
}

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(() => {
    authService = {
      login: jest.fn(),
      verifyOtp: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      validateActivationToken: jest.fn(),
      requestNewInvitation: jest.fn(),
      activateAccount: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    controller = new AuthController(authService);
  });

  describe('login', () => {
    it('should call authService.login and return userId + otpExpiresAt', async () => {
      const dto: LoginDto = { email: 'test@example.com', password: 'password123' };
      const expiresAt = new Date('2026-03-05T12:00:00Z');
      authService.login.mockResolvedValue({ userId: 'user-1', otpExpiresAt: expiresAt });

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(result).toEqual({ userId: 'user-1', otpExpiresAt: expiresAt });
    });

    it('should propagate errors from authService.login', async () => {
      const dto: LoginDto = { email: 'test@example.com', password: 'wrong' };
      authService.login.mockRejectedValue(new Error('Invalid email or password'));

      await expect(controller.login(dto)).rejects.toThrow('Invalid email or password');
    });
  });

  describe('verifyOtp', () => {
    it('should call authService.verifyOtp, set cookies and return success', async () => {
      const dto: VerifyOtpDto = { userId: 'user-1', otp: '123456' };
      const tokens = { accessToken: 'access-tok', refreshToken: 'refresh-tok' };
      authService.verifyOtp.mockResolvedValue(tokens);
      const res = mockResponse();

      const result = await controller.verifyOtp(dto, mockRequest(), res);

      expect(authService.verifyOtp).toHaveBeenCalledWith('user-1', '123456');
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it('should propagate errors from authService.verifyOtp', async () => {
      const dto: VerifyOtpDto = { userId: 'user-1', otp: '000000' };
      authService.verifyOtp.mockRejectedValue(new Error('Invalid OTP code'));
      const res = mockResponse();

      await expect(controller.verifyOtp(dto, mockRequest(), res)).rejects.toThrow(
        'Invalid OTP code',
      );
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh, set cookies and return success', async () => {
      const req = { user: { id: 'user-1' }, headers: {} };
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-tok',
        refreshToken: 'new-refresh-tok',
      });
      const res = mockResponse();

      const result = await controller.refresh(req, res);

      expect(authService.refresh).toHaveBeenCalledWith('user-1');
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });
  });

  describe('logout', () => {
    it('should call authService.logout, clear cookies', async () => {
      const user = { id: 'user-1' };
      authService.logout.mockResolvedValue(undefined);
      const res = mockResponse();

      await controller.logout(user, mockRequest(), res);

      expect(authService.logout).toHaveBeenCalledWith('user-1');
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword and return generic message', async () => {
      const dto: ForgotPasswordDto = { email: 'test@example.com' };
      authService.forgotPassword.mockResolvedValue(undefined);

      const result = await controller.forgotPassword(dto);

      expect(authService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(result).toEqual({
        message: 'If an account exists with that email, a reset link has been sent.',
      });
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword and return success message', async () => {
      const dto: ResetPasswordDto = { token: 'reset-tok', newPassword: 'newpass123' };
      authService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword(dto);

      expect(authService.resetPassword).toHaveBeenCalledWith('reset-tok', 'newpass123');
      expect(result).toEqual({ message: 'Password has been reset successfully.' });
    });

    it('should propagate errors from authService.resetPassword', async () => {
      const dto: ResetPasswordDto = { token: 'bad-tok', newPassword: 'newpass123' };
      authService.resetPassword.mockRejectedValue(new Error('Invalid or expired reset token'));

      await expect(controller.resetPassword(dto)).rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('validateActivationToken', () => {
    it('should call authService.validateActivationToken and return result', async () => {
      const dto: ValidateActivationTokenDto = { token: 'invite-tok' };
      authService.validateActivationToken.mockResolvedValue({
        valid: true,
        email: 'test@example.com',
      });

      const result = await controller.validateActivationToken(dto);

      expect(authService.validateActivationToken).toHaveBeenCalledWith('invite-tok');
      expect(result).toEqual({ valid: true, email: 'test@example.com' });
    });

    it('should propagate errors for invalid tokens', async () => {
      const dto: ValidateActivationTokenDto = { token: 'bad-tok' };
      authService.validateActivationToken.mockRejectedValue(new Error('Invalid invitation token'));

      await expect(controller.validateActivationToken(dto)).rejects.toThrow(
        'Invalid invitation token',
      );
    });
  });

  describe('requestNewInvitation', () => {
    it('should call authService.requestNewInvitation and return generic message', async () => {
      const dto: RequestNewInvitationDto = { email: 'invited@example.com' };
      authService.requestNewInvitation.mockResolvedValue(undefined);

      const result = await controller.requestNewInvitation(dto);

      expect(authService.requestNewInvitation).toHaveBeenCalledWith('invited@example.com');
      expect(result).toEqual({
        message:
          'If an account with this email exists and is pending activation, a new invitation has been sent.',
      });
    });
  });

  describe('activateAccount', () => {
    it('should call authService.activateAccount and return success message', async () => {
      const dto: ActivateAccountDto = { token: 'invite-tok', password: 'mypassword' };
      authService.activateAccount.mockResolvedValue(undefined);

      const result = await controller.activateAccount(dto);

      expect(authService.activateAccount).toHaveBeenCalledWith('invite-tok', 'mypassword');
      expect(result).toEqual({ message: 'Account activated successfully. You can now log in.' });
    });

    it('should propagate errors from authService.activateAccount', async () => {
      const dto: ActivateAccountDto = { token: 'bad-tok', password: 'mypassword' };
      authService.activateAccount.mockRejectedValue(
        new Error('Invalid or expired invitation token'),
      );

      await expect(controller.activateAccount(dto)).rejects.toThrow(
        'Invalid or expired invitation token',
      );
    });
  });
});
