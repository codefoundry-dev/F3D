vi.mock('./useCreateUserForm', () => ({ useCreateUserForm: vi.fn() }));
vi.mock('./useEditUserForm', () => ({ useEditUserForm: vi.fn() }));
vi.mock('./useRoleOptions', () => ({ useRoleOptions: vi.fn() }));
vi.mock('./useUserSort', () => ({ useUserSort: vi.fn() }));

import { useCreateUserForm, useEditUserForm, useRoleOptions, useUserSort } from './index';

describe('users/hooks re-exports', () => {
  it('re-exports useCreateUserForm', () => {
    expect(useCreateUserForm).toBeDefined();
  });

  it('re-exports useEditUserForm', () => {
    expect(useEditUserForm).toBeDefined();
  });

  it('re-exports useRoleOptions', () => {
    expect(useRoleOptions).toBeDefined();
  });

  it('re-exports useUserSort', () => {
    expect(useUserSort).toBeDefined();
  });
});
