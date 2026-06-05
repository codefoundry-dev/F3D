/**
 * Centralized TanStack Query key factory.
 * Use these instead of inline string arrays to prevent typos and ensure
 * consistent cache invalidation across the app.
 */
export const queryKeys = {
  purchaseOrders: {
    all: () => ['purchase-orders'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.purchaseOrders.all(), 'list', params] as const,
    detail: (id: string) => [...queryKeys.purchaseOrders.all(), id] as const,
  },
  rfqs: {
    all: () => ['rfqs'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.rfqs.all(), 'list', params] as const,
    detail: (id: string) => [...queryKeys.rfqs.all(), id] as const,
    selectForPo: () => [...queryKeys.rfqs.all(), 'select-for-po'] as const,
    coverage: (vendorId?: string, materialName?: string) =>
      [...queryKeys.rfqs.all(), 'coverage', vendorId, materialName] as const,
  },
  bulkOrders: {
    all: () => ['bulk-orders'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.bulkOrders.all(), 'list', params] as const,
    detail: (id: string) => [...queryKeys.bulkOrders.all(), id] as const,
    selectForPo: () => [...queryKeys.bulkOrders.all(), 'select-for-po'] as const,
    coverage: (vendorId?: string) => [...queryKeys.bulkOrders.all(), 'coverage', vendorId] as const,
  },
  dashboard: {
    poCa: () => ['dashboard', 'po-ca'] as const,
    vendor: () => ['dashboard', 'vendor'] as const,
    finance: () => ['dashboard', 'finance'] as const,
    superAdmin: () => ['dashboard', 'super-admin'] as const,
    adminPanel: () => ['dashboard', 'admin-panel'] as const,
    warehouse: () => ['dashboard', 'warehouse'] as const,
  },
  projects: {
    all: () => ['projects'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.projects.all(), 'list', params] as const,
    detail: (id: string) => [...queryKeys.projects.all(), id] as const,
  },
  users: {
    all: () => ['users'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.users.all(), 'list', params] as const,
    detail: (id: string) => [...queryKeys.users.all(), id] as const,
    me: () => [...queryKeys.users.all(), 'me'] as const,
  },
  invoices: {
    all: () => ['invoices'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.invoices.all(), 'list', params] as const,
    detail: (id: string) => [...queryKeys.invoices.all(), id] as const,
  },
  companies: {
    all: () => ['companies'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.companies.all(), 'list', params] as const,
    detail: (id: string) => [...queryKeys.companies.all(), id] as const,
    vendors: (id: string) => [...queryKeys.companies.all(), id, 'vendors'] as const,
  },
  vendors: {
    all: () => ['vendors'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.vendors.all(), 'list', params] as const,
  },
  materials: {
    all: () => ['materials'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.materials.all(), 'list', params] as const,
    suggestions: (query: string) => [...queryKeys.materials.all(), 'suggestions', query] as const,
  },
  docExtractions: {
    all: () => ['doc-extractions'] as const,
    list: (params?: Record<string, unknown>) =>
      [...queryKeys.docExtractions.all(), 'list', params] as const,
    detail: (id: string) => [...queryKeys.docExtractions.all(), id] as const,
  },
} as const;
