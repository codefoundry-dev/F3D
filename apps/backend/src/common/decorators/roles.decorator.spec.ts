import { ROLES_KEY, Roles } from './roles.decorator';

// We need to capture what SetMetadata was called with
const mockSetMetadata = jest.fn();
jest.mock('@nestjs/common', () => ({
  SetMetadata: (...args: unknown[]) => {
    mockSetMetadata(...args);
    return jest.fn(); // SetMetadata returns a decorator function
  },
}));

describe('Roles Decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export ROLES_KEY as "roles"', () => {
    expect(ROLES_KEY).toBe('roles');
  });

  it('should call SetMetadata with ROLES_KEY and provided roles', () => {
    Roles('SUPER_ADMIN' as never, 'COMPANY_ADMIN' as never);
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', ['SUPER_ADMIN', 'COMPANY_ADMIN']);
  });

  it('should call SetMetadata with an empty array when no roles provided', () => {
    Roles();
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', []);
  });

  it('should call SetMetadata with a single role', () => {
    Roles('VENDOR' as never);
    expect(mockSetMetadata).toHaveBeenCalledWith('roles', ['VENDOR']);
  });
});
