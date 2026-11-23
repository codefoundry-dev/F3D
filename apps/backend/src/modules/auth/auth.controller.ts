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
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import { Response } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  clearAuthCookies,
  clearTrustedDeviceCookie,
  readTrustedDeviceCookie,
  setAuthCookies,
  setTrustedDeviceCookie,
} from '../../common/utils/set-auth-cookies.util';

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

  /**
   * "Remember me for 30 days". Omitted = true. When false the sign-in code is
   * asked for even on a browser that was remembered before.
   */
  @IsOptional()
  @IsBoolean()
  rememberDevice?: boolean;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  /**
   * "Remember me for 30 days". Omitted = true: this browser skips the code for
   * the next 30 days. False: this browser is forgotten.
   */
  @IsOptional()
  @IsBoolean()
  rememberDevice?: boolean;
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
  @ApiOperation({
    summary:
      'Step 1 of login: validate credentials, then send an OTP — or sign in directly on a trusted browser',
  })
  @ApiResponse({
    status: 200,
    description: 'otpRequired=true: OTP sent to email. otpRequired=false: signed in (cookies set).',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account not activated' })
  async login(
    @Body() dto: LoginDto,
    @Request() req: { headers: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) res: Response,
  ) {
    // With "Remember me" unchecked the browser's trust is ignored, so the code
    // is asked for. The cookie is NOT renewed on a trusted sign-in: trust runs
    // out 30 days after the code was last entered, not after the last sign-in.
    const trustedToken =
      dto.rememberDevice === false ? undefined : readTrustedDeviceCookie(req as never);
    const result = await this.authService.login(dto.email, dto.password, trustedToken);

    if (!result.otpRequired) {
      setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken, req as never);
      return { otpRequired: false };
    }

    return { otpRequired: true, userId: result.userId, otpExpiresAt: result.otpExpiresAt };
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
    const userAgent = req.headers['user-agent'];
    const tokens = await this.authService.verifyOtp(dto.userId, dto.otp, {
      userAgent: typeof userAgent === 'string' ? userAgent : null,
      rememberDevice: dto.rememberDevice !== false,
      previousTrustedDeviceToken: readTrustedDeviceCookie(req as never),
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, req as never);
    if (tokens.trustedDeviceToken) {
      // "Remember me" checked: sign-ins from here skip the code for 30 days.
      setTrustedDeviceCookie(res, tokens.trustedDeviceToken, req as never);
    } else {
      clearTrustedDeviceCookie(res, req as never);
    }
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
