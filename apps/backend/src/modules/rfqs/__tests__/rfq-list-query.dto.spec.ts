import 'reflect-metadata';

import { RfqListQueryDto } from '@forethread/shared-types';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Guards the quick-filter casing contract. The web clients send camelCase
 * quick-filter keys (PO_CA_QUICK_FILTERS / VENDOR_QUICK_FILTERS) straight
 * through to GET /v1/rfqs. Previously `QuickFilter` only enumerated PascalCase
 * values ('MyRfqs', …), so every chip click failed `@IsEnum(QuickFilter)` →
 * 400, which `getRfqs({ skipErrorHandler: true })` swallowed into an empty
 * table ("filters don't work"). These specs validate the DTO with the SAME
 * pipe options the app uses (see main.ts), with no DB.
 */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true } as const;

async function validateQuery(payload: unknown) {
  const instance = plainToInstance(RfqListQueryDto, payload);
  return validate(instance as object, PIPE_OPTIONS);
}

// The exact keys the buyer (PO/CA) and vendor list pages send as `quickFilter`.
const CLIENT_QUICK_FILTERS = [
  'myRfqs',
  'openRfqs',
  'awaitingResponses',
  'noQuotes',
  'awardedRfqs',
  'closedRfqs',
  'incoming',
  'approvedForMe',
] as const;

describe('RfqListQueryDto quickFilter validation', () => {
  it.each(CLIENT_QUICK_FILTERS)('accepts the camelCase quick filter %s', async (quickFilter) => {
    const errors = await validateQuery({ quickFilter });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown quick filter', async () => {
    const errors = await validateQuery({ quickFilter: 'bogus' });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('quickFilter');
  });

  it('treats quickFilter as optional', async () => {
    const errors = await validateQuery({});
    expect(errors).toHaveLength(0);
  });
});
