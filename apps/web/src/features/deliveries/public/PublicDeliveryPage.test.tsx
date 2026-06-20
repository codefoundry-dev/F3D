import type { DeliveryPortalPoResponse } from '@forethread/shared-types/client';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const mockIdentify = vi.hoisted(() => vi.fn());
const mockVerify = vi.hoisted(() => vi.fn());
const mockSubmit = vi.hoisted(() => vi.fn());
const mockFinalize = vi.hoisted(() => vi.fn());
const mockUploadLinePhoto = vi.hoisted(() => vi.fn());
const mockUploadAttachment = vi.hoisted(() => vi.fn());
const mockGetPo = vi.hoisted(() => vi.fn());
const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'tok-123' }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { queryFn: () => unknown }) => mockUseQuery(opts),
}));

vi.mock('@forethread/api-client', () => ({
  getDeliveryPortalPo: (...a: unknown[]) => mockGetPo(...a),
  identifyDeliveryPortal: (...a: unknown[]) => mockIdentify(...a),
  verifyDeliveryPortal: (...a: unknown[]) => mockVerify(...a),
  submitDeliveryPortal: (...a: unknown[]) => mockSubmit(...a),
  finalizeDeliveryPortal: (...a: unknown[]) => mockFinalize(...a),
  uploadDeliveryPortalLinePhoto: (...a: unknown[]) => mockUploadLinePhoto(...a),
  uploadDeliveryPortalAttachment: (...a: unknown[]) => mockUploadAttachment(...a),
  isApiError: (_e: unknown, status?: number) => status === 403,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    // Echo the key, interpolating {{count}} so summary assertions read naturally.
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && 'count' in vars ? `${key}:${String(vars.count)}` : key,
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, onClick, disabled, ...props }: Record<string, unknown>) => (
    <button onClick={onClick as () => void} disabled={disabled as boolean} {...stripBtn(props)}>
      {children as ReactNode}
    </button>
  ),
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Textarea: (props: Record<string, unknown>) => <textarea {...props} />,
  Alert: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>,
  Spinner: () => <div data-testid="spinner" />,
  cn: (...c: unknown[]) => c.filter(Boolean).join(' '),
  notificationService: { success: vi.fn(), error: vi.fn() },
}));

// PortalLineItem is exercised on its own via portalLines.test.ts; here it is a
// stub that exposes a button to flip a line to a given status so we can assert
// the submitted payload + summary react to it.
vi.mock('./PortalLineItem', () => ({
  PortalLineItem: ({
    line,
    onChange,
  }: {
    line: { id: string; materialName: string };
    onChange: (p: Record<string, unknown>) => void;
  }) => (
    <div data-testid={`line-${line.id}`}>
      <span>{line.materialName}</span>
      <button type="button" onClick={() => onChange({ status: 'REJECTED' })}>
        reject-{line.id}
      </button>
    </div>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/back-arrow.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock-icon.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-closed.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/file-text.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/paperclip.svg?react', () => ({
  default: () => <svg />,
}));

function stripBtn(props: Record<string, unknown>) {
  const { isLoading: _il, variant: _v, size: _s, leftIcon: _l, rightIcon: _r, ...rest } = props;
  return rest;
}

import PublicDeliveryPage from './PublicDeliveryPage';

function poResponse(overrides: Partial<DeliveryPortalPoResponse> = {}): DeliveryPortalPoResponse {
  return {
    poNumber: 'PO-2024-001',
    projectName: 'Downtown',
    vendorName: 'BuildSupply',
    deliveryLocationName: 'Yard A',
    deliveryDate: null,
    lines: [
      {
        id: 'li-1',
        lineItemRef: 'STL-6M-002',
        materialName: 'Steel Beams 6m',
        description: '12ft',
        uom: 'pcs',
        quantityOrdered: 10,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({
    data: poResponse(),
    isLoading: false,
    isError: false,
    error: null,
  });
  mockIdentify.mockResolvedValue({ ok: true });
  mockVerify.mockResolvedValue({ sessionToken: 'sess-abc' });
  mockSubmit.mockResolvedValue({ deliveryReportId: 'd-1', reportNumber: 'DR-1' });
  mockFinalize.mockResolvedValue({ deliveryReportId: 'd-1', reportNumber: 'DR-1' });
});

describe('PublicDeliveryPage', () => {
  it('renders the identify step first', () => {
    render(<PublicDeliveryPage />);
    expect(screen.getByText('portal.identify.title')).toBeInTheDocument();
    expect(screen.getByTestId('portal-identify-submit')).toBeInTheDocument();
  });

  it('validates name + email before sending the access code', async () => {
    render(<PublicDeliveryPage />);
    fireEvent.click(screen.getByTestId('portal-identify-submit'));
    // Invalid → identify not called, still on identify step.
    await waitFor(() =>
      expect(screen.getByText('portal.identify.nameRequired')).toBeInTheDocument(),
    );
    expect(mockIdentify).not.toHaveBeenCalled();
  });

  it('identify → code → form → submitted happy path', async () => {
    render(<PublicDeliveryPage />);

    // Step 1: identify
    fireEvent.change(screen.getByTestId('portal-identify-name'), {
      target: { value: 'Alex Johnson' },
    });
    fireEvent.change(screen.getByTestId('portal-identify-email'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.click(screen.getByTestId('portal-identify-submit'));

    await waitFor(() =>
      expect(mockIdentify).toHaveBeenCalledWith('tok-123', {
        name: 'Alex Johnson',
        email: 'alex@example.com',
      }),
    );

    // Step 2: enter the 6-digit code
    await screen.findByText('portal.code.title');
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByTestId(`portal-code-digit-${i}`), { target: { value: '1' } });
    }
    fireEvent.click(screen.getByTestId('portal-code-verify'));

    await waitFor(() =>
      expect(mockVerify).toHaveBeenCalledWith('tok-123', {
        email: 'alex@example.com',
        code: '111111',
      }),
    );

    // Step 3: report form — submit straight away (line defaults to delivered)
    await screen.findByTestId('portal-submit');
    expect(screen.getByText('Steel Beams 6m')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('portal-submit'));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(mockSubmit).toHaveBeenCalledWith(
      'sess-abc',
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            poLineItemId: 'li-1',
            quantityReceived: 10,
            outcome: 'DELIVERED',
          }),
        ],
      }),
    );
    await waitFor(() => expect(mockFinalize).toHaveBeenCalledWith('sess-abc'));

    // Step 4: submitted summary
    await screen.findByText('portal.submitted.title');
    expect(screen.getByTestId('portal-summary-delivered')).toHaveTextContent('1');
  });

  it('"Change email" returns to the identify step', async () => {
    render(<PublicDeliveryPage />);
    fireEvent.change(screen.getByTestId('portal-identify-name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByTestId('portal-identify-email'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.click(screen.getByTestId('portal-identify-submit'));

    await screen.findByText('portal.code.title');
    fireEvent.click(screen.getByTestId('portal-code-change-email'));
    expect(screen.getByText('portal.identify.title')).toBeInTheDocument();
  });

  it('shows an invalid-code error and stays on the code step when verify fails', async () => {
    mockVerify.mockRejectedValueOnce(new Error('bad'));
    render(<PublicDeliveryPage />);
    fireEvent.change(screen.getByTestId('portal-identify-name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByTestId('portal-identify-email'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.click(screen.getByTestId('portal-identify-submit'));

    await screen.findByText('portal.code.title');
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByTestId(`portal-code-digit-${i}`), { target: { value: '9' } });
    }
    fireEvent.click(screen.getByTestId('portal-code-verify'));

    await screen.findByText('portal.code.invalid');
    expect(screen.getByText('portal.code.title')).toBeInTheDocument();
  });

  it('reflects a per-line status change in the submitted payload + summary', async () => {
    render(<PublicDeliveryPage />);
    fireEvent.change(screen.getByTestId('portal-identify-name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByTestId('portal-identify-email'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.click(screen.getByTestId('portal-identify-submit'));

    await screen.findByText('portal.code.title');
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByTestId(`portal-code-digit-${i}`), { target: { value: '1' } });
    }
    fireEvent.click(screen.getByTestId('portal-code-verify'));

    await screen.findByTestId('portal-submit');
    // Flip the line to REJECTED via the stubbed child.
    fireEvent.click(screen.getByText('reject-li-1'));
    fireEvent.click(screen.getByTestId('portal-submit'));

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(mockSubmit).toHaveBeenCalledWith(
      'sess-abc',
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            poLineItemId: 'li-1',
            quantityReceived: 0,
            outcome: 'REJECTED',
          }),
        ],
      }),
    );
    await screen.findByText('portal.submitted.title');
    expect(screen.getByTestId('portal-summary-rejected')).toHaveTextContent('1');
  });

  it('"View PO" opens a read-only PO details sheet built from the loaded PO (no navigation)', async () => {
    render(<PublicDeliveryPage />);
    fireEvent.change(screen.getByTestId('portal-identify-name'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByTestId('portal-identify-email'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.click(screen.getByTestId('portal-identify-submit'));

    await screen.findByText('portal.code.title');
    for (let i = 0; i < 6; i++) {
      fireEvent.change(screen.getByTestId(`portal-code-digit-${i}`), { target: { value: '1' } });
    }
    fireEvent.click(screen.getByTestId('portal-code-verify'));

    await screen.findByTestId('portal-submit');
    // No sheet yet.
    expect(screen.queryByTestId('portal-po-details')).not.toBeInTheDocument();

    // Opening "View PO" reveals the already-loaded PO data inline — it must NOT
    // be an anchor to /po/:token (that route needs a PO_VIEW token, not the
    // DELIVERY_SUBMIT QR token, so it would 403).
    const viewPo = screen.getByTestId('portal-view-po');
    expect(viewPo.tagName).toBe('BUTTON');
    fireEvent.click(viewPo);

    const sheet = await screen.findByTestId('portal-po-details');
    expect(sheet).toHaveTextContent('PO-2024-001');
    expect(sheet).toHaveTextContent('Downtown');
    expect(sheet).toHaveTextContent('BuildSupply');

    // Closing dismisses it.
    fireEvent.click(screen.getByTestId('portal-po-details-close'));
    expect(screen.queryByTestId('portal-po-details')).not.toBeInTheDocument();
  });

  it('renders the expired-token error on a 403', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 403 } },
    });
    render(<PublicDeliveryPage />);
    expect(screen.getByText('portal.expiredToken')).toBeInTheDocument();
  });
});
