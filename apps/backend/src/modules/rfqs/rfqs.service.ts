import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  CreateRfqDto,
  CreateRfqLineItemDto,
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
import {
  AccessTokenPurpose,
  AccessTokenSubject,
  CompanyType,
  PoSourceOfCreation,
  PoStatus,
  PoType,
  Prisma,
  QuoteAuditAction,
  QuoteLineItemAvailability,
  QuoteResponseStatus,
  RfqStatus,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { nextSequentialNumber } from '../../common/utils/sequential-number.util';
import { resolveVendorEmailRecipients } from '../../common/utils/vendor-recipients.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessTokensService } from '../access-tokens/access-tokens.service';
import { EmailAttachment, EmailService } from '../notifications/email.service';
import { StorageService } from '../storage/storage.service';

import { normalizeCcEmails } from './rfq-cc.util';
import {
  catalogMaterialIds,
  isValidRfqLineItemInput,
  normalizeRfqLineItem,
  resolveRfqLineItemMaterialName,
} from './rfq-line-item.util';
import { VENDOR_STATUS_MAP, VENDOR_STATUS_TO_RFQ } from './vendor-status.constants';

/** Prisma includes shared by list & detail queries */
const RFQ_LIST_INCLUDE = {
  project: { select: { id: true, name: true } },
  deliveryLocation: { select: { id: true, label: true, address: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  invitedVendors: { select: { vendor: { select: { id: true, legalName: true } } } },
  _count: { select: { lineItems: true, quoteResponses: true, invitedVendors: true } },
  quoteResponses: {
    select: {
      vendorId: true,
      status: true,
      totalCost: true,
      lineItems: { select: { status: true } },
    },
    distinct: ['vendorId' as const],
  },
} satisfies Prisma.RfqInclude;

const RFQ_DETAIL_INCLUDE = {
  project: { select: { id: true, name: true } },
  projects: { include: { project: { select: { id: true, name: true } } } },
  deliveryLocation: { select: { id: true, label: true, address: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  lineItems: {
    include: {
      material: { select: { id: true, name: true, uom: true } },
      project: { select: { id: true, name: true } },
      deliveryLocation: { select: { id: true, label: true, address: true } },
    },
  },
  quoteResponses: {
    include: {
      vendor: { select: { legalName: true } },
      _count: { select: { attachments: true } },
      lineItems: {
        select: { deliveryDate: true, availability: true, notes: true, status: true },
      },
    },
  },
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
    private readonly accessTokens: AccessTokensService,
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
      items: items.map((rfq) => {
        const rfqAny = rfq as Record<string, unknown>;
        const deliveryLocation = rfqAny.deliveryLocation as {
          label: string | null;
          address: string;
        } | null;
        const invitedVendors = (rfqAny.invitedVendors ?? []) as {
          vendor: { id: string; legalName: string };
        }[];
        const isPickUp = (rfqAny.isPickUp as boolean | undefined) ?? false;

        // PO/CA review metrics. Vendors get a trimmed quoteResponses select (no
        // totalCost / lineItems) and don't render these columns, so leave them empty.
        const responses = (rfqAny.quoteResponses ?? []) as Array<{
          status: string;
          totalCost?: Prisma.Decimal | null;
          lineItems?: { status: string }[];
        }>;
        const applVendors = isVendor ? 0 : responses.filter((r) => r.status === 'APPROVED').length;
        const approvedItems = isVendor
          ? 0
          : responses.reduce(
              (n, r) => n + (r.lineItems?.filter((li) => li.status === 'APPROVED').length ?? 0),
              0,
            );
        const declinedItems = isVendor
          ? 0
          : responses.reduce(
              (n, r) => n + (r.lineItems?.filter((li) => li.status === 'DECLINED').length ?? 0),
              0,
            );
        const receivedQuotes = isVendor ? [] : responses.filter((r) => r.status !== 'PENDING');
        const avgQuoteCost =
          receivedQuotes.length > 0
            ? receivedQuotes.reduce((sum, r) => sum + Number(r.totalCost ?? 0), 0) /
              receivedQuotes.length
            : null;

        return {
          id: rfq.id,
          rfqNumber: rfqAny.rfqNumber ?? null,
          projectName: rfq.project.name,
          projectId: rfq.projectId,
          /** Primary project (US 5.05 — RFQs may span several projects). */
          project: { id: rfq.projectId, name: rfq.project.name },
          status: isVendor ? this.computeVendorStatus(rfq, user.id) : rfq.status,
          reqQuantities: rfq.totalRequestedQty,
          isPickUp,
          pickUp: isPickUp || !!rfq.pickUpLocation,
          deliveryLocationId: rfqAny.deliveryLocationId ?? null,
          deliveryLocation: deliveryLocation
            ? (deliveryLocation.label ?? deliveryLocation.address)
            : null,
          pickUpLocation: rfq.pickUpLocation,
          recVendors: rfq.quoteResponses.length,
          recQuotes: rfq._count.quoteResponses,
          invitedVendors: rfq._count.invitedVendors,
          invitedVendorNames: invitedVendors.map((iv) => iv.vendor.legalName),
          applVendors,
          approvedItems,
          declinedItems,
          avgQuoteCost,
          lineItems: rfq._count.lineItems,
          deadlineRange:
            rfq.deadlineStart && rfq.deadlineEnd
              ? `${rfq.deadlineStart.toISOString().split('T')[0]} - ${rfq.deadlineEnd.toISOString().split('T')[0]}`
              : null,
          deadlineEnd: rfq.deadlineEnd?.toISOString() ?? null,
          applIssues: 0,
          totalRequestedQty: rfq.totalRequestedQty,
          arcBlocksDist: null,
          createdDate: rfq.createdAt.toISOString(),
          createdBy: rfq.createdBy.name,
          createdByUserId: rfq.createdByUserId,
          approvalStatus: rfq.approvalStatus,
          approvedBy: rfq.approvedBy?.name ?? null,
          lastModifiedBy: null,
        };
      }),
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
              _count: { select: { attachments: true } },
              lineItems: {
                select: { deliveryDate: true, availability: true, notes: true, status: true },
              },
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

    // All projects this RFQ spans (US 5.05), primary first.
    const rfqProjects = (rfqAny.projects ?? []) as { project: { id: string; name: string } }[];
    const projects = [
      { id: rfq.projectId, name: rfq.project.name },
      ...rfqProjects.map((rp) => rp.project).filter((p) => p.id !== rfq.projectId),
    ];
    const rfqDeliveryLocation = rfqAny.deliveryLocation as {
      label: string | null;
      address: string;
    } | null;
    const isPickUp = (rfqAny.isPickUp as boolean | undefined) ?? false;

    return {
      id: rfq.id,
      rfqNumber: rfqAny.rfqNumber ?? null,
      // Document name (US 5.05); legacy rows fall back to the project name.
      name: (rfqAny.name as string | null) ?? rfq.project.name,
      projectName: rfq.project.name,
      projectId: rfq.projectId,
      projects,
      projectIds: projects.map((p) => p.id),
      status: vendorStatus ?? rfq.status,
      isPickUp,
      pickUp: isPickUp || !!rfq.pickUpLocation,
      pickUpDate: rfq.pickUpDate?.toISOString() ?? null,
      deliveryLocationId: rfqAny.deliveryLocationId ?? null,
      deliveryLocation: rfqDeliveryLocation
        ? (rfqDeliveryLocation.label ?? rfqDeliveryLocation.address)
        : null,
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
      lineItems: rfq.lineItems.map((li) => {
        const liAny = li as Record<string, unknown>;
        const liProject = liAny.project as { id: string; name: string } | null | undefined;
        const liLocation = liAny.deliveryLocation as {
          id: string;
          label: string | null;
          address: string;
        } | null;
        const notes = (liAny.notes as string | null | undefined) ?? null;
        return {
          id: li.id,
          // Line-level project; falls back to the RFQ's primary project (US 5.05).
          projectId: (liAny.projectId as string | null | undefined) ?? null,
          projectName: liProject?.name ?? rfq.project.name,
          materialId: li.materialId,
          materialName: resolveRfqLineItemMaterialName(
            li as unknown as { material: { name: string } | null; materialName: string | null },
          ),
          description: li.description,
          notes,
          hasNotes: Boolean(notes),
          quantity: li.quantity,
          unit: li.unit,
          expectedDeliveryDate: liAny.expectedDeliveryDate
            ? (liAny.expectedDeliveryDate as Date).toISOString()
            : null,
          deliveryLocationId:
            (liAny.deliveryLocationId as string | null | undefined) ??
            rfqAny.deliveryLocationId ??
            null,
          deliveryLocation: liLocation
            ? (liLocation.label ?? liLocation.address)
            : rfqDeliveryLocation
              ? (rfqDeliveryLocation.label ?? rfqDeliveryLocation.address)
              : null,
        };
      }),
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
      quoteResponses: rfq.quoteResponses.map((qr) => {
        const qrAny = qr as unknown as {
          _count?: { attachments: number };
          lineItems?: {
            deliveryDate: Date | null;
            availability: string;
            notes: string | null;
            status: string;
          }[];
          bulkDeliveryTime?: Date | null;
        };
        // Committed delivery window across the lines the vendor actually quoted
        // (US 5.06 list cards show "Earliest Delivery: <min> - <max>").
        const deliveryTimes = (qrAny.lineItems ?? [])
          .filter((li) => li.availability !== 'NO_QUOTE' && li.deliveryDate)
          .map((li) => (li.deliveryDate as Date).getTime());
        const bulkTime = qrAny.bulkDeliveryTime ? qrAny.bulkDeliveryTime.getTime() : null;
        const allTimes = bulkTime !== null ? [bulkTime] : deliveryTimes;
        return {
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
          earliestDeliveryDate:
            allTimes.length > 0 ? new Date(Math.min(...allTimes)).toISOString() : null,
          latestDeliveryDate:
            allTimes.length > 0 ? new Date(Math.max(...allTimes)).toISOString() : null,
          attachmentCount: qrAny._count?.attachments ?? 0,
          hasNotes: (qrAny.lineItems ?? []).some((li) => !!li.notes) || !!qr.message,
        };
      }),
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
      include: { lineItems: true, projects: true },
    });

    if (!source) throw new NotFoundException(ERR.rfqs.notFound);
    this.assertCompanyAccess(user, source.companyId);

    const sourceAny = source as Record<string, unknown>;
    const sourceProjects = (sourceAny.projects ?? []) as { projectId: string }[];
    // Primary first, then any additional projects the source spanned.
    const projectIds = this.resolveProjectIds(source.projectId, [
      source.projectId,
      ...sourceProjects.map((p) => p.projectId),
    ]);
    const rfqNumber = await nextSequentialNumber(this.prisma, 'rfq', 'RFQ', source.companyId);
    const copy = await this.prisma.rfq.create({
      data: {
        rfqNumber,
        companyId: source.companyId,
        projectId: source.projectId,
        createdByUserId: user.id,
        status: RfqStatus.DRAFT,
        deliveryLocationId: sourceAny.deliveryLocationId as string | undefined,
        isPickUp: (sourceAny.isPickUp as boolean) ?? false,
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
        projects: {
          create: projectIds.map((projectId) => ({ projectId })),
        },
        lineItems: {
          create: source.lineItems.map((li) => ({
            materialId: (li as Record<string, unknown>).materialId as string | null,
            materialName: (li as Record<string, unknown>).materialName as string | null,
            quantity: li.quantity,
            unit: li.unit,
            description: li.description,
            notes: (li as Record<string, unknown>).notes as string | null,
            costCode: (li as Record<string, unknown>).costCode as string | undefined,
            pickUp: (li as Record<string, unknown>).pickUp as boolean | undefined,
            projectId: (li as Record<string, unknown>).projectId as string | null,
            deliveryLocationId: (li as Record<string, unknown>).deliveryLocationId as string | null,
            expectedDeliveryDate: (li as Record<string, unknown>)
              .expectedDeliveryDate as Date | null,
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

  /**
   * Validate a set of line items regardless of source (FOR-204): each must carry
   * a catalog material or a free-text name, and every referenced catalog
   * material id must exist. BOM-sourced lines (name only) skip the id check.
   */
  private async assertLineItemsValid(lineItems: CreateRfqLineItemDto[]) {
    if (lineItems.some((li) => !isValidRfqLineItemInput(li))) {
      throw new BadRequestException(ERR.rfqs.invalidLineItem);
    }
    const materialIds = catalogMaterialIds(lineItems);
    if (materialIds.length === 0) return;
    const uniqueIds = [...new Set(materialIds)];
    const materials = await this.prisma.material.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (materials.length !== uniqueIds.length) {
      throw new BadRequestException(ERR.rfqs.invalidMaterialIds);
    }
  }

  // ── Create RFQ ────────────────────────────────────────────────────────────

  async createRfq(dto: CreateRfqDto, user: AuthenticatedUser) {
    // The full ordered project set (US 5.05): first entry is the primary project.
    const projectIds = this.resolveProjectIds(dto.projectId, dto.projectIds);
    const primaryProjectId = projectIds[0];

    // Validate the primary project exists and belongs to user's company
    const project = await this.prisma.project.findUnique({
      where: { id: primaryProjectId },
      select: { id: true, companyId: true },
    });
    if (!project) throw new NotFoundException(ERR.rfqs.projectNotFound);
    this.assertCompanyAccess(user, project.companyId);

    // Validate the secondary projects belong to the same company
    await this.assertProjectsInCompany(projectIds.slice(1), project.companyId);

    // Validate deliveryLocationId belongs to one of the RFQ's projects
    const location = await this.prisma.projectLocation.findUnique({
      where: { id: dto.deliveryLocationId },
    });
    if (!location || !projectIds.includes(location.projectId)) {
      throw new BadRequestException(ERR.rfqs.invalidDeliveryLocation);
    }

    // Validate line items (catalog or BOM source) and their catalog material ids
    await this.assertLineItemsValid(dto.lineItems);
    this.assertLineItemProjectsInRfq(dto.lineItems, projectIds);
    await this.assertLineItemLocationsInRfq(dto.lineItems, projectIds);

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
          name: dto.name ?? null,
          companyId: user.companyId ?? '',
          projectId: primaryProjectId,
          createdByUserId: user.id,
          status: RfqStatus.DRAFT,
          currency: dto.currency ?? 'AUD',
          deliveryLocationId: dto.deliveryLocationId,
          needByDate: dto.needByDate ? new Date(dto.needByDate) : null,
          holdForRelease: dto.holdForRelease ?? false,
          earliestDeliveryDate: dto.earliestDeliveryDate
            ? new Date(dto.earliestDeliveryDate)
            : null,
          isPickUp: dto.isPickUp ?? false,
          pickUpLocation: dto.pickUpLocation ?? null,
          deadlineEnd: new Date(dto.deadlineEnd),
          message: dto.message,
          totalRequestedQty,
          lineItems: {
            create: dto.lineItems.map((li) => normalizeRfqLineItem(li)),
          },
          // The primary project always also appears in rfq_projects.
          projects: {
            create: projectIds.map((projectId) => ({ projectId })),
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
    // The full ordered project set (US 5.05): first entry is the primary project.
    const projectIds = this.resolveProjectIds(dto.projectId, dto.projectIds);
    const primaryProjectId = projectIds[0];

    // Validate the primary project exists and belongs to user's company
    const project = await this.prisma.project.findUnique({
      where: { id: primaryProjectId },
      select: { id: true, companyId: true },
    });
    if (!project) throw new NotFoundException(ERR.rfqs.projectNotFound);
    this.assertCompanyAccess(user, project.companyId);

    // Validate the secondary projects belong to the same company
    await this.assertProjectsInCompany(projectIds.slice(1), project.companyId);

    // Validate deliveryLocationId belongs to one of the RFQ's projects (when provided)
    if (dto.deliveryLocationId) {
      const location = await this.prisma.projectLocation.findUnique({
        where: { id: dto.deliveryLocationId },
      });
      if (!location || !projectIds.includes(location.projectId)) {
        throw new BadRequestException(ERR.rfqs.invalidDeliveryLocation);
      }
    }

    // Validate line items (catalog or BOM source) when provided
    if (dto.lineItems && dto.lineItems.length > 0) {
      await this.assertLineItemsValid(dto.lineItems);
      this.assertLineItemProjectsInRfq(dto.lineItems, projectIds);
      await this.assertLineItemLocationsInRfq(dto.lineItems, projectIds);
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
          name: dto.name ?? null,
          companyId: user.companyId ?? '',
          projectId: primaryProjectId,
          createdByUserId: user.id,
          status: RfqStatus.DRAFT,
          currency: dto.currency ?? 'AUD',
          deliveryLocationId: dto.deliveryLocationId ?? null,
          needByDate: dto.needByDate ? new Date(dto.needByDate) : null,
          holdForRelease: dto.holdForRelease ?? false,
          earliestDeliveryDate: dto.earliestDeliveryDate
            ? new Date(dto.earliestDeliveryDate)
            : null,
          isPickUp: dto.isPickUp ?? false,
          pickUpLocation: dto.pickUpLocation ?? null,
          deadlineEnd: dto.deadlineEnd ? new Date(dto.deadlineEnd) : null,
          message: dto.message,
          totalRequestedQty,
          // The primary project always also appears in rfq_projects.
          projects: {
            create: projectIds.map((projectId) => ({ projectId })),
          },
          ...(dto.lineItems && dto.lineItems.length > 0
            ? {
                lineItems: {
                  create: dto.lineItems.map((li) => normalizeRfqLineItem(li)),
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

    // Effective project set (US 5.05). When projectIds is provided it replaces
    // the stored set (first entry = primary); otherwise the stored set applies,
    // headed by the (possibly updated) primary projectId.
    const replacementProjectIds = dto.projectIds?.length
      ? this.resolveProjectIds(dto.projectIds[0], dto.projectIds)
      : null;
    const primaryProjectId = replacementProjectIds?.[0] ?? dto.projectId ?? rfq.projectId;

    let effectiveProjectIdsCache: string[] | null = replacementProjectIds;
    const getEffectiveProjectIds = async (): Promise<string[]> => {
      if (effectiveProjectIdsCache) return effectiveProjectIdsCache;
      const stored = await this.prisma.rfqProject.findMany({
        where: { rfqId: id },
        select: { projectId: true },
      });
      effectiveProjectIdsCache = [
        primaryProjectId,
        ...stored.map((s) => s.projectId).filter((p) => p !== primaryProjectId),
      ];
      return effectiveProjectIdsCache;
    };

    if (replacementProjectIds) {
      await this.assertProjectsInCompany(replacementProjectIds, rfq.companyId);
    }

    // Validate deliveryLocationId if provided — must belong to one of the RFQ's projects
    if (dto.deliveryLocationId) {
      const location = await this.prisma.projectLocation.findUnique({
        where: { id: dto.deliveryLocationId },
      });
      const projectIds = await getEffectiveProjectIds();
      if (!location || !projectIds.includes(location.projectId)) {
        throw new BadRequestException(ERR.rfqs.invalidDeliveryLocation);
      }
    }

    // Validate line items (catalog or BOM source) if provided
    if (dto.lineItems) {
      await this.assertLineItemsValid(dto.lineItems);
      const projectIds = await getEffectiveProjectIds();
      this.assertLineItemProjectsInRfq(dto.lineItems, projectIds);
      await this.assertLineItemLocationsInRfq(dto.lineItems, projectIds);
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
    if (dto.name !== undefined) rfqUpdateData.name = dto.name;
    if (dto.projectId !== undefined || replacementProjectIds) {
      rfqUpdateData.projectId = primaryProjectId;
    }
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
    if (dto.isPickUp !== undefined) rfqUpdateData.isPickUp = dto.isPickUp;
    if (dto.pickUpLocation !== undefined) rfqUpdateData.pickUpLocation = dto.pickUpLocation;
    if (dto.currency !== undefined) rfqUpdateData.currency = dto.currency;
    if (dto.message !== undefined) rfqUpdateData.message = dto.message;

    if (dto.lineItems) {
      // Recalculate totalRequestedQty
      const totalRequestedQty = dto.lineItems.reduce((sum, li) => sum + li.quantity, 0);
      rfqUpdateData.totalRequestedQty = totalRequestedQty;
    }

    const txOps: Prisma.PrismaPromise<unknown>[] = [];

    // Sync rfq_projects (US 5.05): replace the set when projectIds was given;
    // otherwise just keep the invariant that the primary project is present.
    if (replacementProjectIds) {
      txOps.push(this.prisma.rfqProject.deleteMany({ where: { rfqId: id } }));
      txOps.push(
        this.prisma.rfqProject.createMany({
          data: replacementProjectIds.map((projectId) => ({ rfqId: id, projectId })),
        }),
      );
    } else if (dto.projectId !== undefined) {
      txOps.push(
        this.prisma.rfqProject.createMany({
          data: [{ rfqId: id, projectId: dto.projectId }],
          skipDuplicates: true,
        }),
      );
    }

    // Delete + recreate line items if provided
    if (dto.lineItems) {
      txOps.push(this.prisma.rfqLineItem.deleteMany({ where: { rfqId: id } }));
      txOps.push(
        this.prisma.rfqLineItem.createMany({
          data: dto.lineItems.map((li) => ({ rfqId: id, ...normalizeRfqLineItem(li) })),
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.quoteResponse.update({
        where: { id: quoteId },
        data: { status: QuoteResponseStatus.APPROVED },
        include: { vendor: { select: { legalName: true } } },
      });

      await tx.rfq.update({
        where: { id: rfqId },
        data: { status: RfqStatus.AWARDED },
      });

      await tx.quoteAudit.create({
        data: {
          quoteResponseId: quoteId,
          rfqId,
          vendorId: quote.vendorId,
          action: QuoteAuditAction.APPROVED,
          source: quote.source,
          performedById: user.id,
        },
      });

      return result;
    });

    return {
      id: updated.id,
      vendorName: updated.vendor.legalName,
      status: updated.status,
      totalCost: Number(updated.totalCost),
    };
  }

  // ── Award Quote (FOR-209) ────────────────────────────────────────────────────

  /**
   * Award a received quote: approve it, mark the RFQ AWARDED, and auto-create a
   * draft Purchase Order pre-filled from the awarded quote's line items so the
   * contractor can review and issue it. The award decision is captured on the
   * RFQ's quote audit trail (APPROVED). The quote approval, RFQ status change,
   * audit entry and PO creation all run in one transaction so they are
   * all-or-nothing.
   */
  async awardQuote(rfqId: string, quoteId: string, user: AuthenticatedUser) {
    const quote = await this.prisma.quoteResponse.findUnique({
      where: { id: quoteId },
      include: {
        rfq: {
          select: {
            companyId: true,
            projectId: true,
            currency: true,
            deliveryLocationId: true,
            holdForRelease: true,
            deadlineStart: true,
            deadlineEnd: true,
          },
        },
        lineItems: {
          include: {
            rfqLineItem: {
              select: {
                materialId: true,
                materialName: true,
                unit: true,
                costCode: true,
                description: true,
                pickUp: true,
              },
            },
          },
        },
      },
    });
    if (!quote) throw new NotFoundException(ERR.rfqs.quoteNotFound);
    this.assertCompanyAccess(user, quote.rfq.companyId);
    this.assertQuoteAwardable(quote.status);

    // Derive PO lines from the awarded quote, dropping lines the vendor did not
    // actually quote (NO_QUOTE). qty × unit mirrors the PO module's line total.
    const poLineItems = quote.lineItems
      .filter((li) => li.availability !== QuoteLineItemAvailability.NO_QUOTE)
      .map((li, idx) => {
        const unitPrice = Number(li.unitPrice);
        return {
          lineNumber: idx + 1,
          materialId: li.rfqLineItem.materialId,
          description: li.rfqLineItem.description ?? li.rfqLineItem.materialName,
          quantityOrdered: li.quotedQuantity,
          unitOfMeasure: li.rfqLineItem.unit,
          unitPrice,
          lineTotal: li.quotedQuantity * unitPrice,
          costCode: li.rfqLineItem.costCode,
          expectedDeliveryDate: li.deliveryDate,
          notes: li.notes,
          pickUp: li.rfqLineItem.pickUp,
        };
      });

    const subtotal = poLineItems.reduce((sum, li) => sum + li.lineTotal, 0);
    const totalRequestedQty = poLineItems.reduce((sum, li) => sum + li.quantityOrdered, 0);
    // Number generated before the transaction, mirroring the PO module's own
    // creation path (count scoped to the contractor's company).
    const poNumber = await nextSequentialNumber(
      this.prisma,
      'purchaseOrder',
      'PO',
      quote.rfq.companyId,
    );

    const { quoteResult, purchaseOrder } = await this.prisma.$transaction(async (tx) => {
      const quoteResult = await tx.quoteResponse.update({
        where: { id: quoteId },
        data: { status: QuoteResponseStatus.APPROVED },
        include: { vendor: { select: { legalName: true } } },
      });

      await tx.rfq.update({
        where: { id: rfqId },
        data: { status: RfqStatus.AWARDED },
      });

      await tx.quoteAudit.create({
        data: {
          quoteResponseId: quoteId,
          rfqId,
          vendorId: quote.vendorId,
          action: QuoteAuditAction.APPROVED,
          source: quote.source,
          performedById: user.id,
        },
      });

      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          poNumber,
          companyId: quote.rfq.companyId,
          projectId: quote.rfq.projectId,
          vendorId: quote.vendorId,
          rfqId,
          createdByUserId: user.id,
          status: PoStatus.DRAFT,
          poType: PoType.STANDARD,
          sourceOfCreation: PoSourceOfCreation.RFQ,
          currency: quote.rfq.currency,
          deliveryLocationId: quote.rfq.deliveryLocationId,
          holdForRelease: quote.rfq.holdForRelease,
          deadlineStart: quote.rfq.deadlineStart,
          deadlineEnd: quote.rfq.deadlineEnd,
          message: quote.message,
          subtotal,
          totalAmount: subtotal,
          lineItemCount: poLineItems.length,
          totalRequestedQty,
          lineItems: { create: poLineItems },
        },
        select: { id: true, poNumber: true },
      });

      return { quoteResult, purchaseOrder };
    });

    // The PO is intentionally left as a DRAFT: the contractor reviews it and
    // issues it to the vendor manually from the PO detail page. Awarding a quote
    // does NOT auto-send the PO to the vendor.
    return {
      id: quoteResult.id,
      vendorName: quoteResult.vendor.legalName,
      status: quoteResult.status,
      totalCost: Number(quoteResult.totalCost),
      purchaseOrderId: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
    };
  }

  // ── Decline Quote ──────────────────────────────────────────────────────────

  async declineQuote(_rfqId: string, quoteId: string, user: AuthenticatedUser) {
    const quote = await this.findQuoteOrFail(quoteId);
    this.assertCompanyAccess(user, quote.rfq.companyId);
    this.assertQuotePending(quote.status, 'decline');

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.quoteResponse.update({
        where: { id: quoteId },
        data: { status: QuoteResponseStatus.DECLINED },
        include: { vendor: { select: { legalName: true } } },
      });

      await tx.quoteAudit.create({
        data: {
          quoteResponseId: quoteId,
          rfqId: quote.rfqId,
          vendorId: quote.vendorId,
          action: QuoteAuditAction.DECLINED,
          source: quote.source,
          performedById: user.id,
        },
      });

      return result;
    });

    return {
      id: updated.id,
      vendorName: updated.vendor.legalName,
      status: updated.status,
      totalCost: Number(updated.totalCost),
    };
  }

  // ── Approved RFQ responses for bulk-order creation (US 5.08) ──────────────

  /**
   * List a project's approved (awarded) RFQ quote responses, each with the
   * line items the vendor quoted, shaped for the "Create from approved RFQ
   * response" bulk-order page. A response is "approved" when its status is
   * APPROVED (set on award/approve). Only the contractor that owns the RFQs
   * (or a SUPER_ADMIN) can read them. NO_QUOTE lines are dropped — they carry
   * no price and cannot seed a bulk-order line.
   */
  async listApprovedResponses(projectId: string, user: AuthenticatedUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true },
    });
    if (!project) throw new NotFoundException(ERR.rfqs.projectNotFound);
    this.assertCompanyAccess(user, project.companyId);

    const responses = await this.prisma.quoteResponse.findMany({
      where: {
        status: QuoteResponseStatus.APPROVED,
        // The awarded quote may span several projects (US 5.05): include it when
        // the requested project is the RFQ's primary OR one of its line projects.
        rfq: {
          companyId: project.companyId,
          OR: [
            { projectId },
            { projects: { some: { projectId } } },
            { lineItems: { some: { projectId } } },
          ],
        },
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        vendor: { select: { id: true, legalName: true } },
        rfq: { select: { id: true, rfqNumber: true } },
        lineItems: {
          include: {
            rfqLineItem: {
              select: {
                materialId: true,
                materialName: true,
                description: true,
                unit: true,
                material: { select: { name: true, uom: true } },
              },
            },
          },
        },
      },
    });

    return responses.map((qr) => ({
      rfqId: qr.rfqId,
      responseId: qr.id,
      rfqReference: qr.rfq.rfqNumber ?? qr.rfqId,
      vendorId: qr.vendorId,
      vendorName: qr.vendor.legalName,
      discountPercent: qr.discountPercent ? Number(qr.discountPercent) : null,
      lineItems: qr.lineItems
        .filter((li) => li.availability !== QuoteLineItemAvailability.NO_QUOTE)
        .map((li) => {
          const unitPrice = Number(li.unitPrice);
          return {
            materialId: li.rfqLineItem.materialId,
            itemReference:
              li.rfqLineItem.material?.name ??
              li.rfqLineItem.materialName ??
              li.rfqLineItem.description ??
              '',
            description:
              li.rfqLineItem.description ??
              li.rfqLineItem.material?.name ??
              li.rfqLineItem.materialName ??
              '',
            unitPrice,
            uom: li.rfqLineItem.material?.uom ?? li.rfqLineItem.unit,
            quantity: li.quotedQuantity,
            discount: li.discount ? Number(li.discount) : null,
          };
        }),
    }));
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
      materialName: resolveRfqLineItemMaterialName(
        updated as unknown as { material: { name: string } | null; materialName: string | null },
      ),
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
        companyId: true,
        createdByUserId: true,
        ccEmails: true,
        needByDate: true,
        documents: {
          select: {
            file: { select: { key: true, filename: true, mimeType: true } },
          },
        },
        invitedVendors: {
          // Deterministic order so the send (and resulting email log) follows the
          // order vendors were invited, rather than arbitrary DB row order.
          orderBy: { invitedAt: 'asc' },
          select: {
            id: true,
            vendor: {
              select: {
                id: true,
                contactEmail: true,
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

    const ttlMs = this.invitationTokenTtlMs(rfq.needByDate);

    // Issue a single-use access token (A15) per vendor and send emails. The
    // token is presented in the guest invitation link and burned on submit.
    for (const iv of rfq.invitedVendors) {
      const { token } = await this.accessTokens.issueToken({
        subjectType: AccessTokenSubject.RFQ,
        subjectId: rfqId,
        purpose: AccessTokenPurpose.QUOTE_SUBMIT,
        ttlMs,
        // Generous attempt budget: the GET landing page validates (and bumps
        // attempts) on every load, so a vendor reviewing the RFQ before
        // submitting must not get locked out.
        maxAttempts: 50,
        metadata: { rfqVendorId: iv.id, vendorId: iv.vendor.id },
      });

      // Every vendor — registered or not — receives the tokenized guest link.
      // The token authorises viewing the RFQ and submitting a quote without a
      // login, and is scoped/audited/rate-limited per FOR-201 + ADR-0002. The
      // invitation endpoint also serves authenticated vendors, so there is no
      // need to branch on whether the vendor has an active user account.
      const replyUrl = `${this.webAppUrl}/invitation/${token}`;

      // Reach the vendor's user accounts, or fall back to the company contact
      // email when the vendor was quick-added without a user (US-3.01) — the
      // guest invitation link above is what those vendors use to respond.
      const emails = resolveVendorEmailRecipients(iv.vendor.users, iv.vendor.contactEmail);

      await Promise.all(
        emails.map((email) =>
          this.emailService.sendRfqReceivedEmail(email, rfqNumber, replyUrl, {
            cc,
            attachments,
            // Track each vendor email so it surfaces on the RFQ email log (FOR-213).
            log: { companyId: rfq.companyId, rfqId, sentByUserId: rfq.createdByUserId },
          }),
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

  /**
   * Lifetime for a vendor invitation token. Defaults to 30 days, but extends to
   * cover the RFQ need-by date (plus a 7-day grace) when that is further out, so
   * the link never expires before the vendor is expected to respond.
   */
  private invitationTokenTtlMs(needByDate: Date | null): number {
    const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
    const GRACE_MS = 7 * 24 * 60 * 60 * 1000;
    if (!needByDate) return DEFAULT_TTL_MS;
    const untilNeedBy = needByDate.getTime() - Date.now() + GRACE_MS;
    return Math.max(DEFAULT_TTL_MS, untilNeedBy);
  }

  // ── Access validation ───────────────────────────────────────────────────

  private assertCompanyAccess(user: AuthenticatedUser, companyId: string): void {
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
  }

  // ── Multi-project helpers (US 5.05) ───────────────────────────────────────

  /**
   * Resolve the ordered, de-duplicated project set for an RFQ. When the
   * optional `projectIds` array is present its first entry is the primary
   * project; otherwise the single `projectId` is the whole set.
   */
  private resolveProjectIds(projectId: string, projectIds?: string[]): string[] {
    const ids = projectIds && projectIds.length > 0 ? projectIds : [projectId];
    return [...new Set(ids)];
  }

  /** Every id must reference an existing project of `companyId` (400 otherwise). */
  private async assertProjectsInCompany(projectIds: string[], companyId: string): Promise<void> {
    if (projectIds.length === 0) return;
    const unique = [...new Set(projectIds)];
    const found = await this.prisma.project.findMany({
      where: { id: { in: unique }, companyId },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException(ERR.rfqs.invalidProjectIds);
    }
  }

  /** A line item's projectId (when set) must be one of the RFQ's projects. */
  private assertLineItemProjectsInRfq(
    lineItems: CreateRfqLineItemDto[],
    rfqProjectIds: string[],
  ): void {
    const allowed = new Set(rfqProjectIds);
    if (lineItems.some((li) => li.projectId && !allowed.has(li.projectId))) {
      throw new BadRequestException(ERR.rfqs.lineItemProjectNotInRfq);
    }
  }

  /**
   * A line item's deliveryLocationId (when set) must reference a location of
   * one of the RFQ's projects. Skips the query when no line carries one.
   */
  private async assertLineItemLocationsInRfq(
    lineItems: CreateRfqLineItemDto[],
    rfqProjectIds: string[],
  ): Promise<void> {
    const locationIds = [
      ...new Set(
        lineItems
          .map((li) => li.deliveryLocationId)
          .filter((id): id is string => Boolean(id?.trim())),
      ),
    ];
    if (locationIds.length === 0) return;

    const locations = await this.prisma.projectLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, projectId: true },
    });
    const allowed = new Set(rfqProjectIds);
    const validIds = new Set(
      locations.filter((loc) => allowed.has(loc.projectId)).map((loc) => loc.id),
    );
    if (locationIds.some((id) => !validIds.has(id))) {
      throw new BadRequestException(ERR.rfqs.invalidDeliveryLocation);
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

  /**
   * A quote can be approved/declined while it still awaits a decision — a
   * received (SUBMITTED) quote or a PENDING placeholder (US 5.06). Quotes that
   * were already approved or declined cannot transition again from here.
   */
  private assertQuotePending(status: QuoteResponseStatus, action: string): void {
    if (status !== QuoteResponseStatus.PENDING && status !== QuoteResponseStatus.SUBMITTED) {
      throw new BadRequestException(ERR.rfqs.invalidQuoteAction(action, status));
    }
  }

  /**
   * A quote can be awarded while it is still awaiting a decision — a received
   * (SUBMITTED) quote, or a PENDING placeholder. Already-APPROVED quotes (and
   * DECLINED ones) cannot be awarded again.
   */
  private assertQuoteAwardable(status: QuoteResponseStatus): void {
    if (status !== QuoteResponseStatus.SUBMITTED && status !== QuoteResponseStatus.PENDING) {
      throw new BadRequestException(ERR.rfqs.invalidQuoteAction('award', status));
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
