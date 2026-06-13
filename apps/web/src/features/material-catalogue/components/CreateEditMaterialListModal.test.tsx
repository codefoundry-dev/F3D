import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreateEditMaterialListModal } from './CreateEditMaterialListModal';

describe('CreateEditMaterialListModal', () => {
  it('renders the create title and an empty form', () => {
    render(
      <CreateEditMaterialListModal isSubmitting={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText('Create new Material list')).toBeInTheDocument();
    expect(screen.getByTestId('create-list-name')).toHaveValue('');
    expect(screen.getByTestId('create-list-submit')).toHaveTextContent('Create');
  });

  it('pre-fills the form and shows "Save" when editing', () => {
    render(
      <CreateEditMaterialListModal
        list={{ id: 'l-1', name: 'Steel', description: 'Beams' }}
        isSubmitting={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('Edit Material list')).toBeInTheDocument();
    expect(screen.getByTestId('create-list-name')).toHaveValue('Steel');
    expect(screen.getByTestId('create-list-description')).toHaveValue('Beams');
    expect(screen.getByTestId('create-list-submit')).toHaveTextContent('Save');
  });

  it('blocks submit and shows an error when the name is empty', () => {
    const onSubmit = vi.fn();
    render(
      <CreateEditMaterialListModal isSubmitting={false} onClose={vi.fn()} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByTestId('create-list-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
  });

  it('submits the trimmed name and description', () => {
    const onSubmit = vi.fn();
    render(
      <CreateEditMaterialListModal isSubmitting={false} onClose={vi.fn()} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByTestId('create-list-name'), { target: { value: '  Concrete  ' } });
    fireEvent.change(screen.getByTestId('create-list-description'), {
      target: { value: ' Mix ' },
    });
    fireEvent.click(screen.getByTestId('create-list-submit'));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Concrete', description: 'Mix' });
  });

  it('omits the description when it is left blank', () => {
    const onSubmit = vi.fn();
    render(
      <CreateEditMaterialListModal isSubmitting={false} onClose={vi.fn()} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByTestId('create-list-name'), { target: { value: 'Concrete' } });
    fireEvent.click(screen.getByTestId('create-list-submit'));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Concrete', description: undefined });
  });

  it('fires onClose from the Cancel button', () => {
    const onClose = vi.fn();
    render(
      <CreateEditMaterialListModal isSubmitting={false} onClose={onClose} onSubmit={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('create-list-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
