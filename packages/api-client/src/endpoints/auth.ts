import { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { AUTH_PATHS } from './paths';

export interface LoginDto {
  email: string;
  password: string;
  /** "Remember me for 30 days". Omitted = true. False forces the sign-in code. */
  rememberDevice?: boolean;
}

export interface VerifyOtpDto {
  userId: string;
  otp: string;
  /** "Remember me for 30 days". Omitted = true. False forgets this browser. */
  rememberDevice?: boolean;
}

export interface ResendOtpDto {
  userId: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface ActivateAccountDto {
  token: string;
  password: string;
}

/**
 * Result of the password step. On a new device or browser a one-time code is
 * emailed (`otpRequired: true`) and sign-in finishes at verify-otp. A trusted
 * browser skips the code: the session cookies are already set on this response.
 */
export type LoginResponse =
  | { otpRequired: true; userId: string; otpExpiresAt: string }
  | { otpRequired: false };

/** A freshly re-sent one-time code for an in-progress sign-in. */
export interface ResendOtpResponse {
  userId: string;
  otpExpiresAt: string;
}

export interface VerifyOtpResponse {
  success: boolean;
}

export interface RefreshResponse {
  success: boolean;
}

export interface ValidateActivationTokenResponse {
  valid: boolean;
  email: string;
}

export async function login(dto: LoginDto, config?: AxiosRequestConfig): Promise<LoginResponse> {
  const { data } = await getApiClient().post<{ data: LoginResponse }>(
    AUTH_PATHS.LOGIN,
    dto,
    config,
  );
  return data.data;
}

export async function verifyOtp(
  dto: VerifyOtpDto,
  config?: AxiosRequestConfig,
): Promise<VerifyOtpResponse> {
  const { data } = await getApiClient().post<{ data: VerifyOtpResponse }>(
    AUTH_PATHS.VERIFY_OTP,
    dto,
    config,
  );
  return data.data;
}

export async function resendOtp(
  dto: ResendOtpDto,
  config?: AxiosRequestConfig,
): Promise<ResendOtpResponse> {
  const { data } = await getApiClient().post<{ data: ResendOtpResponse }>(
    AUTH_PATHS.RESEND_OTP,
    dto,
    config,
  );
  return data.data;
}

export async function refreshToken(): Promise<RefreshResponse> {
  const { data } = await getApiClient().post<{ data: RefreshResponse }>(AUTH_PATHS.REFRESH);
  return data.data;
}

export async function logout(): Promise<void> {
  await getApiClient().post(AUTH_PATHS.LOGOUT);
}

export async function forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
  const { data } = await getApiClient().post<{ data: { message: string } }>(
    AUTH_PATHS.FORGOT_PASSWORD,
    dto,
  );
  return data.data;
}

export async function resetPassword(
  dto: ResetPasswordDto,
  config?: AxiosRequestConfig,
): Promise<{ message: string }> {
  const { data } = await getApiClient().post<{ data: { message: string } }>(
    AUTH_PATHS.RESET_PASSWORD,
    dto,
    config,
  );
  return data.data;
}

export async function activateAccount(
  dto: ActivateAccountDto,
  config?: AxiosRequestConfig,
): Promise<{ message: string }> {
  const { data } = await getApiClient().post<{ data: { message: string } }>(
    AUTH_PATHS.ACTIVATE,
    dto,
    config,
  );
  return data.data;
}

export async function validateActivationToken(
  token: string,
  config?: AxiosRequestConfig,
): Promise<ValidateActivationTokenResponse> {
  const { data } = await getApiClient().post<{ data: ValidateActivationTokenResponse }>(
    AUTH_PATHS.VALIDATE_ACTIVATION_TOKEN,
    { token },
    config,
  );
  return data.data;
}

export async function requestNewInvitation(email: string): Promise<{ message: string }> {
  const { data } = await getApiClient().post<{ data: { message: string } }>(
    AUTH_PATHS.REQUEST_NEW_INVITATION,
    { email },
  );
  return data.data;
}
