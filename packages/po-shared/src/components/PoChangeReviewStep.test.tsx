import type { PoChangedFields } from '@forethread/api-client';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

vi.mock('./PoChangeDiff', () => ({
  PoChangeDiff: () => <div data-testid="diff" />,
}));

import { PoChangeReviewStep } from './PoChangeReviewStep';

const register = (() => ({
  name: 'message',
  onChange: vi.fn(),
  onBlur: vi.fn(),
  ref: vi.fn(),
})) as any;

describe('PoChangeReviewStep', () => {
  it('renders the diff and note textarea when there are changes', () => {
    const changed: PoChangedFields = { fields: { paymentTermsDays: { from: 30, to: 10 } } };
    render(<PoChangeReviewStep changedFields={changed} register={register} locationOptions={[]} />);
    expect(screen.getByTestId('diff')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('change.notePlaceholder')).toBeInTheDocument();
  });

  it('shows the no-changes hint and no diff when the payload is empty', () => {
    render(<PoChangeReviewStep changedFields={{}} register={register} locationOptions={[]} />);
    expect(screen.queryByTestId('diff')).not.toBeInTheDocument();
    expect(screen.getByText('change.noChanges')).toBeInTheDocument();
  });
});
