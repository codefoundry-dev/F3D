import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

// The photo upload (FOR-404): `mutate` is driven per test, `isPending` toggled.
const uploadState = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  // What the stubbed dropzone hands over when clicked.
  nextFile: null as File | null,
}));

vi.mock('../services/material-requests.service', () => ({
  useUploadMrLinePhoto: () => ({ mutate: uploadState.mutate, isPending: uploadState.isPending }),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('@forethread/ui-components', () => ({
  GridModal: ({
    title,
    children,
    actions,
  }: {
    title: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
  }) => (
    <div data-testid="modal">
      <div>{title}</div>
      <div>{children}</div>
      <div>{actions}</div>
    </div>
  ),
  Input: ({
    value,
    onChange,
    type,
    'aria-label': ariaLabel,
    'data-testid': testId,
  }: {
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    type?: string;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => (
    <input
      type={type}
      aria-label={ariaLabel}
      data-testid={testId}
      value={value}
      onChange={(e) => onChange({ target: { value: e.target.value } })}
    />
  ),
  Textarea: ({
    value,
    onChange,
    'aria-label': ariaLabel,
  }: {
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    'aria-label'?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange({ target: { value: e.target.value } })}
    />
  ),
  Select: ({
    value,
    onChange,
    children,
    'aria-label': ariaLabel,
  }: {
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    children: ReactNode;
    'aria-label'?: string;
  }) => (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange({ target: { value: e.target.value } })}
    >
      {children}
    </select>
  ),
  FileDropzone: ({ onFiles }: { onFiles: (files: File[]) => void }) => (
    <button
      type="button"
      data-testid="dropzone"
      onClick={() =>
        onFiles([uploadState.nextFile ?? new File(['x'], 'photo.png', { type: 'image/png' })])
      }
    >
      upload
    </button>
  ),
}));

vi.mock('./MobileButtons', () => ({
  PrimaryButton: ({
    children,
    onClick,
    disabled,
    'data-testid': testId,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'data-testid'?: string;
  }) => (
    <button type="button" data-testid={testId} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

import { NewMaterialModal } from './NewMaterialModal';

describe('NewMaterialModal', () => {
  beforeEach(() => {
    uploadState.mutate.mockReset();
    uploadState.isPending = false;
    uploadState.nextFile = null;
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  const fillRequired = () => {
    fireEvent.change(screen.getByTestId('mr-new-material-name'), { target: { value: 'Conduit' } });
    fireEvent.change(screen.getByTestId('mr-new-material-qty'), { target: { value: '4' } });
  };

  /** Make the next upload succeed with this file id. */
  const succeedUpload = (fileId = 'file-1') =>
    uploadState.mutate.mockImplementation((file: File, opts: { onSuccess: (r: unknown) => void }) =>
      opts.onSuccess({ fileId, fileName: file.name, url: 'https://signed/x' }),
    );

  it('uploads a picked photo and sends its file id with the line (FOR-404)', () => {
    const onAdd = vi.fn();
    succeedUpload('file-1');
    render(<NewMaterialModal onClose={vi.fn()} onAdd={onAdd} />);
    fillRequired();

    fireEvent.click(screen.getByTestId('dropzone'));

    expect(uploadState.mutate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('mr-new-material-photo')).toHaveTextContent('photo.png');
    expect(screen.getByRole('img', { name: 'photo.png' })).toHaveAttribute('src', 'blob:preview');

    fireEvent.click(screen.getByTestId('mr-new-material-add'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        materialName: 'Conduit',
        photoFileId: 'file-1',
        imageUrl: 'blob:preview',
      }),
    );
  });

  it('adds the line without a photo once the photo is removed', () => {
    const onAdd = vi.fn();
    succeedUpload();
    render(<NewMaterialModal onClose={vi.fn()} onAdd={onAdd} />);
    fillRequired();
    fireEvent.click(screen.getByTestId('dropzone'));

    fireEvent.click(screen.getByTestId('mr-new-material-photo-remove'));
    expect(screen.queryByTestId('mr-new-material-photo')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');

    fireEvent.click(screen.getByTestId('mr-new-material-add'));
    const draft = onAdd.mock.calls[0][0];
    expect(draft.photoFileId).toBeUndefined();
    expect(draft.imageUrl).toBeUndefined();
  });

  it('rejects a non-image or oversized file without uploading', () => {
    render(<NewMaterialModal onClose={vi.fn()} onAdd={vi.fn()} />);

    uploadState.nextFile = new File(['x'], 'spec.pdf', { type: 'application/pdf' });
    fireEvent.click(screen.getByTestId('dropzone'));
    expect(screen.getByTestId('mr-new-material-photo-error')).toHaveTextContent(
      'newMaterial.photoTypeError',
    );

    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 });
    uploadState.nextFile = big;
    fireEvent.click(screen.getByTestId('dropzone'));
    expect(screen.getByTestId('mr-new-material-photo-error')).toHaveTextContent(
      'newMaterial.photoSizeError',
    );

    expect(uploadState.mutate).not.toHaveBeenCalled();
  });

  it('shows an error and keeps the dropzone when the upload fails', () => {
    const onAdd = vi.fn();
    uploadState.mutate.mockImplementation((_file: File, opts: { onError: () => void }) =>
      opts.onError(),
    );
    render(<NewMaterialModal onClose={vi.fn()} onAdd={onAdd} />);
    fillRequired();

    fireEvent.click(screen.getByTestId('dropzone'));

    expect(screen.getByTestId('mr-new-material-photo-error')).toHaveTextContent(
      'newMaterial.photoUploadError',
    );
    expect(screen.getByTestId('dropzone')).toBeInTheDocument();
    // The line can still be added, just without a photo.
    fireEvent.click(screen.getByTestId('mr-new-material-add'));
    expect(onAdd.mock.calls[0][0].photoFileId).toBeUndefined();
  });

  it('holds Add while a photo is still uploading', () => {
    uploadState.isPending = true;
    render(<NewMaterialModal onClose={vi.fn()} onAdd={vi.fn()} />);
    fillRequired();
    expect(screen.getByTestId('mr-new-material-add')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('newMaterial.photoUploading');
  });

  it('disables Add until a name and positive quantity are present', () => {
    render(<NewMaterialModal onClose={vi.fn()} onAdd={vi.fn()} />);
    const addBtn = screen.getByTestId('mr-new-material-add');
    expect(addBtn).toBeDisabled();

    fireEvent.change(screen.getByTestId('mr-new-material-name'), {
      target: { value: 'Conduit' },
    });
    // Quantity still 0 → still disabled.
    expect(addBtn).toBeDisabled();

    fireEvent.change(screen.getByTestId('mr-new-material-qty'), { target: { value: '4' } });
    expect(addBtn).not.toBeDisabled();
  });

  it('emits the draft with name, unit and quantity on Add', () => {
    const onAdd = vi.fn();
    render(<NewMaterialModal onClose={vi.fn()} onAdd={onAdd} />);
    fireEvent.change(screen.getByTestId('mr-new-material-name'), {
      target: { value: 'Conduit' },
    });
    fireEvent.change(screen.getByTestId('mr-new-material-qty'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('mr-new-material-add'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ materialName: 'Conduit', unit: 'Each', quantity: 4 }),
    );
  });
});
