import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';

import type { MrWizardLine, MrDetailsErrors } from '../wizard/wizard-types';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock('@forethread/ui-components', () => ({
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
  DatePicker: ({ value, onChange }: { value: string; onChange: (d: string) => void }) => (
    <input aria-label="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { StepMaterialDetails } from './StepMaterialDetails';

function line(overrides: Partial<MrWizardLine> = {}): MrWizardLine {
  return {
    key: 'k1',
    source: 'CATALOG',
    materialName: 'Steel Rebar #4',
    description: '20ft, Grade 60',
    unit: 'Pieces',
    quantity: 0,
    priority: 'STANDARD',
    maxAvailable: 47,
    ...overrides,
  };
}

const LOCATIONS = [{ id: 'loc-1', label: 'Gate B' }];

describe('StepMaterialDetails', () => {
  it('renders a card per line with the material summary', () => {
    render(
      <StepMaterialDetails
        lines={[line(), line({ key: 'k2', materialName: 'Plywood' })]}
        errors={{}}
        locationOptions={LOCATIONS}
        onPatchLine={vi.fn()}
      />,
    );
    expect(screen.getByText('Steel Rebar #4')).toBeInTheDocument();
    expect(screen.getByText('Plywood')).toBeInTheDocument();
  });

  it('patches the quantity as the foreman types', () => {
    const onPatchLine = vi.fn();
    render(
      <StepMaterialDetails
        lines={[line()]}
        errors={{}}
        locationOptions={LOCATIONS}
        onPatchLine={onPatchLine}
      />,
    );
    fireEvent.change(screen.getByTestId('mr-qty-k1'), { target: { value: '12' } });
    expect(onPatchLine).toHaveBeenCalledWith('k1', { quantity: 12 });
  });

  it('toggles priority between Standard and High', () => {
    const onPatchLine = vi.fn();
    render(
      <StepMaterialDetails
        lines={[line()]}
        errors={{}}
        locationOptions={LOCATIONS}
        onPatchLine={onPatchLine}
      />,
    );
    fireEvent.click(screen.getByText('materialDetails.priorityHigh'));
    expect(onPatchLine).toHaveBeenCalledWith('k1', { priority: 'HIGH' });
  });

  it('selects a delivery address', () => {
    const onPatchLine = vi.fn();
    render(
      <StepMaterialDetails
        lines={[line()]}
        errors={{}}
        locationOptions={LOCATIONS}
        onPatchLine={onPatchLine}
      />,
    );
    fireEvent.change(screen.getByLabelText('materialDetails.deliveryAddress'), {
      target: { value: 'loc-1' },
    });
    expect(onPatchLine).toHaveBeenCalledWith('k1', { deliveryLocationId: 'loc-1' });
  });

  it('shows the required error for a missing quantity', () => {
    const errors: MrDetailsErrors = { k1: { quantity: 'required' } };
    render(
      <StepMaterialDetails
        lines={[line()]}
        errors={errors}
        locationOptions={LOCATIONS}
        onPatchLine={vi.fn()}
      />,
    );
    // The quantity label is rendered both as the field label and the error; at
    // least one occurrence proves the error branch rendered.
    expect(screen.getAllByText('materialDetails.quantityNeeded').length).toBeGreaterThan(1);
  });
});
