import type { MaterialListItemDto } from '@forethread/api-client';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PendingApprovalList } from './PendingApprovalList';

function material(over: Partial<MaterialListItemDto> = {}): MaterialListItemDto {
  return {
    id: 'm-1',
    name: 'Portland Cement',
    categoryId: null,
    categoryName: 'Cement',
    status: 'PENDING',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  } as MaterialListItemDto;
}

function renderList(items: MaterialListItemDto[]) {
  render(
    <PendingApprovalList
      items={items}
      isLoading={false}
      isError={false}
      permissions={{ canApprove: true, canReject: true }}
      onView={vi.fn()}
      onApprove={vi.fn()}
      onReject={vi.fn()}
    />,
  );
}

describe('PendingApprovalList', () => {
  it('shows the material image next to its name when it has one (FOR-402)', () => {
    renderList([
      material({ imageUrl: 'https://cdn.test/cement.png' }),
      material({ id: 'm-2', name: 'Loose Gravel', imageUrl: null }),
    ]);

    const image = within(screen.getByTestId('pending-card-m-1')).getByRole('img');
    expect(image).toHaveAttribute('src', 'https://cdn.test/cement.png');
    expect(image).toHaveAttribute('alt', 'Portland Cement');

    const withoutImage = screen.getByTestId('pending-card-m-2');
    expect(within(withoutImage).queryByRole('img')).not.toBeInTheDocument();
    expect(within(withoutImage).getByText('Loose Gravel')).toBeInTheDocument();
  });

  it('renders the empty state with no pending materials', () => {
    renderList([]);
    expect(screen.getByTestId('pending-empty')).toBeInTheDocument();
  });
});
