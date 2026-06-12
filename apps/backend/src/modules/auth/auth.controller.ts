import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength, IsNotEmpty, Length } from 'class-validator';
import { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { clearAuthCookies, setAuthCookies } from '../../common/utils/set-auth-cookies.util';

import { AuthService } from './auth.service';
import { RequestNewInvitationDto } from './dto/request-new-invitation.dto';
import { ValidateActivationTokenDto } from './dto/validate-activation-token.dto';

// DTOs (inline here; will import from @forethread/shared-types once installed)

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}

export class ResendOtpDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ActivateAccountDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Step 1 of login: validate credentials and send OTP' })
  @ApiResponse({ status: 200, description: 'OTP sent to email' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account not activated' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.email, dto.password);
    return { userId: result.userId, otpExpiresAt: result.otpExpiresAt };
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Step 2 of login: verify OTP and receive tokens' })
  @ApiResponse({ status: 200, description: 'Access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Request() req: { headers: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.verifyOtp(dto.userId, dto.otp);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, req as never);
    return { success: true };
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Re-send the login OTP for an in-progress login' })
  @ApiResponse({ status: 200, description: 'A new OTP was sent to the email' })
  @ApiResponse({ status: 401, description: 'Unknown or inactive account' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    const result = await this.authService.resendOtp(dto.userId);
    return { userId: result.userId, otpExpiresAt: result.otpExpiresAt };
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'New access token' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Request()
    req: { user: { id: string }; headers: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refresh(req.user.id);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, req as never);
    return { success: true };
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logout(
    @CurrentUser() user: { id: string },
    @Request() req: { headers: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id);
    clearAuthCookies(res, req as never);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If an account exists with that email, a reset link has been sent.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset successfully.' };
  }

  @Public()
  @Post('validate-activation-token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Validate an activation token and return email + validity' })
  @ApiResponse({ status: 200, description: 'Token validation result' })
  @ApiResponse({ status: 400, description: 'Invalid invitation token' })
  async validateActivationToken(@Body() dto: ValidateActivationTokenDto) {
    return this.authService.validateActivationToken(dto.token);
  }

  @Public()
  @Post('request-new-invitation')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiOperation({ summary: 'Request a new invitation email' })
  @ApiResponse({ status: 200, description: 'New invitation sent if account exists' })
  async requestNewInvitation(@Body() dto: RequestNewInvitationDto) {
    await this.authService.requestNewInvitation(dto.email);
    return {
      message:
        'If an account with this email exists and is pending activation, a new invitation has been sent.',
    };
  }

  @Public()
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate account using invitation token' })
  @ApiResponse({ status: 200, description: 'Account activated' })
  @ApiResponse({ status: 400, description: 'Invalid or expired invitation token' })
  async activateAccount(@Body() dto: ActivateAccountDto) {
    await this.authService.activateAccount(dto.token, dto.password);
    return { message: 'Account activated successfully. You can now log in.' };
  }
}
