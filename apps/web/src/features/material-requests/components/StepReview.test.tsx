import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import type { MrWizardLine } from '../wizard/wizard-types';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus.svg?react', () => ({
  default: () => <svg />,
}));

import { StepReview } from './StepReview';

function line(overrides: Partial<MrWizardLine> = {}): MrWizardLine {
  return {
    key: 'k1',
    source: 'CATALOG',
    materialName: 'Steel Rebar #4',
    unit: 'pieces',
    quantity: 50,
    priority: 'HIGH',
    ...overrides,
  };
}

describe('StepReview', () => {
  it('renders the empty state with no lines', () => {
    render(
      <StepReview
        jobCode="JOB-1"
        projectName="Site A"
        lines={[]}
        onEditLine={vi.fn()}
        onDeleteLine={vi.fn()}
        onAddMore={vi.fn()}
      />,
    );
    expect(screen.getByText('review.emptyTitle')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-review-step')).not.toBeInTheDocument();
  });

  it('lists each material with its quantity and a priority badge', () => {
    render(
      <StepReview
        jobCode="JOB-1"
        projectName="Site A"
        lines={[line(), line({ key: 'k2', materialName: 'Plywood', priority: 'STANDARD' })]}
        onEditLine={vi.fn()}
        onDeleteLine={vi.fn()}
        onAddMore={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('mr-review-item')).toHaveLength(2);
    expect(screen.getByText('Steel Rebar #4')).toBeInTheDocument();
    expect(screen.getByText('Plywood')).toBeInTheDocument();
    // High line maps to the High Priority badge; Standard maps to Medium.
    expect(screen.getByText('review.highPriority')).toBeInTheDocument();
    expect(screen.getByText('review.mediumPriority')).toBeInTheDocument();
  });

  it('fires edit, delete and add-more callbacks', () => {
    const onEditLine = vi.fn();
    const onDeleteLine = vi.fn();
    const onAddMore = vi.fn();
    render(
      <StepReview
        jobCode="JOB-1"
        projectName="Site A"
        lines={[line()]}
        onEditLine={onEditLine}
        onDeleteLine={onDeleteLine}
        onAddMore={onAddMore}
      />,
    );
    fireEvent.click(screen.getByLabelText('review.edit'));
    fireEvent.click(screen.getByLabelText('review.delete'));
    fireEvent.click(screen.getByTestId('mr-add-more'));
    expect(onEditLine).toHaveBeenCalledWith('k1');
    expect(onDeleteLine).toHaveBeenCalledWith('k1');
    expect(onAddMore).toHaveBeenCalledTimes(1);
  });
});
