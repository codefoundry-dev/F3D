import { QuoteResponseDetailPage } from '@forethread/rfq-shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The shared quote drill-in (packages/rfq-shared) has no test runner of its
// own, so its Quote Line Items tab is exercised from here, like the comparison
// table. Covers the catalogue image beside each line name (FOR-402).

const mockGetQuoteDetail = vi.hoisted(() => vi.fn());
const mockGetComparison = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getQuoteDetail: mockGetQuoteDetail,
  getRfqQuoteComparison: mockGetComparison,
  updateQuoteLineItemStatuses: vi.fn(),
  approveQuote: vi.fn(),
  awardQuote: vi.fn(),
  declineQuote: vi.fn(),
  createPurchaseOrder: vi.fn(),
  createBulkOrder: vi.fn(),
  awardSplit: vi.fn(),
  openFileInNewTab: vi.fn(),
  getRfqs: vi.fn(),
  getRfq: vi.fn(),
  getRfqEmailLog: vi.fn(),
  getRfqQuoteAudit: vi.fn(),
  getThreads: vi.fn().mockResolvedValue([]),
  getMessages: vi.fn().mockResolvedValue([]),
  createThread: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function line(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ql-1',
    rfqLineItemId: 'li-1',
    unitPrice: 10,
    quotedQuantity: 5,
    availability: 'AVAILABLE',
    deliveryDate: '2026-12-15T00:00:00.000Z',
    substituteItemId: null,
    substituteItem: null,
    rfqLineItem: {
      id: 'li-1',
      materialName: 'Rubber Hoses',
      quantity: 5,
      unit: 'm',
      material: { id: 'm-1', name: 'Rubber Hoses', uom: 'm', imageUrl: null },
    },
    discount: null,
    discountType: null,
    tax: null,
    lineTotal: 50,
    status: 'PENDING',
    notes: null,
    expectedDeliveryDate: null,
    deliveryVarianceDays: null,
    ...overrides,
  };
}

function quote(lineItems: unknown[]) {
  return {
    id: 'q-1',
    rfqId: 'rfq-1',
    vendorId: 'v-1',
    totalCost: 100,
    discountPercent: null,
    discountAmount: null,
    itemsCovered: lineItems.length,
    totalItems: lineItems.length,
    status: 'SUBMITTED',
    submittedAt: '2026-12-01T00:00:00.000Z',
    bulkDeliveryTime: null,
    bulkDiscount: null,
    bulkTax: null,
    bulkShipment: null,
    warehouseLocationId: null,
    validityPeriod: null,
    message: null,
    lineItems,
    attachments: [],
  };
}

function renderLineItemsTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QuoteResponseDetailPage
          rfqId="rfq-1"
          quoteId="q-1"
          vendorName="Vendor One"
          status="SUBMITTED"
          initialTab="lineItems"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetComparison.mockResolvedValue({ rfqId: 'rfq-1', currency: 'AUD', vendors: [], rows: [] });
});

describe('QuoteResponseDetailPage (shared) — line item images (FOR-402)', () => {
  it('shows the requested material image beside its name, and nothing for a line without one', async () => {
    mockGetQuoteDetail.mockResolvedValue(
      quote([
        line({
          rfqLineItem: {
            id: 'li-1',
            materialName: 'Rubber Hoses',
            quantity: 5,
            unit: 'm',
            material: {
              id: 'm-1',
              name: 'Rubber Hoses',
              uom: 'm',
              imageUrl: 'https://cdn.test/hoses.jpg',
            },
          },
        }),
        // Free-text line: no linked material at all.
        line({
          id: 'ql-2',
          rfqLineItemId: 'li-2',
          rfqLineItem: { id: 'li-2', materialName: 'Site sand', quantity: 2, unit: 't' },
        }),
        // Catalogue line whose material has no image.
        line({ id: 'ql-3', rfqLineItemId: 'li-3' }),
      ]),
    );
    renderLineItemsTab();

    const image = await screen.findByRole('img', { name: 'Rubber Hoses' });
    expect(image).toHaveAttribute('src', 'https://cdn.test/hoses.jpg');
    expect(screen.getByText('Site sand')).toBeInTheDocument();
    expect(screen.getAllByTestId('material-image-thumb')).toHaveLength(1);
  });

  it('uses the substitute image for the substitute name and the requested image for the struck original', async () => {
    mockGetQuoteDetail.mockResolvedValue(
      quote([
        line({
          substituteItemId: 'm-9',
          substituteItem: {
            id: 'm-9',
            name: 'Silicone Hoses',
            uom: 'm',
            imageUrl: 'https://cdn.test/silicone.jpg',
          },
          rfqLineItem: {
            id: 'li-1',
            materialName: 'Rubber Hoses',
            quantity: 5,
            unit: 'm',
            material: {
              id: 'm-1',
              name: 'Rubber Hoses',
              uom: 'm',
              imageUrl: 'https://cdn.test/hoses.jpg',
            },
          },
        }),
      ]),
    );
    renderLineItemsTab();

    const substituteRow = (await screen.findByText('Silicone Hoses')).closest('tr') as HTMLElement;
    expect(within(substituteRow).getByRole('img')).toHaveAttribute(
      'src',
      'https://cdn.test/silicone.jpg',
    );
    const originalRow = screen.getByText('Rubber Hoses').closest('tr') as HTMLElement;
    expect(within(originalRow).getByRole('img')).toHaveAttribute(
      'src',
      'https://cdn.test/hoses.jpg',
    );
  });

  it('shows no image for a substitute without one, even when the requested material has one', async () => {
    mockGetQuoteDetail.mockResolvedValue(
      quote([
        line({
          substituteItemId: 'm-9',
          substituteItem: { id: 'm-9', name: 'Silicone Hoses', uom: 'm', imageUrl: null },
          rfqLineItem: {
            id: 'li-1',
            materialName: 'Rubber Hoses',
            quantity: 5,
            unit: 'm',
            material: {
              id: 'm-1',
              name: 'Rubber Hoses',
              uom: 'm',
              imageUrl: 'https://cdn.test/hoses.jpg',
            },
          },
        }),
      ]),
    );
    renderLineItemsTab();

    const substituteRow = (await screen.findByText('Silicone Hoses')).closest('tr') as HTMLElement;
    expect(within(substituteRow).queryByRole('img')).not.toBeInTheDocument();
  });
});
