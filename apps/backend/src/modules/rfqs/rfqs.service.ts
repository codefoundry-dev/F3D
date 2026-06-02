import { randomBytes, randomUUID } from 'crypto';
import * as path from 'path';

import {
  CreateRfqDto,
  RfqListQueryDto,
  SaveRfqDraftDto,
  SendRfqDto,
  UpdateRfqDto,
  VendorRfqStatus,
  buildPaginationMeta,
} from '@forethread/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyType, Prisma, QuoteResponseStatus, RfqStatus, UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { nextSequentialNumber } from '../../common/utils/sequential-number.util';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailAttachment, EmailService } from '../notifications/email.service';
import { StorageService } from '../storage/storage.service';

import { normalizeCcEmails } from './rfq-cc.util';
import { VENDOR_STATUS_MAP, VENDOR_STATUS_TO_RFQ } from './vendor-status.constants';

/** Prisma includes shared by list & detail queries */
const RFQ_LIST_INCLUDE = {
  project: { select: { name: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  _count: { select: { lineItems: true, quoteResponses: true, invitedVendors: true } },
  quoteResponses: { select: { vendorId: true, status: true }, distinct: ['vendorId' as const] },
} satisfies Prisma.RfqInclude;

const RFQ_DETAIL_INCLUDE = {
  project: { select: { name: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  lineItems: { include: { material: { select: { id: true, name: true, uom: true } } } },
  quoteResponses: { include: { vendor: { select: { legalName: true } } } },
  invitedVendors: {
    include: {
      vendor: {
        select: {
          id: true,
          legalName: true,
          logoUrl: true,
          legalAddress: true,
          specialisations: true,
          users: {
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, role: true, phone: true, email: true, position: true },
          },
        },
      },
    },
  },
  documents: {
    include: {
      file: { include: { uploadedBy: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.RfqInclude;

export interface UpdateLineItemDto {
  materialId?: string;
  quantity?: number;
  unit?: string;
  description?: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class RfqsService {
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    config: ConfigService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:5179');
  }

  // ── List RFQs ──────────────────────────────────────────────────────────────

  async listRfqs(query: RfqListQueryDto, user: AuthenticatedUser) {
    const where = this.buildListWhere(query, user);
    const orderBy = this.buildOrderBy(query.sortBy ?? 'createdDate', query.sortDir ?? 'desc');

    if (query.minApprovedQuotes !== undefined || query.minApprovedVendors !== undefined) {
      const rfqIds = await this.getFilteredRfqIdsByApprovedQuotes(
        where,
        query.minApprovedQuotes,
        query.minApprovedVendors,
      );
      where.id = { in: rfqIds };
    }

    const isVendor = user.role === UserRole.VENDOR;

    const include = isVendor
      ? {
          ...RFQ_LIST_INCLUDE,
          quoteResponses: {
            where: { vendor: { users: { some: { id: user.id } } } },
            select: { vendorId: true, status: true },
            take: 1,
          },
        }
      : RFQ_LIST_INCLUDE;

    const [items, total] = await Promise.all([
      this.prisma.rfq.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        include,
      }),
      this.prisma.rfq.count({ where }),
    ]);

    return {
      items: items.map((rfq) => ({
        id: rfq.id,
        rfqNumber: (rfq as Record<string, unknown>).rfqNumber ?? null,
        projectName: rfq.project.name,
        projectId: rfq.projectId,
        status: isVendor ? this.computeVendorStatus(rfq, user.id) : rfq.status,
        reqQuantities: rfq.totalRequestedQty,
        pickUp: !!rfq.pickUpLocation,
        deliveryLocationId: (rfq as Record<string, unknown>).deliveryLocationId ?? null,
        pickUpLocation: rfq.pickUpLocation,
        recVendors: rfq.quoteResponses.length,
        recQuotes: rfq._count.quoteResponses,
        invitedVendors: rfq._count.invitedVendors,
        applVendors: 0,
        lineItems: rfq._count.lineItems,
        deadlineRange:
          rfq.deadlineStart && rfq.deadlineEnd
            ? `${rfq.deadlineStart.toISOString().split('T')[0]} - ${rfq.deadlineEnd.toISOString().split('T')[0]}`
            : null,
        applIssues: 0,
        totalRequestedQty: rfq.totalRequestedQty,
        arcBlocksDist: null,
        createdDate: rfq.createdAt.toISOString(),
        createdBy: rfq.createdBy.name,
        createdByUserId: rfq.createdByUserId,
        approvalStatus: rfq.approvalStatus,
        approvedBy: rfq.approvedBy?.name ?? null,
        lastModifiedBy: null,
      })),
      meta: buildPaginationMeta(query.page ?? 1, query.take, total),
    };
  }

  // ── Get single RFQ ─────────────────────────────────────────────────────────

  async getRfq(id: string, user: AuthenticatedUser) {
    const isVendor = user.role === UserRole.VENDOR;

    const include = isVendor
      ? {
          ...RFQ_DETAIL_INCLUDE,
          quoteResponses: {
            include: {
              vendor: { select: { legalName: true, users: { select: { id: true } } } },
            },
          },
        }
      : RFQ_DETAIL_INCLUDE;

    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      include,
    });

    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);

    // Compute vendor status from the vendor's own quote response
    let vendorStatus: string | undefined;
    if (isVendor) {
      const STATUS_PRIORITY: Record<string, number> = {
        [QuoteResponseStatus.APPROVED]: 1,
        [QuoteResponseStatus.SUBMITTED]: 2,
        [QuoteResponseStatus.DECLINED]: 3,
        [QuoteResponseStatus.PENDING]: 4,
      };
      const vendorQuotes = (
        rfq.quoteResponses as Array<{
          vendorId: string;
          status: QuoteResponseStatus;
          vendor: { users: { id: string }[] };
        }>
      ).filter((qr) => qr.vendor.users.some((u) => u.id === user.id));
      const vendorQuote = vendorQuotes.sort(
        (a, b) => (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99),
      )[0];
      vendorStatus = this.computeVendorStatus(
        {
          status: rfq.status,
          quoteResponses: vendorQuote
            ? [{ vendorId: vendorQuote.vendorId, status: vendorQuote.status }]
            : [],
        },
        user.id,
      );
    }

    const rfqAny = rfq as Record<string, unknown>;

    return {
      id: rfq.id,
      rfqNumber: rfqAny.rfqNumber ?? null,
      projectName: rfq.project.name,
      projectId: rfq.projectId,
      status: vendorStatus ?? rfq.status,
      pickUp: !!rfq.pickUpLocation,
      pickUpDate: rfq.pickUpDate?.toISOString() ?? null,
      deliveryLocationId: rfqAny.deliveryLocationId ?? null,
      pickUpLocation: rfq.pickUpLocation,
      currency: rfqAny.currency ?? null,
      needByDate: rfqAny.needByDate ? (rfqAny.needByDate as Date).toISOString() : null,
      holdForRelease: rfqAny.holdForRelease ?? false,
      earliestDeliveryDate: rfqAny.earliestDeliveryDate
        ? (rfqAny.earliestDeliveryDate as Date).toISOString()
        : null,
      message: rfqAny.message ?? null,
      deadlineStart: rfq.deadlineStart?.toISOString() ?? null,
      deadlineEnd: rfq.deadlineEnd?.toISOString() ?? null,
      totalRequestedQty: rfq.totalRequestedQty,
      approvalStatus: rfq.approvalStatus,
      approvedBy: rfq.approvedBy ? { id: rfq.approvedBy.id, name: rfq.approvedBy.name } : null,
      createdBy: { id: rfq.createdBy.id, name: rfq.createdBy.name },
      lineItems: rfq.lineItems.map((li) => ({
        id: li.id,
        projectName: rfq.project.name,
        materialId: li.materialId,
        materialName: (li as unknown as { material: { name: string } }).material.name,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        expectedDeliveryDate: null,
        deliveryLocationId: rfqAny.deliveryLocationId ?? null,
        hasNotes: false,
      })),
      vendors:
        (
          rfq as unknown as {
            invitedVendors: {
              vendor: {
                id: string;
                legalName: string;
                logoUrl: string | null;
                legalAddress: string | null;
                specialisations: string[];
                users: {
                  id: string;
                  name: string;
                  role: string;
                  phone: string | null;
                  email: string;
                  position: string;
                }[];
              };
            }[];
          }
        ).invitedVendors?.map((iv) => {
          const hasApprovedQuote = rfq.quoteResponses.some(
            (qr) => qr.vendorId === iv.vendor.id && qr.status === QuoteResponseStatus.APPROVED,
          );
          return {
            id: iv.vendor.id,
            name: iv.vendor.legalName,
            avatarUrl: iv.vendor.logoUrl,
            category:
              iv.vendor.specialisations.length > 0 ? iv.vendor.specialisations.join(', ') : null,
            location: iv.vendor.legalAddress,
            approved: hasApprovedQuote,
            contacts: iv.vendor.users.map((u) => ({
              id: u.id,
              name: u.name,
              role: u.position || u.role,
              phone: u.phone,
              email: u.email,
            })),
          };
        }) ?? [],
      quoteResponses: rfq.quoteResponses.map((qr) => ({
        id: qr.id,
        vendorId: qr.vendorId,
        vendorName: qr.vendor.legalName,
        totalCost: Number(qr.totalCost),
        discountPercent: qr.discountPercent ? Number(qr.discountPercent) : null,
        discountAmount: qr.discountAmount ? Number(qr.discountAmount) : null,
        itemsCovered: qr.itemsCovered,
        totalItems: qr.totalItems,
        status: qr.status,
        submittedAt: qr.submittedAt?.toISOString() ?? null,
      })),
      documents: rfq.documents.map((doc) => ({
        id: doc.id,
        name: doc.file.filename,
        fileId: doc.fileId,
        uploadedBy: {
          name: doc.file.uploadedBy.name,
          email: doc.file.uploadedBy.email,
          avatarUrl: null,
        },
        uploadedAt: doc.createdAt.toISOString(),
      })),
      createdAt: rfq.createdAt.toISOString(),
      updatedAt: rfq.updatedAt.toISOString(),
    };
  }

  // ── Copy RFQ ───────────────────────────────────────────────────────────────

  async copyRfq(id: string, user: AuthenticatedUser) {
    const source = await this.prisma.rfq.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!source) throw new NotFoundException(ERR.rfqs.notFound);
    this.assertCompanyAccess(user, source.companyId);

    const sourceAny = source as Record<string, unknown>;
    const rfqNumber = await nextSequentialNumber(this.prisma, 'rfq', 'RFQ', source.companyId);
    const copy = await this.prisma.rfq.create({
      data: {
        rfqNumber,
        companyId: source.companyId,
        projectId: source.projectId,
        createdByUserId: user.id,
        status: RfqStatus.DRAFT,
        deliveryLocationId: sourceAny.deliveryLocationId as string | undefined,
        pickUpLocation: source.pickUpLocation,
        pickUpDate: source.pickUpDate,
        currency: sourceAny.currency as string | undefined,
        needByDate: sourceAny.needByDate as Date | undefined,
        holdForRelease: (sourceAny.holdForRelease as boolean) ?? false,
        earliestDeliveryDate: sourceAny.earliestDeliveryDate as Date | undefined,
        message: sourceAny.message as string | undefined,
        deadlineStart: source.deadlineStart,
        deadlineEnd: source.deadlineEnd,
        totalRequestedQty: source.totalRequestedQty,
        lineItems: {
          create: source.lineItems.map((li) => ({
            materialId: (li as Record<string, unknown>).materialId as string | undefined,
            quantity: li.quantity,
            unit: li.unit,
            description: li.description,
            costCode: (li as Record<string, unknown>).costCode as string | undefined,
            pickUp: (li as Record<string, unknown>).pickUp as boolean | undefined,
          })),
        },
      } as never,
    });

    return { id: copy.id };
  }

  // ── Archive RFQ ────────────────────────────────────────────────────────────

  async archiveRfq(id: string, user: AuthenticatedUser) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);
    this.assertCompanyAccess(user, rfq.companyId);

    if (rfq.status !== RfqStatus.CLOSED) {
      throw new BadRequestException(ERR.rfqs.onlyClosedCanArchive);
    }

    await this.prisma.rfq.update({
      where: { id },
      data: { status: RfqStatus.CANCELLED },
    });

    return { success: true };
  }

  // ── Create RFQ ────────────────────────────────────────────────────────────

  async createRfq(dto: CreateRfqDto, user: AuthenticatedUser) {
    // Validate project exists and belongs to user's company
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, companyId: true },
    });
    if (!project) throw new NotFoundException(ERR.rfqs.projectNotFound);
    this.assertCompanyAccess(user, project.companyId);

    // Validate deliveryLocationId belongs to the project
    const location = await this.prisma.projectLocation.findUnique({
      where: { id: dto.deliveryLocationId },
    });
    if (location?.projectId !== dto.projectId) {
      throw new BadRequestException(ERR.rfqs.invalidDeliveryLocation);
    }

    // Validate all materialIds exist
    const materialIds = dto.lineItems.map((li) => li.materialId);
    const materials = await this.prisma.material.findMany({
      where: { id: { in: materialIds } },
      select: { id: true },
    });
    if (materials.length !== materialIds.length) {
      throw new BadRequestException(ERR.rfqs.invalidMaterialIds);
    }

    // Validate all vendorIds exist, are vendor-type companies, and are assigned to this contractor.
    // Why: enforces the M:N relationship — a contractor can only invite vendors on their list,
    // not arbitrary platform vendors belonging to other contractors.
    await this.assertVendorsAssigned(dto.vendorIds, user.companyId);

    // Hold-for-release requires earliestDeliveryDate
    if (dto.holdForRelease && !dto.earliestDeliveryDate) {
      throw new BadRequestException(ERR.rfqs.holdForReleaseRequiresEarliestDelivery);
    }

    const totalRequestedQty = dto.lineItems.reduce((sum, li) => sum + li.quantity, 0);
    const rfqNumber = await nextSequentialNumber(this.prisma, 'rfq', 'RFQ', user.companyId ?? '');

    const rfq = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rfq.create({
        data: {
          rfqNumber,
          companyId: user.companyId ?? '',
          projectId: dto.projectId,
          createdByUserId: user.id,
          status: RfqStatus.DRAFT,
          currency: dto.currency ?? 'AUD',
          deliveryLocationId: dto.deliveryLocationId,
          needByDate: dto.needByDate ? new Date(dto.needByDate) : null,
          holdForRelease: dto.holdForRelease ?? false,
          earliestDeliveryDate: dto.earliestDeliveryDate
            ? new Date(dto.earliestDeliveryDate)
            : null,
          deadlineEnd: new Date(dto.deadlineEnd),
          message: dto.message,
          totalRequestedQty,
          lineItems: {
            create: dto.lineItems.map((li) => ({
              materialId: li.materialId,
              quantity: li.quantity,
              unit: li.uom,
              costCode: li.costCode,
              description: li.notes,
              pickUp: li.pickUp ?? false,
            })),
          },
          invitedVendors: {
            create: dto.vendorIds.map((vendorId) => ({ vendorId })),
          },
        } as never,
      });

      // Link pre-uploaded attachments if provided
      if (dto.attachmentIds && dto.attachmentIds.length > 0) {
        await tx.rfqDocument.createMany({
          data: dto.attachmentIds.map((fileId) => ({
            rfqId: created.id,
            fileId,
          })),
        });
      }

      return created;
    });

    return this.getRfq(rfq.id, user);
  }

  // ── Save RFQ draft (save-as-you-go, FOR-202) ───────────────────────────────

  /**
   * Persist a partial RFQ as a DRAFT for the multi-step create form. Only the
   * project is required; any other slice (line items, vendors, delivery) is
   * persisted when present. Whatever validations apply to a given slice still
   * run (location belongs to project, materials exist, vendors are assigned),
   * but missing slices are simply skipped so the form can save after step 1.
   */
  async saveRfqDraft(dto: SaveRfqDraftDto, user: AuthenticatedUser) {
    // Validate project exists and belongs to user's company
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, companyId: true },
    });
    if (!project) throw new NotFoundException(ERR.rfqs.projectNotFound);
    this.assertCompanyAccess(user, project.companyId);

    // Validate deliveryLocationId belongs to the project (when provided)
    if (dto.deliveryLocationId) {
      const location = await this.prisma.projectLocation.findUnique({
        where: { id: dto.deliveryLocationId },
      });
      if (location?.projectId !== dto.projectId) {
        throw new BadRequestException(ERR.rfqs.invalidDeliveryLocation);
      }
    }

    // Validate materialIds (when line items provided)
    if (dto.lineItems && dto.lineItems.length > 0) {
      const materialIds = dto.lineItems.map((li) => li.materialId);
      const materials = await this.prisma.material.findMany({
        where: { id: { in: materialIds } },
        select: { id: true },
      });
      if (materials.length !== new Set(materialIds).size) {
        throw new BadRequestException(ERR.rfqs.invalidMaterialIds);
      }
    }

    // Validate vendor assignment scope (when vendors provided)
    if (dto.vendorIds && dto.vendorIds.length > 0) {
      await this.assertVendorsAssigned(dto.vendorIds, user.companyId);
    }

    // Hold-for-release requires earliestDeliveryDate
    if (dto.holdForRelease && !dto.earliestDeliveryDate) {
      throw new BadRequestException(ERR.rfqs.holdForReleaseRequiresEarliestDelivery);
    }

    const totalRequestedQty = (dto.lineItems ?? []).reduce((sum, li) => sum + li.quantity, 0);
    const rfqNumber = await nextSequentialNumber(this.prisma, 'rfq', 'RFQ', user.companyId ?? '');

    const rfq = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rfq.create({
        data: {
          rfqNumber,
          companyId: user.companyId ?? '',
          projectId: dto.projectId,
          createdByUserId: user.id,
          status: RfqStatus.DRAFT,
          currency: dto.currency ?? 'AUD',
          deliveryLocationId: dto.deliveryLocationId ?? null,
          needByDate: dto.needByDate ? new Date(dto.needByDate) : null,
          holdForRelease: dto.holdForRelease ?? false,
          earliestDeliveryDate: dto.earliestDeliveryDate
            ? new Date(dto.earliestDeliveryDate)
            : null,
          deadlineEnd: dto.deadlineEnd ? new Date(dto.deadlineEnd) : null,
          message: dto.message,
          totalRequestedQty,
          ...(dto.lineItems && dto.lineItems.length > 0
            ? {
                lineItems: {
                  create: dto.lineItems.map((li) => ({
                    materialId: li.materialId,
                    quantity: li.quantity,
                    unit: li.uom,
                    costCode: li.costCode,
                    description: li.notes,
                    pickUp: li.pickUp ?? false,
                  })),
                },
              }
            : {}),
          ...(dto.vendorIds && dto.vendorIds.length > 0
            ? { invitedVendors: { create: dto.vendorIds.map((vendorId) => ({ vendorId })) } }
            : {}),
        } as never,
      });

      if (dto.attachmentIds && dto.attachmentIds.length > 0) {
        await tx.rfqDocument.createMany({
          data: dto.attachmentIds.map((fileId) => ({ rfqId: created.id, fileId })),
        });
      }

      return created;
    });

    return this.getRfq(rfq.id, user);
  }

  // ── Update RFQ ───────────────────────────────────────────────────────────

  async updateRfq(id: string, dto: UpdateRfqDto, user: AuthenticatedUser) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        companyId: true,
        projectId: true,
        _count: {
          select: {
            quoteResponses: {
              where: {
                status: { in: [QuoteResponseStatus.SUBMITTED, QuoteResponseStatus.APPROVED] },
              },
            } as never,
          },
        },
      },
    });

    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);
    this.assertCompanyAccess(user, rfq.companyId);

    // Can only edit DRAFT, or OPEN with no submitted/approved responses
    const canEdit =
      rfq.status === RfqStatus.DRAFT ||
      (rfq.status === RfqStatus.OPEN &&
        (rfq._count as unknown as { quoteResponses: number }).quoteResponses === 0);
    if (!canEdit) {
      throw new BadRequestException(ERR.rfqs.cannotEditStatus(rfq.status));
    }

    const projectId = dto.projectId ?? rfq.projectId;

    // Validate deliveryLocationId if provided
    if (dto.deliveryLocationId) {
      const location = await this.prisma.projectLocation.findUnique({
        where: { id: dto.deliveryLocationId },
      });
      if (location?.projectId !== projectId) {
        throw new BadRequestException(ERR.rfqs.invalidDeliveryLocation);
      }
    }

    // Validate materialIds if lineItems provided
    if (dto.lineItems) {
      const materialIds = dto.lineItems.map((li) => li.materialId);
      const materials = await this.prisma.material.findMany({
        where: { id: { in: materialIds } },
        select: { id: true },
      });
      if (materials.length !== materialIds.length) {
        throw new BadRequestException(ERR.rfqs.invalidMaterialIds);
      }
    }

    // Validate vendorIds if provided — same M:N scope check as createRfq.
    if (dto.vendorIds) {
      await this.assertVendorsAssigned(dto.vendorIds, rfq.companyId);
    }

    // Hold-for-release validation
    if (dto.holdForRelease === true && !dto.earliestDeliveryDate) {
      const existing = await this.prisma.rfq.findUnique({
        where: { id },
        select: { earliestDeliveryDate: true },
      });
      if (!existing?.earliestDeliveryDate) {
        throw new BadRequestException(ERR.rfqs.holdForReleaseRequiresEarliestDelivery);
      }
    }

    // Build update data for Rfq scalar fields
    const rfqUpdateData: Record<string, unknown> = {};
    if (dto.projectId !== undefined) rfqUpdateData.projectId = dto.projectId;
    if (dto.deadlineEnd !== undefined) rfqUpdateData.deadlineEnd = new Date(dto.deadlineEnd);
    if (dto.deliveryLocationId !== undefined)
      rfqUpdateData.deliveryLocationId = dto.deliveryLocationId;
    if (dto.needByDate !== undefined)
      rfqUpdateData.needByDate = dto.needByDate ? new Date(dto.needByDate) : null;
    if (dto.holdForRelease !== undefined) rfqUpdateData.holdForRelease = dto.holdForRelease;
    if (dto.earliestDeliveryDate !== undefined)
      rfqUpdateData.earliestDeliveryDate = dto.earliestDeliveryDate
        ? new Date(dto.earliestDeliveryDate)
        : null;
    if (dto.currency !== undefined) rfqUpdateData.currency = dto.currency;
    if (dto.message !== undefined) rfqUpdateData.message = dto.message;

    if (dto.lineItems) {
      // Recalculate totalRequestedQty
      const totalRequestedQty = dto.lineItems.reduce((sum, li) => sum + li.quantity, 0);
      rfqUpdateData.totalRequestedQty = totalRequestedQty;
    }

    const txOps: Prisma.PrismaPromise<unknown>[] = [];

    // Delete + recreate line items if provided
    if (dto.lineItems) {
      txOps.push(this.prisma.rfqLineItem.deleteMany({ where: { rfqId: id } }));
      txOps.push(
        this.prisma.rfqLineItem.createMany({
          data: dto.lineItems.map((li) => ({
            rfqId: id,
            materialId: li.materialId,
            quantity: li.quantity,
            unit: li.uom,
            costCode: li.costCode,
            description: li.notes,
            pickUp: li.pickUp ?? false,
          })),
        }),
      );
    }

    // Delete + recreate vendors if provided
    if (dto.vendorIds) {
      txOps.push(this.prisma.rfqVendor.deleteMany({ where: { rfqId: id } }));
      txOps.push(
        this.prisma.rfqVendor.createMany({
          data: dto.vendorIds.map((vendorId) => ({ rfqId: id, vendorId })),
        }),
      );
    }

    // Link new attachments if provided
    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      txOps.push(
        this.prisma.rfqDocument.createMany({
          data: dto.attachmentIds.map((fileId) => ({ rfqId: id, fileId })),
        }),
      );
    }

    // Update scalar fields
    txOps.push(this.prisma.rfq.update({ where: { id }, data: rfqUpdateData as never }));

    await this.prisma.$transaction(txOps);

    return this.getRfq(id, user);
  }

  // ── Send RFQ ─────────────────────────────────────────────────────────────

  async sendRfq(id: string, dto: SendRfqDto, user: AuthenticatedUser) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        companyId: true,
        _count: { select: { lineItems: true, invitedVendors: true } },
      },
    });

    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);
    this.assertCompanyAccess(user, rfq.companyId);

    if (rfq.status !== RfqStatus.DRAFT) {
      throw new BadRequestException(ERR.rfqs.cannotSendNotDraft(rfq.status));
    }

    if (rfq._count.lineItems === 0) {
      throw new BadRequestException(ERR.rfqs.mustHaveLineItems);
    }

    if (rfq._count.invitedVendors === 0) {
      throw new BadRequestException(ERR.rfqs.mustHaveVendors);
    }

    const ccEmails = normalizeCcEmails(dto?.cc);

    await this.prisma.rfq.update({
      where: { id },
      data: { status: RfqStatus.OPEN, ccEmails },
    });

    // Generate invitation tokens for each vendor and notify via email (fire-and-forget)
    this.generateInvitationTokensAndNotify(rfq.id).catch(() => {});

    return this.getRfq(id, user);
  }

  // ── Cancel RFQ ───────────────────────────────────────────────────────────

  async cancelRfq(id: string, user: AuthenticatedUser) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });

    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);
    this.assertCompanyAccess(user, rfq.companyId);

    await this.prisma.rfq.update({
      where: { id },
      data: { status: RfqStatus.CANCELLED },
    });

    // TODO: Notify invited vendors about cancellation

    return { success: true };
  }

  // ── Approve Quote ──────────────────────────────────────────────────────────

  async approveQuote(rfqId: string, quoteId: string, user: AuthenticatedUser) {
    const quote = await this.findQuoteOrFail(quoteId);
    this.assertCompanyAccess(user, quote.rfq.companyId);
    this.assertQuotePending(quote.status, 'approve');

    const updated = await this.prisma.quoteResponse.update({
      where: { id: quoteId },
      data: { status: QuoteResponseStatus.APPROVED },
      include: { vendor: { select: { legalName: true } } },
    });

    await this.prisma.rfq.update({
      where: { id: rfqId },
      data: { status: RfqStatus.AWARDED },
    });

    return {
      id: updated.id,
      vendorName: updated.vendor.legalName,
      status: updated.status,
      totalCost: Number(updated.totalCost),
    };
  }

  // ── Decline Quote ──────────────────────────────────────────────────────────

  async declineQuote(_rfqId: string, quoteId: string, user: AuthenticatedUser) {
    const quote = await this.findQuoteOrFail(quoteId);
    this.assertCompanyAccess(user, quote.rfq.companyId);
    this.assertQuotePending(quote.status, 'decline');

    const updated = await this.prisma.quoteResponse.update({
      where: { id: quoteId },
      data: { status: QuoteResponseStatus.DECLINED },
      include: { vendor: { select: { legalName: true } } },
    });

    return {
      id: updated.id,
      vendorName: updated.vendor.legalName,
      status: updated.status,
      totalCost: Number(updated.totalCost),
    };
  }

  // ── Update Line Item ───────────────────────────────────────────────────────

  async updateLineItem(
    rfqId: string,
    lineItemId: string,
    dto: UpdateLineItemDto,
    user: AuthenticatedUser,
  ) {
    const lineItem = await this.prisma.rfqLineItem.findUnique({
      where: { id: lineItemId },
      include: { rfq: { select: { companyId: true } } },
    });

    if (!lineItem || lineItem.rfqId !== rfqId) {
      throw new NotFoundException(ERR.rfqs.lineItemNotFound);
    }

    this.assertCompanyAccess(user, lineItem.rfq.companyId);

    const updated = await this.prisma.rfqLineItem.update({
      where: { id: lineItemId },
      data: {
        ...(dto.materialId !== undefined && { materialId: dto.materialId }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: { material: { select: { id: true, name: true, uom: true } } },
    });

    return {
      id: updated.id,
      materialId: updated.materialId,
      materialName: (updated as unknown as { material: { name: string } }).material.name,
      description: updated.description,
      quantity: updated.quantity,
      unit: updated.unit,
    };
  }

  // ── Delete Line Item ──────────────────────────────────────────────────────

  async deleteLineItem(rfqId: string, lineItemId: string, user: AuthenticatedUser) {
    const lineItem = await this.prisma.rfqLineItem.findUnique({
      where: { id: lineItemId },
      include: { rfq: { select: { companyId: true } } },
    });

    if (!lineItem || lineItem.rfqId !== rfqId) {
      throw new NotFoundException(ERR.rfqs.lineItemNotFound);
    }

    this.assertCompanyAccess(user, lineItem.rfq.companyId);

    await this.prisma.rfqLineItem.delete({ where: { id: lineItemId } });

    return { success: true };
  }

  // ── Upload RFQ Document ────────────────────────────────────────────────────

  async uploadDocument(rfqId: string, file: Express.Multer.File, user: AuthenticatedUser) {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));

    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { id: true, companyId: true },
    });
    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);
    this.assertCompanyAccess(user, rfq.companyId);

    const ext = path.extname(file.originalname);
    const key = `rfq-documents/${rfqId}/${randomUUID()}${ext}`;

    const result = await this.storageService.upload(key, file.buffer, file.mimetype);

    const fileRecord = await this.prisma.file.create({
      data: {
        bucket: result.bucket,
        key: result.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: user.id,
      },
    });

    const doc = await this.prisma.rfqDocument.create({
      data: { rfqId, fileId: fileRecord.id },
      include: {
        file: { include: { uploadedBy: { select: { id: true, name: true, email: true } } } },
      },
    });

    return {
      id: doc.id,
      name: doc.file.filename,
      fileId: doc.fileId,
      uploadedBy: {
        name: doc.file.uploadedBy.name,
        email: doc.file.uploadedBy.email,
        avatarUrl: null,
      },
      uploadedAt: doc.createdAt.toISOString(),
    };
  }

  // ── Delete RFQ Document ──────────────────────────────────────────────────

  async deleteDocument(rfqId: string, docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.rfqDocument.findFirst({
      where: { id: docId, rfqId },
      include: { file: true, rfq: { select: { companyId: true } } },
    });

    if (!doc) throw new NotFoundException(ERR.invoices.documentNotFound);
    this.assertCompanyAccess(user, doc.rfq.companyId);

    await this.storageService.delete(doc.file.key);
    await this.prisma.rfqDocument.delete({ where: { id: docId } });
    await this.prisma.file.delete({ where: { id: doc.fileId } });

    return { success: true };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildListWhere(query: RfqListQueryDto, user: AuthenticatedUser): Prisma.RfqWhereInput {
    const where: Prisma.RfqWhereInput = {};

    // Role-based scoping
    if (user.role === UserRole.VENDOR) {
      where.invitedVendors = { some: { vendor: { users: { some: { id: user.id } } } } };
    } else if (user.role !== UserRole.SUPER_ADMIN && user.companyId) {
      where.companyId = user.companyId;
    }

    // Quick filters
    if (query.quickFilter) {
      this.applyQuickFilter(where, query.quickFilter, user);
    }

    if (query.status) {
      if (user.role === UserRole.VENDOR) {
        this.applyVendorStatusFilter(where, query.status as VendorRfqStatus, user);
      } else {
        where.status = query.status as RfqStatus;
      }
    }
    if (query.projectId) where.projectId = query.projectId;

    if (query.search) {
      where.OR = [
        { id: { contains: query.search, mode: 'insensitive' } },
        { project: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query.deliveryLocation) {
      (where as Record<string, unknown>).deliveryLocationId = query.deliveryLocation;
    }

    if (query.createdByUserId) where.createdByUserId = query.createdByUserId;

    if (query.createdDateFrom || query.createdDateTo) {
      where.createdAt = {
        ...(query.createdDateFrom ? { gte: new Date(query.createdDateFrom) } : {}),
        ...(query.createdDateTo ? { lte: new Date(query.createdDateTo) } : {}),
      };
    }

    if (query.deadlineFrom) where.deadlineStart = { gte: new Date(query.deadlineFrom) };
    if (query.deadlineTo) where.deadlineEnd = { lte: new Date(query.deadlineTo) };

    return where;
  }

  private applyQuickFilter(
    where: Prisma.RfqWhereInput,
    quickFilter: string,
    user: AuthenticatedUser,
  ): void {
    const filter = quickFilter.charAt(0).toLowerCase() + quickFilter.slice(1);
    switch (filter) {
      case 'myRfqs':
        if (user.role !== UserRole.VENDOR) where.createdByUserId = user.id;
        break;
      case 'openRfqs':
      case 'incoming':
        where.status = RfqStatus.OPEN;
        break;
      case 'awaitingResponses':
        where.status = RfqStatus.AWAITING_RESPONSE;
        break;
      case 'noQuotes':
        where.quoteResponses = { none: {} };
        break;
      case 'awardedRfqs':
        where.status = RfqStatus.AWARDED;
        break;
      case 'closedRfqs':
        where.status = RfqStatus.CLOSED;
        break;
      case 'approvedForMe':
        where.quoteResponses = {
          some: {
            status: QuoteResponseStatus.APPROVED,
            vendor: { users: { some: { id: user.id } } },
          },
        };
        break;
    }
  }

  private buildOrderBy(
    sortBy: string,
    sortDir: 'asc' | 'desc',
  ): Prisma.RfqOrderByWithRelationInput {
    switch (sortBy) {
      case 'id':
        return { id: sortDir };
      case 'projectName':
        return { project: { name: sortDir } };
      case 'projectId':
        return { projectId: sortDir };
      case 'status':
        return { status: sortDir };
      case 'totalRequestedQty':
        return { totalRequestedQty: sortDir };
      case 'deadlineStart':
      case 'deadlineRange':
        return { deadlineStart: sortDir };
      case 'deliveryLocationId':
        return { deliveryLocationId: sortDir };
      case 'pickUpLocation':
        return { pickUpLocation: sortDir };
      case 'pickUp':
        return { pickUpDate: sortDir };
      case 'createdBy':
        return { createdBy: { name: sortDir } };
      case 'approvalStatus':
        return { approvalStatus: sortDir };
      case 'approvedBy':
        return { approvedBy: { name: sortDir } };
      case 'createdDate':
      default:
        return { createdAt: sortDir };
    }
  }

  // ── Email notifications ──────────────────────────────────────────────────

  private async generateInvitationTokensAndNotify(rfqId: string): Promise<void> {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: {
        rfqNumber: true,
        ccEmails: true,
        documents: {
          select: {
            file: { select: { key: true, filename: true, mimeType: true } },
          },
        },
        invitedVendors: {
          select: {
            id: true,
            vendor: {
              select: {
                id: true,
                users: {
                  where: { role: UserRole.VENDOR },
                  select: { email: true, status: true },
                },
              },
            },
          },
        },
      },
    });

    if (!rfq) return;

    const rfqNumber = rfq.rfqNumber ?? rfqId.slice(0, 8).toUpperCase();

    // Download the RFQ documents once so every vendor email carries the same
    // attachments without re-fetching from S3 per recipient.
    const attachments = await this.buildRfqAttachments(rfq.documents);
    const cc = rfq.ccEmails ?? [];

    // Generate short invitation codes for each vendor and send emails
    for (const iv of rfq.invitedVendors) {
      const token = await this.generateShortCode();

      await this.prisma.rfqVendor.update({
        where: { id: iv.id },
        data: { invitationToken: token },
      });

      // Build reply URL: if vendor has active users → link to vendor app,
      // otherwise → invitation link for guest access
      const hasActiveUser = iv.vendor.users.some((u) => u.status === 'ACTIVE');
      const replyUrl = hasActiveUser
        ? `${this.webAppUrl}/rfqs`
        : `${this.webAppUrl}/invitation/${token}`;

      const emails = iv.vendor.users.map((u) => u.email);

      await Promise.all(
        emails.map((email) =>
          this.emailService.sendRfqReceivedEmail(email, rfqNumber, replyUrl, { cc, attachments }),
        ),
      );
    }
  }

  /**
   * Download RFQ documents from object storage into in-memory attachments for
   * the outbound vendor emails. A document that fails to download is skipped so
   * one bad file never blocks the whole send.
   */
  private async buildRfqAttachments(
    documents: { file: { key: string; filename: string; mimeType: string } }[],
  ): Promise<EmailAttachment[]> {
    const settled = await Promise.all(
      documents.map(async ({ file }): Promise<EmailAttachment | null> => {
        try {
          const { body } = await this.storageService.getObject(file.key);
          if (!body) return null;
          return {
            filename: file.filename,
            content: body,
            contentType: file.mimeType,
          };
        } catch {
          return null;
        }
      }),
    );

    return settled.filter((a): a is EmailAttachment => a !== null);
  }

  async notifyContractorOfQuoteSubmission(rfqId: string, vendorName: string): Promise<void> {
    try {
      const rfq = await this.prisma.rfq.findUnique({
        where: { id: rfqId },
        select: {
          rfqNumber: true,
          companyId: true,
        },
      });

      if (!rfq) return;

      const contractors = await this.prisma.user.findMany({
        where: {
          companyId: rfq.companyId,
          role: { in: [UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER] },
          status: 'ACTIVE',
        },
        select: { email: true },
      });

      const rfqNumber = rfq.rfqNumber ?? rfqId.slice(0, 8).toUpperCase();
      const viewUrl = `${this.webAppUrl}/rfqs`;

      await Promise.all(
        contractors.map((u) =>
          this.emailService.sendQuoteSubmittedEmail(u.email, rfqNumber, vendorName, viewUrl),
        ),
      );
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async notifyContractorOfQuoteUpdate(rfqId: string, vendorName: string): Promise<void> {
    try {
      const rfq = await this.prisma.rfq.findUnique({
        where: { id: rfqId },
        select: {
          rfqNumber: true,
          companyId: true,
        },
      });

      if (!rfq) return;

      const contractors = await this.prisma.user.findMany({
        where: {
          companyId: rfq.companyId,
          role: { in: [UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER] },
          status: 'ACTIVE',
        },
        select: { email: true },
      });

      const rfqNumber = rfq.rfqNumber ?? rfqId.slice(0, 8).toUpperCase();

      const viewUrl = `${this.webAppUrl}/rfqs`;

      await Promise.all(
        contractors.map((u) =>
          this.emailService.sendQuoteUpdatedEmail(u.email, rfqNumber, vendorName, viewUrl),
        ),
      );
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  private async generateShortCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = randomBytes(10);
    const code = Array.from(bytes)
      .map((byte) => chars[byte % chars.length])
      .join('');

    const existing = await this.prisma.rfqVendor.findUnique({
      where: { invitationToken: code },
    });
    if (existing) return this.generateShortCode();
    return code;
  }

  // ── Access validation ───────────────────────────────────────────────────

  private assertCompanyAccess(user: AuthenticatedUser, companyId: string): void {
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
  }

  private async assertVendorsAssigned(
    vendorIds: string[],
    contractorId: string | null | undefined,
  ): Promise<void> {
    if (vendorIds.length === 0) return;
    if (!contractorId) throw new BadRequestException(ERR.rfqs.invalidVendorIds);

    const assignments = await this.prisma.companyVendorAssignment.findMany({
      where: {
        contractorId,
        vendorId: { in: vendorIds },
        vendor: { type: CompanyType.VENDOR },
      },
      select: { vendorId: true },
    });

    const assignedIds = new Set(assignments.map((a) => a.vendorId));
    if (assignedIds.size !== new Set(vendorIds).size) {
      throw new BadRequestException(ERR.rfqs.invalidVendorIds);
    }
  }

  private assertQuotePending(status: QuoteResponseStatus, action: string): void {
    if (status !== QuoteResponseStatus.PENDING) {
      throw new BadRequestException(ERR.rfqs.invalidQuoteAction(action, status));
    }
  }

  private async findQuoteOrFail(quoteId: string) {
    const quote = await this.prisma.quoteResponse.findUnique({
      where: { id: quoteId },
      include: { rfq: { select: { companyId: true } } },
    });
    if (!quote) throw new NotFoundException(ERR.rfqs.quoteNotFound);
    return quote;
  }

  private applyVendorStatusFilter(
    where: Prisma.RfqWhereInput,
    vendorStatus: VendorRfqStatus,
    user: AuthenticatedUser,
  ): void {
    const vendorUserFilter = { vendor: { users: { some: { id: user.id } } } };
    switch (vendorStatus) {
      case VendorRfqStatus.INCOMING:
        where.status = { in: [RfqStatus.OPEN, RfqStatus.AWAITING_RESPONSE] };
        where.quoteResponses = {
          some: { ...vendorUserFilter, status: QuoteResponseStatus.PENDING },
        };
        break;
      case VendorRfqStatus.RESPONDED:
        where.quoteResponses = {
          some: { ...vendorUserFilter, status: QuoteResponseStatus.SUBMITTED },
        };
        break;
      case VendorRfqStatus.APPROVED:
        where.quoteResponses = {
          some: { ...vendorUserFilter, status: QuoteResponseStatus.APPROVED },
        };
        break;
      case VendorRfqStatus.REJECTED:
        where.OR = [
          { status: RfqStatus.CANCELLED, quoteResponses: { some: vendorUserFilter } },
          {
            quoteResponses: { some: { ...vendorUserFilter, status: QuoteResponseStatus.DECLINED } },
          },
        ];
        break;
      case VendorRfqStatus.CLOSED:
        where.status = RfqStatus.CLOSED;
        break;
      default: {
        const rfqStatuses = VENDOR_STATUS_TO_RFQ[vendorStatus];
        if (rfqStatuses) where.status = { in: rfqStatuses };
      }
    }
  }

  private computeVendorStatus(
    rfq: { status: RfqStatus; quoteResponses: { vendorId: string; status: QuoteResponseStatus }[] },
    _userId: string,
  ): VendorRfqStatus {
    if (rfq.status === RfqStatus.CLOSED) return VendorRfqStatus.CLOSED;
    if (rfq.status === RfqStatus.CANCELLED) return VendorRfqStatus.REJECTED;

    // quoteResponses is already filtered to the vendor's own quote (take: 1)
    const vendorQuote = rfq.quoteResponses[0];
    if (vendorQuote) {
      if (vendorQuote.status === QuoteResponseStatus.APPROVED) return VendorRfqStatus.APPROVED;
      if (vendorQuote.status === QuoteResponseStatus.DECLINED) return VendorRfqStatus.REJECTED;
      if (vendorQuote.status === QuoteResponseStatus.SUBMITTED) return VendorRfqStatus.RESPONDED;
    }

    return VENDOR_STATUS_MAP[rfq.status] ?? VendorRfqStatus.INCOMING;
  }

  private async getFilteredRfqIdsByApprovedQuotes(
    baseWhere: Prisma.RfqWhereInput,
    minApprovedQuotes?: number,
    minApprovedVendors?: number,
  ): Promise<string[]> {
    const rfqs = await this.prisma.rfq.findMany({
      where: baseWhere,
      select: {
        id: true,
        quoteResponses: {
          where: { status: QuoteResponseStatus.APPROVED },
          select: { id: true, vendorId: true },
        },
      },
    });

    return rfqs
      .filter((rfq) => {
        const approvedCount = rfq.quoteResponses.length;
        const distinctVendors = new Set(rfq.quoteResponses.map((qr) => qr.vendorId)).size;
        if (minApprovedQuotes !== undefined && approvedCount < minApprovedQuotes) return false;
        if (minApprovedVendors !== undefined && distinctVendors < minApprovedVendors) return false;
        return true;
      })
      .map((rfq) => rfq.id);
  }
}
