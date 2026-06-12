import type { MaterialChangeRequestDto } from '@forethread/api-client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PendingChangeRequestCard } from './PendingChangeRequestCard';

function buildRequest(over: Partial<MaterialChangeRequestDto> = {}): MaterialChangeRequestDto {
  return {
    id: 'cr-1',
    materialId: 'm-1',
    materialName: 'Portland Cement Type I',
    status: 'PENDING',
    changes: {
      manufacturer: { from: 'LafargeHolcim', to: 'Cemex' },
      uom: { from: 'bag', to: 'pallet' },
    },
    reason: 'Supplier switched manufacturer',
    requestedBy: { id: 'u-1', name: 'Dana Lee' },
    resolvedBy: null,
    resolvedAt: null,
    createdAt: '2026-06-12T09:00:00.000Z',
    ...over,
  };
}

const allPerms = { canApprove: true, canReject: true };

describe('PendingChangeRequestCard', () => {
  it('renders the material name, requester, and a before→after diff row', () => {
    render(
      <PendingChangeRequestCard
        request={buildRequest()}
        permissions={allPerms}
        isApproving={false}
        isRejecting={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('Portland Cement Type I')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText(/Dana Lee/)).toBeInTheDocument();

    const diff = screen.getByTestId('change-request-diff-cr-1');
    // Field labels are humanized, before/after values are present.
    expect(diff).toHaveTextContent('Manufacturer');
    expect(diff).toHaveTextContent('LafargeHolcim');
    expect(diff).toHaveTextContent('Cemex');
    expect(diff).toHaveTextContent('pallet');
    // The reason line renders.
    expect(screen.getByText(/Supplier switched manufacturer/)).toBeInTheDocument();
  });

  it('fires onApprove / onReject with the request id', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <PendingChangeRequestCard
        request={buildRequest()}
        permissions={allPerms}
        isApproving={false}
        isRejecting={false}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    fireEvent.click(screen.getByTestId('change-request-approve-cr-1'));
    expect(onApprove).toHaveBeenCalledWith('cr-1');

    fireEvent.click(screen.getByTestId('change-request-reject-cr-1'));
    expect(onReject).toHaveBeenCalledWith('cr-1');
  });

  it('hides the approve/reject buttons when the permissions are absent', () => {
    render(
      <PendingChangeRequestCard
        request={buildRequest()}
        permissions={{ canApprove: false, canReject: false }}
        isApproving={false}
        isRejecting={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('change-request-approve-cr-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('change-request-reject-cr-1')).not.toBeInTheDocument();
  });
});
