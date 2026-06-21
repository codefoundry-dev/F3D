import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: { children: ReactNode }) => <div data-testid="modal">{children}</div>,
  ModalHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ModalBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
      onClick={() => onFiles([new File(['x'], 'photo.png')])}
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
