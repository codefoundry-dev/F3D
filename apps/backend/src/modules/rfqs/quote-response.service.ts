import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  DiscountType,
  QuoteLineItemAvailability,
  QuoteResponseStatus,
  RfqStatus,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type { SubmitQuoteDto, UpdateQuoteDto } from './quote-response.dto';

/** Statuses that block vendor quote submission / update */
const CLOSED_STATUSES: RfqStatus[] = [RfqStatus.CLOSED, RfqStatus.CANCELLED];

/** Statuses that allow vendor quote submission */
const OPEN_STATUSES: RfqStatus[] = [RfqStatus.OPEN, RfqStatus.AWAITING_RESPONSE];

@Injectable()
export class QuoteResponseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ── Submit Quote ────────────────────────────────────────────────────────────

  async submitQuote(rfqId: string, dto: SubmitQuoteDto, user: AuthenticatedUser) {
    const vendorCompanyId = this.assertVendorRole(user);

    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { lineItems: true, invitedVendors: true },
    });

    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);

    // Vendor's company must be invited
    if (!rfq.invitedVendors.some((v) => v.vendorId === vendorCompanyId)) {
      throw new ForbiddenException(ERR.quotes.notInvited);
    }

    // RFQ must be open for quoting
    if (!OPEN_STATUSES.includes(rfq.status)) {
      throw new BadRequestException(`Cannot submit quote: RFQ status is ${rfq.status}`);
    }

    // Check no existing SUBMITTED quote from this vendor
    const existingQuote = await this.prisma.quoteResponse.findFirst({
      where: {
        rfqId,
        vendorId: vendorCompanyId,
        status: QuoteResponseStatus.SUBMITTED,
      },
    });

    if (existingQuote) {
      throw new BadRequestException(
        'A submitted quote already exists for this RFQ from your company',
      );
    }

    const rfqLineItemIds = rfq.lineItems.map((li) => li.id);
    const submittedLineItemIds = new Set(dto.lineItems.map((li) => li.rfqLineItemId));
    const totalItems = rfqLineItemIds.length;

    const result = await this.prisma.$transaction(async (tx) => {
      // Build line item create data for submitted items
      const lineItemsData = dto.lineItems.map((li) => {
        const lineTotal = this.calculateLineTotal(
          li.quotedQuantity,
          li.unitPrice,
          li.discount,
          li.discountType,
        );
        return {
          rfqLineItemId: li.rfqLineItemId,
          unitPrice: li.unitPrice,
          quotedQuantity: li.quotedQuantity,
          availability:
            (li.availability as QuoteLineItemAvailability) ?? QuoteLineItemAvailability.AVAILABLE,
          deliveryDate: new Date(li.deliveryDate),
          substituteItemId: li.substituteItemId,
          discount: li.discount,
          discountType: li.discountType,
          tax: li.tax,
          taxIncluded: li.taxIncluded ?? false,
          backOrderQty: li.backOrderQty,
          backOrderDeliveryDate: li.backOrderDeliveryDate
            ? new Date(li.backOrderDeliveryDate)
            : undefined,
          notes: li.notes,
          lineTotal,
        };
      });

      // Build NO_QUOTE items for RFQ line items not submitted
      const noQuoteItems = rfqLineItemIds
        .filter((id) => !submittedLineItemIds.has(id))
        .map((rfqLineItemId) => ({
          rfqLineItemId,
          unitPrice: 0,
          quotedQuantity: 0,
          availability: QuoteLineItemAvailability.NO_QUOTE,
          deliveryDate: new Date(),
          lineTotal: 0,
        }));

      const allLineItems = [...lineItemsData, ...noQuoteItems];

      // Calculate totals
      const sumLineTotals = allLineItems.reduce((sum, li) => sum + Number(li.lineTotal), 0);
      const bulkShipmentCost = dto.bulkShipment ?? 0;
      const totalCost = sumLineTotals + bulkShipmentCost;
      const itemsCovered = dto.lineItems.filter(
        (li) => (li.availability ?? 'AVAILABLE') !== 'NO_QUOTE',
      ).length;

      const quoteResponse = await tx.quoteResponse.create({
        data: {
          rfqId,
          vendorId: vendorCompanyId,
          status: QuoteResponseStatus.SUBMITTED,
          totalCost,
          itemsCovered,
          totalItems,
          submittedAt: new Date(),
          bulkDeliveryTime: dto.bulkDeliveryTime ? new Date(dto.bulkDeliveryTime) : undefined,
          bulkDiscount: dto.bulkDiscount,
          bulkTax: dto.bulkTax,
          bulkShipment: dto.bulkShipment,
          warehouseLocationId: dto.warehouseLocationId,
          validityPeriod: dto.validityPeriod ? new Date(dto.validityPeriod) : undefined,
          message: dto.message,
          lineItems: {
            create: allLineItems,
          },
          attachments: dto.attachmentIds?.length
            ? { create: dto.attachmentIds.map((fileId) => ({ fileId })) }
            : undefined,
        },
        include: {
          lineItems: {
            include: {
              rfqLineItem: {
                include: { material: { select: { id: true, name: true, uom: true } } },
              },
              substituteItem: { select: { id: true, name: true, uom: true } },
            },
          },
          attachments: {
            include: { file: { select: { id: true, filename: true, mimeType: true, size: true } } },
          },
          vendor: { select: { id: true, legalName: true } },
        },
      });

      return quoteResponse;
    });

    await this.auditService.log({
      action: AuditAction.QUOTE_SUBMITTED,
      performedById: user.id,
      targetType: 'QuoteResponse',
      targetId: result.id,
      targetLabel: `Quote for RFQ ${rfqId}`,
      metadata: { rfqId, vendorId: vendorCompanyId },
    });

    return result;
  }

  // ── Update Quote ────────────────────────────────────────────────────────────

  async updateQuote(rfqId: string, quoteId: string, dto: UpdateQuoteDto, user: AuthenticatedUser) {
    const vendorCompanyId = this.assertVendorRole(user);

    const quote = await this.prisma.quoteResponse.findUnique({
      where: { id: quoteId },
      include: {
        rfq: { include: { lineItems: true } },
      },
    });

    if (!quote) throw new NotFoundException(ERR.rfqs.quoteNotFound);

    // Validate ownership
    if (quote.vendorId !== vendorCompanyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    // Validate RFQ not closed
    if (CLOSED_STATUSES.includes(quote.rfq.status)) {
      throw new BadRequestException(`Cannot update quote: RFQ status is ${quote.rfq.status}`);
    }

    const rfqLineItemIds = quote.rfq.lineItems.map((li) => li.id);
    const submittedLineItemIds = new Set(dto.lineItems.map((li) => li.rfqLineItemId));
    const totalItems = rfqLineItemIds.length;

    const result = await this.prisma.$transaction(async (tx) => {
      // Delete old line items and attachments
      await tx.quoteResponseLineItem.deleteMany({
        where: { quoteResponseId: quoteId },
      });
      await tx.quoteAttachment.deleteMany({
        where: { quoteResponseId: quoteId },
      });

      // Build new line items
      const lineItemsData = dto.lineItems.map((li) => {
        const lineTotal = this.calculateLineTotal(
          li.quotedQuantity,
          li.unitPrice,
          li.discount,
          li.discountType,
        );
        return {
          quoteResponseId: quoteId,
          rfqLineItemId: li.rfqLineItemId,
          unitPrice: li.unitPrice,
          quotedQuantity: li.quotedQuantity,
          availability:
            (li.availability as QuoteLineItemAvailability) ?? QuoteLineItemAvailability.AVAILABLE,
          deliveryDate: new Date(li.deliveryDate),
          substituteItemId: li.substituteItemId,
          discount: li.discount,
          discountType: li.discountType,
          tax: li.tax,
          taxIncluded: li.taxIncluded ?? false,
          backOrderQty: li.backOrderQty,
          backOrderDeliveryDate: li.backOrderDeliveryDate
            ? new Date(li.backOrderDeliveryDate)
            : undefined,
          notes: li.notes,
          lineTotal,
        };
      });

      const noQuoteItems = rfqLineItemIds
        .filter((id) => !submittedLineItemIds.has(id))
        .map((rfqLineItemId) => ({
          quoteResponseId: quoteId,
          rfqLineItemId,
          unitPrice: 0,
          quotedQuantity: 0,
          availability: QuoteLineItemAvailability.NO_QUOTE as QuoteLineItemAvailability,
          deliveryDate: new Date(),
          lineTotal: 0,
        }));

      const allLineItems = [...lineItemsData, ...noQuoteItems];

      // Create new line items
      await tx.quoteResponseLineItem.createMany({ data: allLineItems });

      // Calculate totals
      const sumLineTotals = allLineItems.reduce((sum, li) => sum + Number(li.lineTotal), 0);
      const bulkShipmentCost = dto.bulkShipment ?? 0;
      const totalCost = sumLineTotals + bulkShipmentCost;
      const itemsCovered = dto.lineItems.filter(
        (li) => (li.availability ?? 'AVAILABLE') !== 'NO_QUOTE',
      ).length;

      // Create new attachments
      if (dto.attachmentIds?.length) {
        await tx.quoteAttachment.createMany({
          data: dto.attachmentIds.map((fileId) => ({
            quoteResponseId: quoteId,
            fileId,
          })),
        });
      }

      const updated = await tx.quoteResponse.update({
        where: { id: quoteId },
        data: {
          totalCost,
          itemsCovered,
          totalItems,
          bulkDeliveryTime: dto.bulkDeliveryTime ? new Date(dto.bulkDeliveryTime) : null,
          bulkDiscount: dto.bulkDiscount ?? null,
          bulkTax: dto.bulkTax ?? null,
          bulkShipment: dto.bulkShipment ?? null,
          warehouseLocationId: dto.warehouseLocationId ?? null,
          validityPeriod: dto.validityPeriod ? new Date(dto.validityPeriod) : null,
          message: dto.message ?? null,
        },
        include: {
          lineItems: {
            include: {
              rfqLineItem: {
                include: { material: { select: { id: true, name: true, uom: true } } },
              },
              substituteItem: { select: { id: true, name: true, uom: true } },
            },
          },
          attachments: {
            include: { file: { select: { id: true, filename: true, mimeType: true, size: true } } },
          },
          vendor: { select: { id: true, legalName: true } },
        },
      });

      return updated;
    });

    await this.auditService.log({
      action: AuditAction.QUOTE_UPDATED,
      performedById: user.id,
      targetType: 'QuoteResponse',
      targetId: result.id,
      targetLabel: `Quote ${quoteId} for RFQ ${rfqId}`,
      metadata: { rfqId, quoteId, vendorId: vendorCompanyId },
    });

    return result;
  }

  // ── Get Quote Detail ────────────────────────────────────────────────────────

  async getQuoteDetail(rfqId: string, quoteId: string, user: AuthenticatedUser) {
    const quote = await this.prisma.quoteResponse.findUnique({
      where: { id: quoteId },
      include: {
        lineItems: {
          include: {
            rfqLineItem: { include: { material: { select: { id: true, name: true, uom: true } } } },
            substituteItem: { select: { id: true, name: true, uom: true } },
          },
        },
        attachments: {
          include: { file: { select: { id: true, filename: true, mimeType: true, size: true } } },
        },
        vendor: { select: { id: true, legalName: true } },
        rfq: { select: { id: true, companyId: true, rfqNumber: true } },
        warehouseLocation: true,
      },
    });

    if (!quote || quote.rfqId !== rfqId) {
      throw new NotFoundException(ERR.rfqs.quoteNotFound);
    }

    // Access control: vendor who submitted OR contractor of the RFQ's company
    const isVendorOwner = user.role === UserRole.VENDOR && quote.vendorId === user.companyId;
    const isContractor =
      (user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.PROCUREMENT_OFFICER) &&
      quote.rfq.companyId === user.companyId;

    if (!isVendorOwner && !isContractor) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    // Convert Prisma Decimal fields to plain numbers and flatten nested objects
    return {
      ...quote,
      totalCost: Number(quote.totalCost),
      discountPercent: quote.discountPercent !== null ? Number(quote.discountPercent) : null,
      discountAmount: quote.discountAmount !== null ? Number(quote.discountAmount) : null,
      bulkDiscount: quote.bulkDiscount !== null ? Number(quote.bulkDiscount) : null,
      bulkTax: quote.bulkTax !== null ? Number(quote.bulkTax) : null,
      bulkShipment: quote.bulkShipment !== null ? Number(quote.bulkShipment) : null,
      lineItems: quote.lineItems.map((li) => ({
        ...li,
        unitPrice: Number(li.unitPrice),
        discount: li.discount !== null ? Number(li.discount) : null,
        tax: li.tax !== null ? Number(li.tax) : null,
        lineTotal: Number(li.lineTotal),
      })),
      attachments: quote.attachments.map((a) => ({
        id: a.id,
        fileId: a.file.id,
        filename: a.file.filename,
        mimeType: a.file.mimeType,
        size: a.file.size,
      })),
    };
  }

  // ── Guest (invitation link) access ──────────────────────────────────────────

  private async resolveInvitationToken(token: string) {
    const rfqVendor = await this.prisma.rfqVendor.findUnique({
      where: { invitationToken: token },
      include: {
        rfq: {
          include: {
            lineItems: {
              include: { material: { select: { id: true, name: true, uom: true } } },
            },
            project: { select: { name: true } },
            company: { select: { legalName: true } },
            deliveryLocation: true,
          },
        },
        vendor: { select: { id: true, legalName: true } },
      },
    });

    if (!rfqVendor) {
      throw new NotFoundException('Invalid or expired invitation token');
    }

    return rfqVendor;
  }

  async getGuestRfq(token: string) {
    const rfqVendor = await this.resolveInvitationToken(token);
    const rfq = rfqVendor.rfq;

    return {
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      contractorName: rfq.company.legalName,
      projectName: rfq.project?.name ?? null,
      status: rfq.status,
      deliveryLocation: rfq.deliveryLocation?.label ?? rfq.deliveryLocation?.address ?? null,
      needByDate: rfq.needByDate?.toISOString() ?? null,
      message: rfq.message,
      lineItems: rfq.lineItems.map((li) => ({
        id: li.id,
        materialName: li.material?.name ?? li.description ?? '',
        unit: li.unit,
        quantity: li.quantity,
        description: li.description,
        costCode: li.costCode,
      })),
      vendorName: rfqVendor.vendor.legalName,
      vendorId: rfqVendor.vendorId,
    };
  }

  async submitGuestQuote(token: string, dto: SubmitQuoteDto) {
    const rfqVendor = await this.resolveInvitationToken(token);
    const rfq = rfqVendor.rfq;

    if (!OPEN_STATUSES.includes(rfq.status)) {
      throw new BadRequestException(`Cannot submit quote: RFQ status is ${rfq.status}`);
    }

    // Check for duplicate
    const existing = await this.prisma.quoteResponse.findFirst({
      where: {
        rfqId: rfq.id,
        vendorId: rfqVendor.vendorId,
        status: QuoteResponseStatus.SUBMITTED,
      },
    });
    if (existing) {
      throw new BadRequestException('A quote has already been submitted for this RFQ');
    }

    const rfqLineItemIds = rfq.lineItems.map((li) => li.id);
    const submittedLineItemIds = new Set(dto.lineItems.map((li) => li.rfqLineItemId));
    const totalItems = rfqLineItemIds.length;

    const result = await this.prisma.$transaction(async (tx) => {
      const lineItemsData = dto.lineItems.map((li) => ({
        rfqLineItemId: li.rfqLineItemId,
        unitPrice: li.unitPrice,
        quotedQuantity: li.quotedQuantity,
        availability:
          (li.availability as QuoteLineItemAvailability) ?? QuoteLineItemAvailability.AVAILABLE,
        deliveryDate: new Date(li.deliveryDate),
        substituteItemId: li.substituteItemId,
        discount: li.discount,
        discountType: li.discountType,
        tax: li.tax,
        taxIncluded: li.taxIncluded ?? false,
        backOrderQty: li.backOrderQty,
        backOrderDeliveryDate: li.backOrderDeliveryDate
          ? new Date(li.backOrderDeliveryDate)
          : undefined,
        notes: li.notes,
        lineTotal: this.calculateLineTotal(
          li.quotedQuantity,
          li.unitPrice,
          li.discount,
          li.discountType,
        ),
      }));

      const noQuoteItems = rfqLineItemIds
        .filter((id) => !submittedLineItemIds.has(id))
        .map((rfqLineItemId) => ({
          rfqLineItemId,
          unitPrice: 0,
          quotedQuantity: 0,
          availability: QuoteLineItemAvailability.NO_QUOTE as QuoteLineItemAvailability,
          deliveryDate: new Date(),
          lineTotal: 0,
        }));

      const allLineItems = [...lineItemsData, ...noQuoteItems];
      const sumLineTotals = allLineItems.reduce((sum, li) => sum + Number(li.lineTotal), 0);
      const bulkShipmentCost = dto.bulkShipment ?? 0;
      const totalCost = sumLineTotals + bulkShipmentCost;
      const itemsCovered = dto.lineItems.filter(
        (li) => (li.availability ?? 'AVAILABLE') !== 'NO_QUOTE',
      ).length;

      const quote = await tx.quoteResponse.create({
        data: {
          rfqId: rfq.id,
          vendorId: rfqVendor.vendorId,
          totalCost,
          itemsCovered,
          totalItems,
          status: QuoteResponseStatus.SUBMITTED,
          submittedAt: new Date(),
          bulkDeliveryTime: dto.bulkDeliveryTime ? new Date(dto.bulkDeliveryTime) : null,
          bulkDiscount: dto.bulkDiscount ?? null,
          bulkTax: dto.bulkTax ?? null,
          bulkShipment: dto.bulkShipment ?? null,
          warehouseLocationId: dto.warehouseLocationId ?? null,
          validityPeriod: dto.validityPeriod ? new Date(dto.validityPeriod) : null,
          message: dto.message ?? null,
          lineItems: {
            createMany: { data: allLineItems },
          },
          attachments: dto.attachmentIds?.length
            ? { create: dto.attachmentIds.map((fileId) => ({ fileId })) }
            : undefined,
        },
        include: {
          lineItems: {
            include: {
              rfqLineItem: {
                include: { material: { select: { id: true, name: true, uom: true } } },
              },
            },
          },
          attachments: {
            include: { file: { select: { id: true, filename: true, mimeType: true, size: true } } },
          },
          vendor: { select: { id: true, legalName: true } },
        },
      });

      return quote;
    });

    await this.auditService.log({
      action: AuditAction.QUOTE_SUBMITTED,
      performedById: rfqVendor.vendorId,
      targetType: 'QuoteResponse',
      targetId: result.id,
      targetLabel: `Guest quote for RFQ ${rfq.id}`,
      metadata: { rfqId: rfq.id, vendorId: rfqVendor.vendorId, guestAccess: true },
    });

    return result;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private assertVendorRole(user: AuthenticatedUser): string {
    if (user.role !== UserRole.VENDOR) {
      throw new ForbiddenException(ERR.quotes.onlyVendor);
    }
    if (!user.companyId) {
      throw new ForbiddenException(ERR.quotes.vendorNoCompany);
    }
    return user.companyId;
  }

  private calculateLineTotal(
    quantity: number,
    unitPrice: number,
    discount?: number,
    discountType?: DiscountType,
  ): number {
    const subtotal = quantity * unitPrice;
    if (!discount || !discountType) return subtotal;

    if (discountType === DiscountType.PERCENT) {
      return subtotal * (1 - discount / 100);
    }
    if (discountType === DiscountType.AMOUNT) {
      return subtotal - discount;
    }
    return subtotal;
  }
}
