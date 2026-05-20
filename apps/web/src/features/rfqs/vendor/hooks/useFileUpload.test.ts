import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  getApiClient: () => ({ post: mockPost }),
}));

import { useFileUpload } from './useFileUpload';

describe('useFileUpload', () => {
  const onAddId = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: { data: { id: 'file-123' } } });
  });

  it('starts with empty state', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.attachments).toEqual([]);
    expect(result.current.uploadError).toBeNull();
    expect(result.current.isUploading).toBe(false);
  });

  it('rejects invalid file extensions', async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(['data'], 'test.exe', { type: 'application/octet-stream' });

    await act(async () => {
      await result.current.handleFileUpload(file, onAddId);
    });

    expect(result.current.uploadError).toBe('response.invalidFileType');
    expect(mockPost).not.toHaveBeenCalled();
    expect(onAddId).not.toHaveBeenCalled();
  });

  it('rejects files over 10MB', async () => {
    const { result } = renderHook(() => useFileUpload());
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });

    await act(async () => {
      await result.current.handleFileUpload(largeFile, onAddId);
    });

    expect(result.current.uploadError).toBe('response.fileTooLarge');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('uploads valid file and adds to attachments', async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.handleFileUpload(file, onAddId);
    });

    expect(mockPost).toHaveBeenCalledWith('/storage/upload', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    expect(onAddId).toHaveBeenCalledWith('file-123');
    expect(result.current.attachments).toEqual([{ id: 'file-123', name: 'report.pdf' }]);
    expect(result.current.isUploading).toBe(false);
  });

  it('sets upload error on API failure', async () => {
    mockPost.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useFileUpload());
    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.handleFileUpload(file, onAddId);
    });

    expect(result.current.uploadError).toBe('response.uploadError');
    expect(result.current.isUploading).toBe(false);
  });

  it('removes attachment by id', async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' });

    await act(async () => {
      await result.current.handleFileUpload(file, onAddId);
    });

    expect(result.current.attachments).toHaveLength(1);

    act(() => {
      result.current.removeAttachment('file-123');
    });

    expect(result.current.attachments).toEqual([]);
  });

  it('clears previous error on new upload attempt', async () => {
    const { result } = renderHook(() => useFileUpload());
    const badFile = new File(['data'], 'test.exe', { type: 'application/octet-stream' });

    await act(async () => {
      await result.current.handleFileUpload(badFile, onAddId);
    });
    expect(result.current.uploadError).toBe('response.invalidFileType');

    const goodFile = new File(['data'], 'report.pdf', { type: 'application/pdf' });
    await act(async () => {
      await result.current.handleFileUpload(goodFile, onAddId);
    });
    expect(result.current.uploadError).toBeNull();
  });

  it('accepts allowed extensions: xlsx, docx, jpg, jpeg, csv', async () => {
    const extensions = ['report.xlsx', 'doc.docx', 'photo.jpg', 'image.jpeg', 'data.csv'];
    for (const name of extensions) {
      const { result } = renderHook(() => useFileUpload());
      const file = new File(['data'], name);

      await act(async () => {
        await result.current.handleFileUpload(file, onAddId);
      });

      expect(result.current.uploadError).toBeNull();
    }
  });
});
