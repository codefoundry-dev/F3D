import type { NotificationItem } from '@forethread/api-client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NotificationPanel } from './NotificationPanel';

const item = (over: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'n-1',
  type: 'PO_ISSUED',
  title: 'Purchase order received',
  body: 'You have received purchase order PO-1.',
  entityType: 'PURCHASE_ORDER',
  entityId: 'po-1',
  metadata: null,
  readAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

describe('NotificationPanel', () => {
  it('shows the loading state', () => {
    render(
      <NotificationPanel
        items={[]}
        isLoading
        unreadCount={0}
        onSelect={vi.fn()}
        onMarkAll={vi.fn()}
        markAllPending={false}
      />,
    );
    expect(screen.getByText(/loading notifications/i)).toBeInTheDocument();
  });

  it('shows the empty state when there are no notifications', () => {
    render(
      <NotificationPanel
        items={[]}
        isLoading={false}
        unreadCount={0}
        onSelect={vi.fn()}
        onMarkAll={vi.fn()}
        markAllPending={false}
      />,
    );
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('renders items and fires onSelect when a row is clicked', () => {
    const onSelect = vi.fn();
    render(
      <NotificationPanel
        items={[item(), item({ id: 'n-2', title: 'New quote received', readAt: null })]}
        isLoading={false}
        unreadCount={2}
        onSelect={onSelect}
        onMarkAll={vi.fn()}
        markAllPending={false}
      />,
    );

    expect(screen.getByText('Purchase order received')).toBeInTheDocument();
    fireEvent.click(screen.getByText('New quote received'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'n-2' }));
  });

  it('shows "mark all as read" only when there are unread items and wires it up', () => {
    const onMarkAll = vi.fn();
    const { rerender } = render(
      <NotificationPanel
        items={[item()]}
        isLoading={false}
        unreadCount={0}
        onSelect={vi.fn()}
        onMarkAll={onMarkAll}
        markAllPending={false}
      />,
    );
    expect(screen.queryByText(/mark all as read/i)).not.toBeInTheDocument();

    rerender(
      <NotificationPanel
        items={[item()]}
        isLoading={false}
        unreadCount={3}
        onSelect={vi.fn()}
        onMarkAll={onMarkAll}
        markAllPending={false}
      />,
    );
    fireEvent.click(screen.getByText(/mark all as read/i));
    expect(onMarkAll).toHaveBeenCalledTimes(1);
  });
});
