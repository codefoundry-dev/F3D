import { ApprovalEntityType } from '@prisma/client';

/**
 * The documents that carry an Approver Pool (ADR-0006 amendment). Each maps to
 * the permission whose grant defines authority over it, so every Pool operation
 * is one implementation parameterised by this map.
 *
 * `materialRequest.approve` is the one non-threshold-aware key here (FOR-347):
 * an MR carries no monetary value, so its Pool is grant membership rather than
 * cap coverage — `resolveApproverPool` ignores caps for non-threshold keys.
 */
export const APPROVAL_ENTITY_CONFIG = {
  PURCHASE_ORDER: {
    permissionKey: 'po.approve' as const,
    /** Audit actions that terminate the approval, newest wins. */
    resolvedActions: ['PO_APPROVED', 'PO_DECLINED'] as const,
    auditTargetType: 'PurchaseOrder',
  },
  INVOICE: {
    permissionKey: 'invoice.approve' as const,
    resolvedActions: ['INVOICE_APPROVED', 'INVOICE_REJECTED'] as const,
    auditTargetType: 'Invoice',
  },
  MATERIAL_REQUEST: {
    permissionKey: 'materialRequest.approve' as const,
    resolvedActions: ['MATERIAL_REQUEST_APPROVED', 'MATERIAL_REQUEST_DECLINED'] as const,
    auditTargetType: 'MaterialRequest',
  },
} satisfies Record<
  ApprovalEntityType,
  { permissionKey: string; resolvedActions: readonly string[]; auditTargetType: string }
>;

/** One Pool member, as the nomination picker needs them. Never carries a cap. */
export interface ApproverPoolMemberView {
  id: string;
  name: string;
  /** Built-in role enum; the client resolves its label from i18n. */
  role: string;
  /** Set when a custom role's grant replaced the built-in one (FOR-253). */
  customRoleName: string | null;
}

/**
 * Pool members collapsed to "role label + how many hold it" — the only shape the
 * pending panel renders. Naming an individual while pending would invite
 * approver-shopping; a cap amount would publish the company's spend hierarchy.
 */
export interface ApproverPoolRoleGroupView {
  role: string;
  customRoleName: string | null;
  count: number;
}

/** A creator's recorded intent to route this document at someone (FOR-306). */
export interface ApprovalNominationView {
  userId: string;
  name: string;
  role: string;
  customRoleName: string | null;
  nominatedAt: string;
  nominatedById: string;
  /**
   * False when the nominee has since fallen out of the Pool (cap lowered,
   * deactivated). The Pool is live but a Nomination is frozen, so they render
   * as "no longer eligible" rather than silently disappearing.
   */
  stillEligible: boolean;
}

export interface ApproverPoolView {
  entityType: ApprovalEntityType;
  /** Null for a prospective Pool — the document does not exist yet (FOR-347). */
  entityId: string | null;
  /** NOT_REQUIRED | PENDING | APPROVED | REJECTED. */
  approvalStatus: string;
  /** Full membership — for the nomination picker only. */
  members: ApproverPoolMemberView[];
  /** Roles + counts — what the pending panel shows. */
  roleGroups: ApproverPoolRoleGroupView[];
  memberCount: number;
  /**
   * True when nobody's cap covers the total. Renders the FOR-302 fallback state
   * ("no one can approve this — raise a limit or reduce the document") rather
   * than an empty list.
   */
  isEmpty: boolean;
  /** The individual who approved/rejected — ADR-0006 audit demands a person. */
  resolvedBy: { id: string; name: string } | null;
  resolvedAt: string | null;
  nominations: ApprovalNominationView[];
  /** True when the current user may add or withdraw nominations (creator only). */
  canNominate: boolean;
}
