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
  // Multi-select renders each option as a checkbox labelled by the member name.
  SelectDropdown: ({
    selected = [],
    onSelectedChange,
    options,
  }: {
    selected?: string[];
    onSelectedChange?: (s: string[]) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <div>
      {options.map((o) => (
        <label key={o.value}>
          <input
            type="checkbox"
            aria-label={o.label}
            checked={selected.includes(o.value)}
            onChange={() =>
              onSelectedChange?.(
                selected.includes(o.value)
                  ? selected.filter((v) => v !== o.value)
                  : [...selected, o.value],
              )
            }
          />
          {o.label}
        </label>
      ))}
    </div>
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
const MEMBERS = [
  { id: 'u1', name: 'Jane Doe' },
  { id: 'u2', name: 'John Smith' },
];

describe('StepMaterialDetails', () => {
  it('renders a table row per line with the material name', () => {
    render(
      <StepMaterialDetails
        lines={[line(), line({ key: 'k2', materialName: 'Plywood' })]}
        errors={{}}
        locationOptions={LOCATIONS}
        memberOptions={MEMBERS}
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
        memberOptions={MEMBERS}
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
        memberOptions={MEMBERS}
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
        memberOptions={MEMBERS}
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
        memberOptions={MEMBERS}
        onPatchLine={vi.fn()}
      />,
    );
    // The quantity label renders as both the column header and the per-row
    // error; more than one occurrence proves the error branch rendered.
    expect(screen.getAllByText('materialDetails.quantityNeeded').length).toBeGreaterThan(1);
  });

  it('reveals the CC team / instructions / notes drawer when the notes cell is toggled', () => {
    render(
      <StepMaterialDetails
        lines={[line()]}
        errors={{}}
        locationOptions={LOCATIONS}
        memberOptions={MEMBERS}
        onPatchLine={vi.fn()}
      />,
    );
    // The optional fields stay hidden until the row is expanded.
    expect(screen.queryByTestId('mr-cc-k1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mr-notes-toggle-k1'));
    expect(screen.getByTestId('mr-cc-k1')).toBeInTheDocument();
    expect(screen.getByLabelText('materialDetails.instructions')).toBeInTheDocument();
    expect(screen.getByLabelText('materialDetails.internalNotes')).toBeInTheDocument();
  });

  it('CCs a project member chosen from the members dropdown', () => {
    const onPatchLine = vi.fn();
    render(
      <StepMaterialDetails
        lines={[line()]}
        errors={{}}
        locationOptions={LOCATIONS}
        memberOptions={MEMBERS}
        onPatchLine={onPatchLine}
      />,
    );
    fireEvent.click(screen.getByTestId('mr-notes-toggle-k1'));
    fireEvent.click(screen.getByLabelText('Jane Doe'));
    expect(onPatchLine).toHaveBeenCalledWith('k1', { ccTeamMembers: ['Jane Doe'] });
  });

  it('patches an instruction typed into the expanded drawer', () => {
    const onPatchLine = vi.fn();
    render(
      <StepMaterialDetails
        lines={[line()]}
        errors={{}}
        locationOptions={LOCATIONS}
        memberOptions={MEMBERS}
        onPatchLine={onPatchLine}
      />,
    );
    fireEvent.click(screen.getByTestId('mr-notes-toggle-k1'));
    fireEvent.change(screen.getByLabelText('materialDetails.instructions'), {
      target: { value: 'Handle with care' },
    });
    expect(onPatchLine).toHaveBeenCalledWith('k1', { instructions: 'Handle with care' });
  });
});
