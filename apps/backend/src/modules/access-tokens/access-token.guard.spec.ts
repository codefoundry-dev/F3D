import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessTokenPurpose, AccessTokenSubject } from '@prisma/client';

import { ACCESS_TOKEN_REQUEST_PROPERTY, type AccessTokenMeta } from './access-token.decorators';
import { AccessTokenGuard } from './access-token.guard';
import { AccessTokensService } from './access-tokens.service';

interface MockRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  ip?: string;
  socket?: { remoteAddress?: string };
  [ACCESS_TOKEN_REQUEST_PROPERTY]?: unknown;
}

function buildContext(request: MockRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('AccessTokenGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let service: { validateToken: jest.Mock };
  let guard: AccessTokenGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    service = { validateToken: jest.fn() };
    guard = new AccessTokenGuard(
      reflector as unknown as Reflector,
      service as unknown as AccessTokensService,
    );
  });

  it('skips routes that do not opt in via @RequireAccessToken', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = buildContext({ headers: {}, query: {} });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(service.validateToken).not.toHaveBeenCalled();
  });

  it('reads the token from the X-Access-Token header', async () => {
    const meta: AccessTokenMeta = { expectedPurpose: AccessTokenPurpose.RFQ_VIEW };
    reflector.getAllAndOverride.mockReturnValue(meta);
    const row = { id: 'tok-1' };
    service.validateToken.mockResolvedValue(row);

    const request: MockRequest = {
      headers: { 'x-access-token': 'abc_def' },
      query: {},
      ip: '1.2.3.4',
    };
    const ctx = buildContext(request);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(service.validateToken).toHaveBeenCalledWith('abc_def', {
      expectedPurpose: AccessTokenPurpose.RFQ_VIEW,
      expectedSubjectType: undefined,
      ip: '1.2.3.4',
    });
    expect(request[ACCESS_TOKEN_REQUEST_PROPERTY]).toBe(row);
  });

  it('falls back to the ?token query parameter', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      expectedPurpose: AccessTokenPurpose.QUOTE_SUBMIT,
      expectedSubjectType: AccessTokenSubject.QUOTE_RESPONSE,
    } satisfies AccessTokenMeta);
    service.validateToken.mockResolvedValue({ id: 't' });

    const ctx = buildContext({
      headers: {},
      query: { token: 'xyz_qrs' },
      ip: '10.0.0.1',
    });

    await guard.canActivate(ctx);
    expect(service.validateToken).toHaveBeenCalledWith('xyz_qrs', {
      expectedPurpose: AccessTokenPurpose.QUOTE_SUBMIT,
      expectedSubjectType: AccessTokenSubject.QUOTE_RESPONSE,
      ip: '10.0.0.1',
    });
  });

  it('prefers x-forwarded-for over request.ip', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      expectedPurpose: AccessTokenPurpose.RFQ_VIEW,
    });
    service.validateToken.mockResolvedValue({ id: 't' });

    const ctx = buildContext({
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'x-access-token': 'a_b' },
      query: {},
      ip: '127.0.0.1',
    });

    await guard.canActivate(ctx);
    expect(service.validateToken).toHaveBeenCalledWith('a_b', expect.objectContaining({ ip: '203.0.113.7' }));
  });

  it('throws 403 when no token is provided', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      expectedPurpose: AccessTokenPurpose.RFQ_VIEW,
    });
    const ctx = buildContext({ headers: {}, query: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(service.validateToken).not.toHaveBeenCalled();
  });

  it('propagates errors raised by validateToken', async () => {
    reflector.getAllAndOverride.mockReturnValue({
      expectedPurpose: AccessTokenPurpose.RFQ_VIEW,
    });
    service.validateToken.mockRejectedValue(new ForbiddenException('expired'));

    const ctx = buildContext({
      headers: { 'x-access-token': 'a_b' },
      query: {},
      ip: '1.1.1.1',
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(/expired/);
  });
});
