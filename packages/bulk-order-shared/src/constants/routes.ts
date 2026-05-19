export const BULK_ORDER_ROUTES = {
  bulkOrders: '/bulk-orders',
  bulkOrderDetail: '/bulk-orders/:id',
  bulkOrderDrawdown: '/bulk-orders/:id/drawdown',
  bulkOrderEdit: '/bulk-orders/:id/edit',
  bulkOrderChange: '/bulk-orders/:id/change',
  bulkOrderReviewChange: '/bulk-orders/:id/review-change',
} as const;
