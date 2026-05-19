import { Injectable } from '@nestjs/common';
import {
  CompanyStatus,
  CompanyType,
  InvoiceStatus,
  PoStatus,
  ProjectStatus,
  QuoteResponseStatus,
  RfqStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── PO/CA Dashboard ────────────────────────────────────────────────────────

  async getPoCaDashboard(user: AuthenticatedUser) {
    const companyId = user.companyId;

    // Quote responses (limit 5) — recent quote responses for company RFQs
    const quoteResponses = await this.prisma.quoteResponse.findMany({
      where: {
        rfq: { companyId: companyId ?? undefined },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { legalName: true, legalAddress: true } },
        rfq: {
          select: {
            id: true,
            rfqNumber: true,
            deadlineStart: true,
            deadlineEnd: true,
            project: { select: { name: true } },
            _count: { select: { lineItems: true } },
          },
        },
      },
    });

    // Recent orders (last 5 created RFQs, POs, or BulkOrders)
    const [recentRfqs, recentPos, recentBulkOrders] = await Promise.all([
      this.prisma.rfq.findMany({
        where: { companyId: companyId ?? undefined },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { name: true } },
          deliveryLocation: { select: { label: true, address: true } },
          _count: { select: { lineItems: true } },
        },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { companyId: companyId ?? undefined },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { name: true } },
          vendor: { select: { legalName: true } },
          deliveryLocation: { select: { label: true, address: true } },
        },
      }),
      this.prisma.bulkOrder.findMany({
        where: { companyId: companyId ?? undefined },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { name: true } },
          vendor: { select: { legalName: true } },
          _count: { select: { lineItems: true } },
        },
      }),
    ]);

    // Merge and sort by createdAt, take 5
    const allOrders = [
      ...recentRfqs.map((r) => ({
        id: r.id,
        type: 'rfq' as const,
        status: r.status,
        projectName: r.project.name,
        vendorName: null,
        location: r.deliveryLocation?.label ?? r.deliveryLocation?.address ?? null,
        dateRange:
          r.deadlineStart && r.deadlineEnd
            ? `${r.deadlineStart.toISOString().split('T')[0]} - ${r.deadlineEnd.toISOString().split('T')[0]}`
            : null,
        itemCount: r._count.lineItems,
        totalCost: null,
        remainingPercent: null,
        hasMessages: false, // TODO: compute from real messaging data when available
        createdAt: r.createdAt,
      })),
      ...recentPos.map((p) => ({
        id: p.id,
        type: 'po' as const,
        status: p.status,
        projectName: p.project.name,
        vendorName: p.vendor?.legalName ?? null,
        location: p.deliveryLocation?.label ?? p.deliveryLocation?.address ?? null,
        dateRange:
          p.deadlineStart && p.deadlineEnd
            ? `${p.deadlineStart.toISOString().split('T')[0]} - ${p.deadlineEnd.toISOString().split('T')[0]}`
            : null,
        itemCount: p.lineItemCount,
        totalCost: p.totalAmount ? Number(p.totalAmount) : null,
        remainingPercent: null,
        hasMessages: false, // TODO: compute from real messaging data when available
        createdAt: p.createdAt,
      })),
      ...recentBulkOrders.map((b) => ({
        id: b.id,
        type: 'bulk-order' as const,
        status: b.status,
        projectName: b.project.name,
        vendorName: b.vendor.legalName,
        location: null,
        dateRange: null,
        itemCount: b._count.lineItems,
        totalCost: b.totalAmount ? Number(b.totalAmount) : null,
        remainingPercent: null,
        hasMessages: false, // TODO: compute from real messaging data when available
        createdAt: b.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    // Pending POs (limit 5)
    const pendingPos = await this.prisma.purchaseOrder.findMany({
      where: {
        companyId: companyId ?? undefined,
        status: { in: [PoStatus.DRAFT, PoStatus.SENT] },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true, legalAddress: true } },
      },
    });

    // Invoices pending approval (limit 5)
    const pendingInvoices = await this.prisma.invoice.findMany({
      where: {
        companyId: companyId ?? undefined,
        status: InvoiceStatus.PENDING,
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true, legalAddress: true } },
        relatedPo: { select: { id: true, poNumber: true, lineItemCount: true } },
      },
    });

    // Project suggestions — recent active projects for quick action shortcuts
    const projectSuggestions = await this.prisma.project.findMany({
      where: {
        companyId: companyId ?? undefined,
        status: { in: [ProjectStatus.PLANNED, ProjectStatus.ONGOING] },
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    });

    // KPI summary counts
    const [rfqCounts, poCounts, quoteCounts, invoiceCounts] = await Promise.all([
      // RFQs: pending + overdue
      Promise.all([
        this.prisma.rfq.count({
          where: {
            companyId: companyId ?? undefined,
            status: { in: [RfqStatus.OPEN, RfqStatus.AWAITING_RESPONSE] },
          },
        }),
        this.prisma.rfq.count({
          where: {
            companyId: companyId ?? undefined,
            status: { in: [RfqStatus.OPEN, RfqStatus.AWAITING_RESPONSE] },
            deadlineEnd: { lt: new Date() },
          },
        }),
      ]),
      // POs: pending + overdue
      Promise.all([
        this.prisma.purchaseOrder.count({
          where: {
            companyId: companyId ?? undefined,
            status: { in: [PoStatus.DRAFT, PoStatus.SENT] },
          },
        }),
        this.prisma.purchaseOrder.count({
          where: {
            companyId: companyId ?? undefined,
            status: { in: [PoStatus.DRAFT, PoStatus.SENT] },
            deadlineEnd: { lt: new Date() },
          },
        }),
      ]),
      // Quotes: pending + overdue
      Promise.all([
        this.prisma.quoteResponse.count({
          where: {
            rfq: { companyId: companyId ?? undefined },
            status: QuoteResponseStatus.PENDING,
          },
        }),
        this.prisma.quoteResponse.count({
          where: {
            rfq: {
              companyId: companyId ?? undefined,
              deadlineEnd: { lt: new Date() },
            },
            status: QuoteResponseStatus.PENDING,
          },
        }),
      ]),
      // Invoices: pending + overdue
      Promise.all([
        this.prisma.invoice.count({
          where: { companyId: companyId ?? undefined, status: InvoiceStatus.PENDING },
        }),
        this.prisma.invoice.count({
          where: {
            companyId: companyId ?? undefined,
            status: InvoiceStatus.PENDING,
            dueDate: { lt: new Date() },
          },
        }),
      ]),
    ]);

    return {
      kpiSummary: {
        rfqs: { pending: rfqCounts[0], overdue: rfqCounts[1] },
        pos: { pending: poCounts[0], overdue: poCounts[1] },
        quotes: { pending: quoteCounts[0], overdue: quoteCounts[1] },
        invoices: { pending: invoiceCounts[0], overdue: invoiceCounts[1] },
      },
      quoteResponses: quoteResponses.map((qr) => ({
        id: qr.id,
        vendorName: qr.vendor.legalName,
        vendorCountry: qr.vendor.legalAddress,
        rfqId: qr.rfq.id,
        rfqNumber: qr.rfq.rfqNumber ?? qr.rfq.id.slice(0, 8).toUpperCase(),
        projectName: qr.rfq.project.name,
        dateRange:
          qr.rfq.deadlineStart && qr.rfq.deadlineEnd
            ? `${qr.rfq.deadlineStart.toISOString().split('T')[0]} - ${qr.rfq.deadlineEnd.toISOString().split('T')[0]}`
            : null,
        totalCost: Number(qr.totalCost),
        discountPercent: qr.discountPercent ? Number(qr.discountPercent) : null,
        discountAmount: qr.discountAmount ? Number(qr.discountAmount) : null,
        itemsCovered: qr.itemsCovered,
        totalItems: qr.totalItems,
        status: qr.status,
      })),
      recentOrders: allOrders.map(({ createdAt: _createdAt, ...order }) => order),
      pendingPurchaseOrders: pendingPos.map((po) => ({
        id: po.id,
        vendorName: po.vendor?.legalName ?? null,
        vendorCountry: po.vendor?.legalAddress ?? null,
        poNumber: po.poNumber,
        projectName: po.project.name,
        date: po.createdAt.toISOString(),
        itemCount: po.lineItemCount,
        deliveryType: po.pickUp ? 'Pick Up' : 'Delivery',
        totalCost: po.totalAmount ? Number(po.totalAmount) : null,
        status: po.status,
      })),
      projectSuggestions: projectSuggestions.map((p) => ({ id: p.id, name: p.name })),
      invoicesPendingApproval: pendingInvoices.map((inv, idx) => {
        const year = inv.createdAt.getFullYear();
        const seq = String(idx + 1).padStart(4, '0');
        return {
          id: inv.id,
          vendorName: inv.vendor.legalName,
          vendorCountry: inv.vendor.legalAddress,
          invoiceId: `INV-${year}-${seq}`,
          projectName: inv.project.name,
          poReference: inv.relatedPo?.poNumber ?? null,
          date: inv.createdAt.toISOString(),
          totalCost: Number(inv.totalAmount),
          itemCount: inv.relatedPo?.lineItemCount ?? 0,
          status: inv.status,
        };
      }),
    };
  }

  // ── Vendor Dashboard ───────────────────────────────────────────────────────

  async getVendorDashboard(user: AuthenticatedUser) {
    const companyId = user.companyId;

    // RFQs awaiting vendor quote
    const rfqsWaiting = await this.prisma.rfq.findMany({
      where: {
        status: { in: [RfqStatus.OPEN, RfqStatus.AWAITING_RESPONSE] },
        invitedVendors: { some: { vendorId: companyId ?? undefined } },
        quoteResponses: {
          none: { vendorId: companyId ?? undefined },
        },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { legalName: true, legalAddress: true } },
        project: { select: { name: true } },
        _count: { select: { lineItems: true } },
      },
    });

    // Vendor invoices
    const vendorInvoices = await this.prisma.invoice.findMany({
      where: { vendorId: companyId ?? undefined },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { legalName: true, legalAddress: true } },
        project: { select: { name: true } },
        relatedPo: { select: { id: true, poNumber: true, lineItemCount: true } },
      },
    });

    // Active POs for vendor
    const activePOs = await this.prisma.purchaseOrder.findMany({
      where: {
        vendorId: companyId ?? undefined,
        status: { notIn: [PoStatus.CLOSED, PoStatus.CANCELLED] },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        company: { select: { legalName: true } },
      },
    });

    return {
      rfqsWaiting: rfqsWaiting.map((rfq) => ({
        id: rfq.id,
        companyName: rfq.company.legalName,
        companyCountry: rfq.company.legalAddress,
        rfqId: (rfq as Record<string, unknown>).rfqNumber ?? rfq.id,
        projectName: rfq.project.name,
        dateRange:
          rfq.deadlineStart && rfq.deadlineEnd
            ? `${rfq.deadlineStart.toISOString().split('T')[0]} - ${rfq.deadlineEnd.toISOString().split('T')[0]}`
            : null,
        totalCost: null,
        itemCount: rfq._count.lineItems,
        deliveryLocationId: null, // TODO: include deliveryLocation relation when needed
      })),
      invoices: vendorInvoices.map((inv, idx) => {
        const year = inv.createdAt.getFullYear();
        const seq = String(idx + 1).padStart(4, '0');
        return {
          id: inv.id,
          companyName: inv.company.legalName,
          status: inv.status,
          companyCountry: inv.company.legalAddress,
          invoiceId: `INV-${year}-${seq}`,
          projectName: inv.project.name,
          poReference: inv.relatedPo?.poNumber ?? null,
          date: inv.createdAt.toISOString(),
          totalCost: Number(inv.totalAmount),
          itemCount: inv.relatedPo?.lineItemCount ?? 0,
        };
      }),
      activePOs: activePOs.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        projectName: po.project.name,
        projectId: po.project.id,
        contractorName: po.company.legalName,
        poStatus: po.status,
        revision: po.revision,
        poType: po.poType,
        pickUp: po.pickUp,
      })),
    };
  }

  // ── Finance Dashboard ──────────────────────────────────────────────────────

  async getFinanceDashboard(user: AuthenticatedUser) {
    const companyId = user.companyId;
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const companyFilter = companyId ? { companyId } : {};

    // KPI metrics
    const [pendingInvoices, dueThisWeek, disputedNow, disputedLastMonth] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { ...companyFilter, status: InvoiceStatus.PENDING },
        select: { totalAmount: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          ...companyFilter,
          status: InvoiceStatus.PENDING,
          dueDate: { gte: now, lte: weekFromNow },
        },
        select: { totalAmount: true },
      }),
      this.prisma.invoice.count({
        where: { ...companyFilter, status: InvoiceStatus.DISPUTED },
      }),
      this.prisma.invoice.count({
        where: {
          ...companyFilter,
          status: InvoiceStatus.DISPUTED,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const totalPendingAmount = pendingInvoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    );
    const invoicesDueAmount = dueThisWeek.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

    // Invoices pending approval (limit 10)
    const invoicesPending = await this.prisma.invoice.findMany({
      where: { ...companyFilter, status: InvoiceStatus.PENDING },
      take: 10,
      orderBy: { dueDate: 'asc' },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true, legalAddress: true } },
        relatedPo: { select: { id: true, poNumber: true, lineItemCount: true } },
      },
    });

    // Disputed invoices (limit 10)
    const disputedInvoices = await this.prisma.invoice.findMany({
      where: { ...companyFilter, status: InvoiceStatus.DISPUTED },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true, legalAddress: true } },
        relatedPo: { select: { id: true, poNumber: true, lineItemCount: true } },
      },
    });

    const mapInvoice = (inv: (typeof invoicesPending)[number], idx: number) => {
      const year = inv.createdAt.getFullYear();
      const seq = String(idx + 1).padStart(3, '0');
      return {
        id: inv.id,
        vendorName: inv.vendor.legalName,
        vendorCountry: inv.vendor.legalAddress,
        invoiceId: `INV-${year}-${seq}`,
        projectName: inv.project.name,
        poReference: inv.relatedPo?.poNumber ?? null,
        date: inv.createdAt.toISOString(),
        totalCost: Number(inv.totalAmount),
        itemCount: inv.relatedPo?.lineItemCount ?? 0,
        status: inv.status,
        hasAttachments: !!inv.relatedPo,
        hasUnreadMessages: false,
      };
    };

    return {
      totalPendingAmount,
      pendingInvoiceCount: pendingInvoices.length,
      invoicesDueThisWeek: dueThisWeek.length,
      invoicesDueAmount,
      disputedInvoiceCount: disputedNow,
      disputedTrend: disputedLastMonth,
      invoicesPendingApproval: invoicesPending.map((inv, idx) => mapInvoice(inv, idx)),
      disputedInvoices: disputedInvoices.map((inv, idx) => mapInvoice(inv, idx)),
    };
  }

  // ── Super Admin Dashboard ─────────────────────────────────────────────────

  async getSuperAdminDashboard() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersThisWeek,
      totalCompanies,
      contractorCount,
      vendorCount,
      newCompaniesThisWeek,
      projectsByStatus,
      totalRfqs,
      openRfqs,
      totalPos,
      totalInvoices,
      pendingInvoices,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.company.count(),
      this.prisma.company.count({ where: { type: CompanyType.CONTRACTOR } }),
      this.prisma.company.count({ where: { type: CompanyType.VENDOR } }),
      this.prisma.company.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      Promise.all(
        Object.values(ProjectStatus).map((status) =>
          this.prisma.project.count({ where: { status } }),
        ),
      ),
      this.prisma.rfq.count(),
      this.prisma.rfq.count({
        where: { status: { in: [RfqStatus.OPEN, RfqStatus.AWAITING_RESPONSE] } },
      }),
      this.prisma.purchaseOrder.count(),
      this.prisma.invoice.count(),
      this.prisma.invoice.count({ where: { status: InvoiceStatus.PENDING } }),
    ]);

    // Measure actual DB response time with a simple query
    const dbPingStart = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbResponseMs = Date.now() - dbPingStart;

    // Users by role
    const usersByRole = await Promise.all(
      Object.values(UserRole).map(async (role) => ({
        role,
        count: await this.prisma.user.count({ where: { role } }),
      })),
    );

    // Companies by status
    const activeCompanies = await this.prisma.company.count({
      where: { status: CompanyStatus.ACTIVE },
    });

    // Project status breakdown
    const projectStatusMap = Object.fromEntries(
      Object.values(ProjectStatus).map((status, i) => [status, projectsByStatus[i]]),
    );

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisWeek: newUsersThisWeek,
        byRole: usersByRole,
      },
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        contractors: contractorCount,
        vendors: vendorCount,
        newThisWeek: newCompaniesThisWeek,
      },
      projects: {
        total: Object.values(projectStatusMap).reduce((a, b) => a + b, 0),
        byStatus: projectStatusMap,
      },
      procurement: {
        totalRfqs,
        openRfqs,
        totalPos,
        totalInvoices,
        pendingInvoices,
      },
      system: {
        dbResponseMs,
        status: dbResponseMs < 500 ? 'healthy' : 'degraded',
      },
    };
  }

  // ── Admin Panel — Platform State ────────────────────────────────────────

  async getAdminPanelState() {
    const components: {
      id: string;
      name: string;
      status: 'Healthy' | 'Error' | 'Warning' | 'Disabled';
      category: 'integration' | 'backgroundJob' | 'notification';
      lastSuccessfulRun: string | null;
      lastError: string | null;
      errorInfo: string | null;
    }[] = [];

    // 1. Database connectivity
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const dbMs = Date.now() - dbStart;
      components.push({
        id: 'db-primary',
        name: 'Database (PostgreSQL)',
        status: dbMs < 500 ? 'Healthy' : 'Warning',
        category: 'integration',
        lastSuccessfulRun: new Date().toISOString(),
        lastError: dbMs >= 500 ? new Date().toISOString() : null,
        errorInfo: dbMs >= 500 ? `Slow response: ${dbMs}ms` : null,
      });
    } catch (err) {
      components.push({
        id: 'db-primary',
        name: 'Database (PostgreSQL)',
        status: 'Error',
        category: 'integration',
        lastSuccessfulRun: null,
        lastError: new Date().toISOString(),
        errorInfo: err instanceof Error ? err.message : 'Connection failed',
      });
    }

    // 2. Email/Notification service — check config presence
    const emailConfigured = !!(
      process.env.BREVO_API_KEY ??
      process.env.SMTP_HOST ??
      process.env.MAILER_HOST
    );
    components.push({
      id: 'email-service',
      name: 'Email Service',
      status: emailConfigured ? 'Healthy' : 'Warning',
      category: 'notification',
      lastSuccessfulRun: emailConfigured ? new Date().toISOString() : null,
      lastError: emailConfigured ? null : new Date().toISOString(),
      errorInfo: emailConfigured
        ? null
        : 'Email service not configured (no SMTP/Brevo credentials)',
    });

    // 3. File storage (MinIO) — check config presence
    const minioConfigured = !!(process.env.MINIO_ENDPOINT ?? process.env.S3_ENDPOINT);
    components.push({
      id: 'file-storage',
      name: 'File Storage (MinIO)',
      status: minioConfigured ? 'Healthy' : 'Warning',
      category: 'integration',
      lastSuccessfulRun: minioConfigured ? new Date().toISOString() : null,
      lastError: minioConfigured ? null : new Date().toISOString(),
      errorInfo: minioConfigured ? null : 'Storage endpoint not configured',
    });

    // 4. Google Places API — check config presence
    const googleConfigured = !!process.env.GOOGLE_PLACES_API_KEY;
    components.push({
      id: 'google-places',
      name: 'Google Places API',
      status: googleConfigured ? 'Healthy' : 'Warning',
      category: 'integration',
      lastSuccessfulRun: googleConfigured ? new Date().toISOString() : null,
      lastError: googleConfigured ? null : new Date().toISOString(),
      errorInfo: googleConfigured ? null : 'API key not configured',
    });

    // 5. OCR Processing — placeholder (not yet implemented)
    components.push({
      id: 'ocr-processing',
      name: 'OCR Processing',
      status: 'Disabled',
      category: 'backgroundJob',
      lastSuccessfulRun: null,
      lastError: null,
      errorInfo: 'Not yet implemented',
    });

    // 6. In-app notifications — check recent audit log activity as proxy
    try {
      const recentAudit = await this.prisma.auditLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      components.push({
        id: 'in-app-notifications',
        name: 'In-App Notifications',
        status: 'Healthy',
        category: 'notification',
        lastSuccessfulRun: recentAudit?.createdAt?.toISOString() ?? null,
        lastError: null,
        errorInfo: null,
      });
    } catch {
      components.push({
        id: 'in-app-notifications',
        name: 'In-App Notifications',
        status: 'Error',
        category: 'notification',
        lastSuccessfulRun: null,
        lastError: new Date().toISOString(),
        errorInfo: 'Failed to query audit log',
      });
    }

    // 7. ERP Integration — placeholder (not yet implemented)
    components.push({
      id: 'erp-integration',
      name: 'ERP Integration',
      status: 'Disabled',
      category: 'integration',
      lastSuccessfulRun: null,
      lastError: null,
      errorInfo: 'Not yet implemented',
    });

    // 8. Accounting Integration — placeholder (not yet implemented)
    components.push({
      id: 'accounting-integration',
      name: 'Accounting Integration',
      status: 'Disabled',
      category: 'integration',
      lastSuccessfulRun: null,
      lastError: null,
      errorInfo: 'Not yet implemented',
    });

    return { components };
  }

  // ── Warehouse Officer Dashboard ───────────────────────────────────────────

  async getWarehouseDashboard(user: AuthenticatedUser) {
    const companyId = user.companyId;
    const companyFilter = companyId ? { companyId } : {};

    // POs pending delivery for this company
    const pendingDeliveries = await this.prisma.purchaseOrder.findMany({
      where: {
        ...companyFilter,
        status: PoStatus.SCHEDULED_FOR_DELIVERY,
      },
      take: 10,
      orderBy: { deadlineEnd: 'asc' },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
        createdBy: { select: { name: true } },
      },
    });

    // Recently delivered POs (need confirmation)
    const recentDeliveries = await this.prisma.purchaseOrder.findMany({
      where: {
        ...companyFilter,
        status: PoStatus.DELIVERED,
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
        createdBy: { select: { name: true } },
      },
    });

    // Active bulk orders with fulfillment progress
    const activeBulkOrders = await this.prisma.bulkOrder.findMany({
      where: {
        ...companyFilter,
        status: 'ACTIVE',
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
        lineItems: {
          select: {
            description: true,
            qty: true,
            qtyRemaining: true,
            deliveriesPercent: true,
          },
        },
      },
    });

    // KPI counts
    const [pendingDeliveryCount, deliveredCount, activeBulkOrderCount, overdueDeliveries] =
      await Promise.all([
        this.prisma.purchaseOrder.count({
          where: { ...companyFilter, status: PoStatus.SCHEDULED_FOR_DELIVERY },
        }),
        this.prisma.purchaseOrder.count({
          where: { ...companyFilter, status: PoStatus.DELIVERED },
        }),
        this.prisma.bulkOrder.count({
          where: { ...companyFilter, status: 'ACTIVE' },
        }),
        this.prisma.purchaseOrder.count({
          where: {
            ...companyFilter,
            status: PoStatus.SCHEDULED_FOR_DELIVERY,
            deadlineEnd: { lt: new Date() },
          },
        }),
      ]);

    const mapPo = (po: (typeof pendingDeliveries)[number]) => ({
      id: po.id,
      poNumber: po.poNumber,
      projectName: po.project.name,
      vendorName: po.vendor?.legalName ?? null,
      requester: po.createdBy?.name ?? null,
      itemCount: po.lineItemCount,
      deliveryLocationId: (po as Record<string, unknown>).deliveryLocationId ?? null,
      pickUp: po.pickUp,
      deadlineEnd: po.deadlineEnd?.toISOString() ?? null,
      totalAmount: po.totalAmount ? Number(po.totalAmount) : null,
      status: po.status,
    });

    return {
      kpi: {
        pendingDeliveries: pendingDeliveryCount,
        delivered: deliveredCount,
        activeBulkOrders: activeBulkOrderCount,
        overdueDeliveries,
      },
      pendingDeliveries: pendingDeliveries.map(mapPo),
      recentDeliveries: recentDeliveries.map(mapPo),
      activeBulkOrders: activeBulkOrders.map((bo) => ({
        id: bo.id,
        projectName: bo.project.name,
        vendorName: bo.vendor.legalName,
        totalAmount: bo.totalAmount ? Number(bo.totalAmount) : null,
        status: bo.status,
        lineItems: bo.lineItems.map((li) => ({
          description: li.description,
          qty: Number(li.qty),
          qtyRemaining: Number(li.qtyRemaining),
          deliveriesPercent: Number(li.deliveriesPercent),
        })),
      })),
    };
  }
}
