vi.mock('./RfqDetailPanel', () => ({ RfqDetailPanel: vi.fn() }));
vi.mock('./RfqDetailsTab', () => ({ RfqDetailsTab: vi.fn() }));
vi.mock('./RfqDocumentsTab', () => ({ RfqDocumentsTab: vi.fn() }));
vi.mock('./RfqLineItemsTab', () => ({ RfqLineItemsTab: vi.fn() }));

import { RfqDetailPanel, RfqDetailsTab, RfqDocumentsTab, RfqLineItemsTab } from './index';

describe('rfqs/components re-exports', () => {
  it('re-exports RfqDetailPanel', () => {
    expect(RfqDetailPanel).toBeDefined();
  });

  it('re-exports RfqDetailsTab', () => {
    expect(RfqDetailsTab).toBeDefined();
  });

  it('re-exports RfqDocumentsTab', () => {
    expect(RfqDocumentsTab).toBeDefined();
  });

  it('re-exports RfqLineItemsTab', () => {
    expect(RfqLineItemsTab).toBeDefined();
  });
});
