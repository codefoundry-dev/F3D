import { IS_PUBLIC_KEY, Public } from './public.decorator';

const mockSetMetadata = jest.fn();
jest.mock('@nestjs/common', () => ({
  SetMetadata: (...args: unknown[]) => {
    mockSetMetadata(...args);
    return jest.fn();
  },
}));

describe('Public Decorator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export IS_PUBLIC_KEY as "isPublic"', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('should call SetMetadata with IS_PUBLIC_KEY and true', () => {
    Public();
    expect(mockSetMetadata).toHaveBeenCalledWith('isPublic', true);
  });
});
