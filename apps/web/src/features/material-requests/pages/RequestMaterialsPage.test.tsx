import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { MrWizardLine } from '../wizard/wizard-types';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockNavigate = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
const mockUseProjectDetail = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ projectId: 'proj-1' }),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${key}:${String(opts.count)}`;
      return key;
    },
  }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { setTitle: () => void }) => unknown) =>
    selector({ setTitle: vi.fn() }),
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: {
    materialRequestJobs: '/material-requests/jobs',
    materialRequestJobOverview: '/material-requests/jobs/:projectId',
    materialRequestConfirmation: '/material-requests/confirmation/:id',
  },
}));

vi.mock('../services/material-requests.service', () => ({
  useMrProjectDetail: () => mockUseProjectDetail(),
  useCreateMaterialRequest: () => ({ mutate: mockMutate, isPending: false }),
}));

// Mock chrome + step components so the test drives orchestration only.
vi.mock('../components/MobileShell', () => ({
  MobileShell: ({
    header,
    footer,
    children,
  }: {
    header: ReactNode;
    footer: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      <div data-testid="header">{header}</div>
      <div data-testid="body">{children}</div>
      <div data-testid="footer">{footer}</div>
    </div>
  ),
}));
vi.mock('../components/MobileHeader', () => ({
  MobileHeader: ({
    title,
    onBack,
    trailing,
  }: {
    title: string;
    onBack?: () => void;
    trailing?: ReactNode;
  }) => (
    <div>
      <span>{title}</span>
      {onBack && (
        <button type="button" onClick={onBack} data-testid="back">
          back
        </button>
      )}
      {trailing}
    </div>
  ),
}));
vi.mock('../components/StepProgress', () => ({
  StepProgress: ({ current }: { current: number }) => <div data-testid="progress">{current}</div>,
}));
vi.mock('../components/MobileButtons', () => ({
  PrimaryButton: ({
    children,
    onClick,
    disabled,
    withArrow: _withArrow,
    leading: _leading,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    withArrow?: boolean;
    leading?: ReactNode;
    'data-testid'?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
  SecondaryButton: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    'data-testid'?: string;
    title?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

// The select step exposes buttons to add lines so we can advance the wizard.
vi.mock('../components/StepSelectMaterials', () => ({
  StepSelectMaterials: ({ onToggleLine }: { onToggleLine: (line: MrWizardLine) => void }) => (
    <div data-testid="step-select">
      <button
        type="button"
        data-testid="add-line"
        onClick={() =>
          onToggleLine({
            key: `k-${Math.random()}`,
            source: 'CATALOG',
            materialId: 'mat-1',
            materialName: 'Steel Rebar',
            unit: 'Each',
            quantity: 0,
            priority: 'STANDARD',
          })
        }
      >
        add
      </button>
    </div>
  ),
}));
vi.mock('../components/StepMaterialDetails', () => ({
  StepMaterialDetails: ({
    lines,
    errors,
    onPatchLine,
  }: {
    lines: MrWizardLine[];
    errors: Record<string, unknown>;
    onPatchLine: (key: string, patch: Partial<MrWizardLine>) => void;
  }) => (
    <div data-testid="step-details">
      <span data-testid="details-error-count">{Object.keys(errors).length}</span>
      <button
        type="button"
        data-testid="fill-line"
        onClick={() =>
          onPatchLine(lines[0].key, {
            quantity: 5,
            expectedDeliveryDate: '2026-07-01',
            deliveryTime: '09:00',
            deliveryLocationId: 'loc-1',
          })
        }
      >
        fill
      </button>
    </div>
  ),
}));
vi.mock('../components/StepReview', () => ({
  StepReview: ({ lines }: { lines: MrWizardLine[] }) => (
    <div data-testid="step-review">items:{lines.length}</div>
  ),
}));
vi.mock('../components/NewMaterialModal', () => ({ NewMaterialModal: () => null }));
vi.mock('@forethread/ui-components', () => ({
  StatusErrorModal: ({ title }: { title: string }) => <div data-testid="error-modal">{title}</div>,
}));

import RequestMaterialsPage from './RequestMaterialsPage';

describe('RequestMaterialsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProjectDetail.mockReturnValue({
      data: {
        id: 'proj-1',
        name: 'JOB-2847',
        locations: [
          { id: 'loc-1', type: 'DELIVERY', address: '1 Main St', label: null, isDefault: true },
        ],
      },
    });
  });

  it('starts on step 1 (select materials) with Next disabled until a line is added', () => {
    render(<RequestMaterialsPage />);
    expect(screen.getByTestId('step-select')).toBeInTheDocument();
    expect(screen.getByTestId('progress').textContent).toBe('1');
    expect(screen.getByTestId('mr-step1-next')).toBeDisabled();
  });

  it('enables Next once a line is selected and advances to Material Details', () => {
    render(<RequestMaterialsPage />);
    fireEvent.click(screen.getByTestId('add-line'));
    expect(screen.getByTestId('mr-step1-next')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('mr-step1-next'));
    expect(screen.getByTestId('step-details')).toBeInTheDocument();
    expect(screen.getByTestId('progress').textContent).toBe('2');
  });

  it('blocks step 2 → 3 while line details are incomplete, then advances once filled', () => {
    render(<RequestMaterialsPage />);
    fireEvent.click(screen.getByTestId('add-line'));
    fireEvent.click(screen.getByTestId('mr-step1-next'));

    // Try to advance with an empty (quantity 0) line — should stay on details
    // and surface errors.
    fireEvent.click(screen.getByTestId('mr-step2-next'));
    expect(screen.getByTestId('step-details')).toBeInTheDocument();
    expect(screen.getByTestId('details-error-count').textContent).not.toBe('0');

    // Fill the line, then advance to review.
    fireEvent.click(screen.getByTestId('fill-line'));
    fireEvent.click(screen.getByTestId('mr-step2-next'));
    expect(screen.getByTestId('step-review')).toBeInTheDocument();
    expect(screen.getByTestId('progress').textContent).toBe('3');
  });

  it('submits the request and navigates to confirmation on success', () => {
    mockMutate.mockImplementation((_input, { onSuccess }) => onSuccess({ id: 'mr-99' }));
    render(<RequestMaterialsPage />);
    fireEvent.click(screen.getByTestId('add-line'));
    fireEvent.click(screen.getByTestId('mr-step1-next'));
    fireEvent.click(screen.getByTestId('fill-line'));
    fireEvent.click(screen.getByTestId('mr-step2-next'));

    fireEvent.click(screen.getByTestId('mr-submit'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const [payload] = mockMutate.mock.calls[0];
    expect(payload.projectId).toBe('proj-1');
    expect(payload.submit).toBe(true);
    expect(payload.lineItems).toHaveLength(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      '/material-requests/confirmation/mr-99',
      expect.objectContaining({ state: { mr: { id: 'mr-99' } } }),
    );
  });

  it('shows an error modal when submission fails', () => {
    mockMutate.mockImplementation((_input, { onError }) => onError());
    render(<RequestMaterialsPage />);
    fireEvent.click(screen.getByTestId('add-line'));
    fireEvent.click(screen.getByTestId('mr-step1-next'));
    fireEvent.click(screen.getByTestId('fill-line'));
    fireEvent.click(screen.getByTestId('mr-step2-next'));
    fireEvent.click(screen.getByTestId('mr-submit'));

    expect(screen.getByTestId('error-modal')).toBeInTheDocument();
  });

  it('Raise PO is rendered but disabled (stubbed pending approval)', () => {
    render(<RequestMaterialsPage />);
    fireEvent.click(screen.getByTestId('add-line'));
    fireEvent.click(screen.getByTestId('mr-step1-next'));
    fireEvent.click(screen.getByTestId('fill-line'));
    fireEvent.click(screen.getByTestId('mr-step2-next'));
    expect(screen.getByTestId('mr-raise-po')).toBeDisabled();
  });

  it('back from step 1 navigates to the job picker', () => {
    render(<RequestMaterialsPage />);
    fireEvent.click(screen.getByTestId('back'));
    expect(mockNavigate).toHaveBeenCalledWith('/material-requests/jobs');
  });
});
