import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── PO/CA Dashboard ──────────────────────────────────────────────────────────

export class KpiCountDto {
  @ApiProperty()
  pending!: number;

  @ApiProperty()
  overdue!: number;
}

export class KpiSummaryDto {
  @ApiProperty({ type: KpiCountDto })
  rfqs!: KpiCountDto;

  @ApiProperty({ type: KpiCountDto })
  pos!: KpiCountDto;

  @ApiProperty({ type: KpiCountDto })
  quotes!: KpiCountDto;

  @ApiProperty({ type: KpiCountDto })
  invoices!: KpiCountDto;
}

export class QuoteResponseItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  vendorName!: string;

  @ApiPropertyOptional()
  vendorCountry!: string | null;

  @ApiProperty()
  rfqId!: string;

  @ApiProperty()
  projectName!: string;

  @ApiPropertyOptional()
  dateRange!: string | null;

  @ApiProperty()
  totalCost!: number;

  @ApiPropertyOptional()
  discountPercent!: number | null;

  @ApiPropertyOptional()
  discountAmount!: number | null;

  @ApiProperty()
  itemsCovered!: number;

  @ApiProperty()
  totalItems!: number;

  @ApiProperty()
  status!: string;
}

export class RecentOrderItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: 'rfq' | 'po' | 'bulk-order';

  @ApiProperty()
  status!: string;

  @ApiProperty()
  projectName!: string;

  @ApiPropertyOptional()
  vendorName!: string | null;

  @ApiPropertyOptional()
  location!: string | null;

  @ApiPropertyOptional()
  dateRange!: string | null;

  @ApiProperty()
  itemCount!: number;

  @ApiPropertyOptional()
  totalCost!: number | null;

  @ApiPropertyOptional()
  remainingPercent!: number | null;
}

export class PendingPoItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  vendorName!: string;

  @ApiPropertyOptional()
  vendorCountry!: string | null;

  @ApiProperty()
  poNumber!: string;

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  date!: string;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty()
  deliveryType!: string;

  @ApiPropertyOptional()
  totalCost!: number | null;

  @ApiProperty()
  status!: string;
}

export class InvoicePendingItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  vendorName!: string;

  @ApiPropertyOptional()
  vendorCountry!: string | null;

  @ApiProperty()
  invoiceId!: string;

  @ApiProperty()
  projectName!: string;

  @ApiPropertyOptional()
  poReference!: string | null;

  @ApiProperty()
  date!: string;

  @ApiPropertyOptional()
  totalCost!: number | null;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty()
  status!: string;
}

export class PoCaDashboardDto {
  @ApiProperty({ type: KpiSummaryDto })
  kpiSummary!: KpiSummaryDto;

  @ApiProperty({ type: [QuoteResponseItemDto] })
  quoteResponses!: QuoteResponseItemDto[];

  @ApiProperty({ type: [RecentOrderItemDto] })
  recentOrders!: RecentOrderItemDto[];

  @ApiProperty({ type: [PendingPoItemDto] })
  pendingPurchaseOrders!: PendingPoItemDto[];

  @ApiProperty({ type: [InvoicePendingItemDto] })
  invoicesPendingApproval!: InvoicePendingItemDto[];
}

// ── Vendor Dashboard ─────────────────────────────────────────────────────────

export class VendorRfqItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyName!: string;

  @ApiPropertyOptional()
  companyCountry!: string | null;

  @ApiProperty()
  rfqId!: string;

  @ApiProperty()
  projectName!: string;

  @ApiPropertyOptional()
  dateRange!: string | null;

  @ApiPropertyOptional()
  totalCost!: number | null;

  @ApiProperty()
  itemCount!: number;

  @ApiPropertyOptional()
  deliveryLocation!: string | null;
}

export class VendorInvoiceItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyName!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  companyCountry!: string | null;

  @ApiProperty()
  invoiceId!: string;

  @ApiProperty()
  projectName!: string;

  @ApiPropertyOptional()
  poReference!: string | null;

  @ApiProperty()
  date!: string;

  @ApiPropertyOptional()
  totalCost!: number | null;

  @ApiProperty()
  itemCount!: number;
}

export class VendorActivePoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  poNumber!: string;

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  contractorName!: string;

  @ApiProperty()
  poStatus!: string;

  @ApiProperty()
  revision!: number;

  @ApiProperty()
  poType!: string;

  @ApiProperty()
  pickUp!: boolean;
}

export class VendorDashboardDto {
  @ApiProperty({ type: [VendorRfqItemDto] })
  rfqsWaiting!: VendorRfqItemDto[];

  @ApiProperty({ type: [VendorInvoiceItemDto] })
  invoices!: VendorInvoiceItemDto[];

  @ApiProperty({ type: [VendorActivePoDto] })
  activePOs!: VendorActivePoDto[];
}

// ── Finance Officer Dashboard ────────────────────────────────────────────────

export class FinanceDashboardDto {
  @ApiProperty()
  totalPendingAmount!: number;

  @ApiProperty()
  pendingInvoiceCount!: number;

  @ApiProperty()
  invoicesDueThisWeek!: number;

  @ApiProperty()
  invoicesDueAmount!: number;

  @ApiProperty()
  disputedInvoiceCount!: number;

  @ApiProperty()
  disputedTrend!: number;

  @ApiProperty({ type: [InvoicePendingItemDto] })
  invoicesPendingApproval!: InvoicePendingItemDto[];

  @ApiProperty({ type: [InvoicePendingItemDto] })
  disputedInvoices!: InvoicePendingItemDto[];
}
