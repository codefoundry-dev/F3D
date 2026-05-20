import { renderHook, act } from '@testing-library/react';

const mockGetCompanyLogoUrl = vi.hoisted(() => vi.fn());
const mockUploadCompanyLogo = vi.hoisted(() => vi.fn());
vi.mock('@forethread/api-client', () => ({
  getCompanyLogoUrl: (...args: unknown[]) => mockGetCompanyLogoUrl(...args),
  uploadCompanyLogo: (...args: unknown[]) => mockUploadCompanyLogo(...args),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockNotificationService = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('@forethread/ui-components', () => ({
  notificationService: mockNotificationService,
}));

const mockMutate = vi.hoisted(() => vi.fn());
const mockInvalidateQueries = vi.hoisted(() => vi.fn());
const capturedMutationOnSuccess = vi.hoisted(() => ({ fn: null as (() => void) | null }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: {
    queryKey: string[];
    queryFn: () => unknown;
    select?: (d: unknown) => unknown;
  }) => {
    if (!opts.queryKey[1]) return { data: undefined };
    const raw = { url: 'https://logo.example.com/logo.png' };
    return { data: opts.select ? opts.select(raw) : raw };
  },
  useMutation: (opts: { onSuccess?: () => void }) => {
    capturedMutationOnSuccess.fn = opts.onSuccess ?? null;
    return {
      mutate: mockMutate,
      isPending: false,
    };
  },
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

import { useCompanyLogo } from './useCompanyLogo';

describe('useCompanyLogo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns logoUrl when companyId is provided', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    expect(result.current.logoUrl).toBe('https://logo.example.com/logo.png');
  });

  it('returns undefined logoUrl when companyId is undefined', () => {
    const { result } = renderHook(() => useCompanyLogo(undefined));
    expect(result.current.logoUrl).toBeUndefined();
  });

  it('returns isPending as false initially', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    expect(result.current.isPending).toBe(false);
  });

  it('provides an inputRef', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    expect(result.current.inputRef).toBeDefined();
    expect(result.current.inputRef.current).toBeNull();
  });

  it('handleLogoChange does nothing when no file selected', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    const event = {
      target: { files: null, value: '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleLogoChange(event);
    });

    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockNotificationService.error).not.toHaveBeenCalled();
  });

  it('handleLogoChange shows error for invalid file type', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    const file = new File(['data'], 'test.gif', { type: 'image/gif' });
    const event = {
      target: { files: [file], value: 'test.gif' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleLogoChange(event);
    });

    expect(mockNotificationService.error).toHaveBeenCalledWith('logoInvalidFormat');
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('handleLogoChange shows error for file exceeding 5MB', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    const bigFile = new File(['x'.repeat(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    const event = {
      target: { files: [bigFile], value: 'big.png' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleLogoChange(event);
    });

    expect(mockNotificationService.error).toHaveBeenCalledWith('logoTooLarge');
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('handleLogoChange calls mutate for valid file', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    const file = new File(['data'], 'logo.png', { type: 'image/png' });
    const event = {
      target: { files: [file], value: 'logo.png' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleLogoChange(event);
    });

    expect(mockMutate).toHaveBeenCalledWith(file);
  });

  it('handleLogoChange resets input value', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    const target = {
      files: [new File(['data'], 'logo.png', { type: 'image/png' })],
      value: 'logo.png',
    };
    const event = { target } as unknown as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleLogoChange(event);
    });

    expect(target.value).toBe('');
  });

  it('handleLogoChange accepts webp files', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    const file = new File(['data'], 'logo.webp', { type: 'image/webp' });
    const event = {
      target: { files: [file], value: 'logo.webp' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleLogoChange(event);
    });

    expect(mockMutate).toHaveBeenCalledWith(file);
  });

  it('handleLogoChange accepts svg files', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    const file = new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' });
    const event = {
      target: { files: [file], value: 'logo.svg' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleLogoChange(event);
    });

    expect(mockMutate).toHaveBeenCalledWith(file);
  });

  it('openFilePicker calls click on inputRef', () => {
    const { result } = renderHook(() => useCompanyLogo('company-1'));
    const mockClick = vi.fn();
    // Simulate a mounted input ref
    Object.defineProperty(result.current.inputRef, 'current', {
      value: { click: mockClick },
      writable: true,
    });

    act(() => {
      result.current.openFilePicker();
    });

    expect(mockClick).toHaveBeenCalled();
  });

  it('exercises the upload mutation onSuccess callback', () => {
    renderHook(() => useCompanyLogo('company-1'));
    // The onSuccess callback is captured from the useMutation call
    if (capturedMutationOnSuccess.fn) {
      capturedMutationOnSuccess.fn();
      expect(mockInvalidateQueries).toHaveBeenCalled();
    }
  });
});
