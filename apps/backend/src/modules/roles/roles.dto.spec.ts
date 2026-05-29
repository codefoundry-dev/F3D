import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateRolePermissionsDto } from './roles.service';

/**
 * Guards against the FOR-196 regression where `thresholds` used
 * `@ValidateNested` against an index-signature DTO. Under the global pipe's
 * `forbidNonWhitelisted` that rejected every dynamic permission key with
 * "thresholds.property po.approve should not exist". These specs validate the
 * DTO with the SAME pipe options the app uses (see main.ts), with no DB.
 */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true } as const;

async function validateDto(payload: unknown) {
  const instance = plainToInstance(UpdateRolePermissionsDto, payload);
  return validate(instance as object, PIPE_OPTIONS);
}

describe('UpdateRolePermissionsDto validation', () => {
  it('accepts a thresholds map with dynamic permission keys (regression)', async () => {
    const errors = await validateDto({
      permissionKeys: ['po.approve', 'invoice.approve'],
      thresholds: { 'po.approve': 25000, 'invoice.approve': 50000 },
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a null threshold (unlimited)', async () => {
    const errors = await validateDto({
      permissionKeys: ['po.approve'],
      thresholds: { 'po.approve': null },
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with no thresholds (optional)', async () => {
    const errors = await validateDto({ permissionKeys: ['rfq.read'] });
    expect(errors).toHaveLength(0);
  });

  it('rejects thresholds that is not an object', async () => {
    const errors = await validateDto({ permissionKeys: [], thresholds: 'nope' });
    expect(errors.some((e) => e.property === 'thresholds')).toBe(true);
  });

  it('still rejects unknown top-level properties (whitelist intact)', async () => {
    const errors = await validateDto({ permissionKeys: [], bogus: 1 });
    expect(errors.some((e) => e.property === 'bogus')).toBe(true);
  });
});
