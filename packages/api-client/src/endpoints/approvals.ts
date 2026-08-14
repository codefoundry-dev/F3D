import type { AxiosRequestConfig } from 'axios';

import { getApiClient } from '../client';

import { INVOICES_PATHS, MATERIAL_REQUESTS_PATHS, PURCHASE_ORDERS_PATHS } from './paths';

// Approver Pool and Nomination (ADR-0006 amendment, 2026-08-07).
//
// The **Approver Pool** is authority: the ACTIVE users in the document's company
// whose effective approval grant covers its total. It is derived, never stored,
// and recomputed on every read — a frozen Pool would name approvers who then hit
// a 403, because authorisation is evaluated live at approve time.
//
// A **Nomination** is the opposite: the creator's recorded intent to route the
// document at specific Pool members. It persists, and it confers nothing —
// every Pool member can still approve a document they were not nominated for.
//
// One set of types serves both documents, so the UI is composed once rather than
// forked per entity.

/**
 * The documents that carry an Approver Pool. Mirrors the backend enum.
 *
 * MATERIAL_REQUEST (FOR-347) is the one member with no monetary value: its Pool
 * is everyone holding `materialRequest.approve`, not cap coverage.
 */
export type ApprovalEntityType = 'PURCHASE_ORDER' | 'INVOICE' | 'MATERIAL_REQUEST';

/** Approval state, deliberately separate from the document's own status. */
export type ApprovalStatusValue = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * One Pool member, as the nomination picker needs them.
 *
 * Deliberately carries no cap amount — the Pool is rendered to tenants, and
 * publishing per-user caps would expose the company's spend hierarchy and invite
 * approver-shopping.
 */
export interface ApproverPoolMember {
  id: string;
  name: string;
  /** Built-in role enum value; the client resolves its label from i18n. */
  role: string;
  /** Set when a custom role's grant replaced the built-in one (FOR-253). */
  customRoleName: string | null;
}

/**
 * Pool members collapsed to "role label + how many hold it" — the only shape the
 * pending panel renders. Naming an individual while pending would point the
 * chase at one person when the whole Pool is responsible.
 */
export interface ApproverPoolRoleGroup {
  role: string;
  customRoleName: string | null;
  count: number;
}

/** A creator's recorded intent to route this document at someone (FOR-306). */
export interface ApprovalNomination {
  userId: string;
  name: string;
  role: string;
  customRoleName: string | null;
  nominatedAt: string;
  nominatedById: string;
  /**
   * False when the nominee has since fallen out of the Pool (cap lowered,
   * deactivated). The Pool is live but a Nomination is frozen, so they render as
   * "no longer eligible" rather than silently disappearing.
   */
  stillEligible: boolean;
}

export interface ApproverPoolView {
  entityType: ApprovalEntityType;
  /** Null for a prospective Pool — the document does not exist yet (FOR-347). */
  entityId: string | null;
  approvalStatus: ApprovalStatusValue;
  /** Full membership — for the nomination picker only, never the pending panel. */
  members: ApproverPoolMember[];
  /** Roles + counts — what the pending panel shows. */
  roleGroups: ApproverPoolRoleGroup[];
  memberCount: number;
  /**
   * True when nobody's cap covers the total. Renders the FOR-302 fallback state
   * rather than an empty list.
   */
  isEmpty: boolean;
  /** The individual who approved/rejected — ADR-0006's audit needs a person. */
  resolvedBy: { id: string; name: string } | null;
  resolvedAt: string | null;
  nominations: ApprovalNomination[];
  /** True when the current user may add or withdraw nominations (creator only). */
  canNominate: boolean;
}

/**
 * Resolve the path trio for an entity type so callers stay entity-agnostic.
 * An explicit map (not a fallback chain) so an unmapped new entity type is a
 * compile error here rather than a silent resolve to the PO paths.
 */
const APPROVAL_PATHS: Record<
  ApprovalEntityType,
  Pick<typeof PURCHASE_ORDERS_PATHS, 'approverPool' | 'nominations' | 'nomination'>
> = {
  PURCHASE_ORDER: PURCHASE_ORDERS_PATHS,
  INVOICE: INVOICES_PATHS,
  MATERIAL_REQUEST: MATERIAL_REQUESTS_PATHS,
};

function pathsFor(entityType: ApprovalEntityType) {
  return APPROVAL_PATHS[entityType];
}

/**
 * A document's Approver Pool, its nominees, and who resolved it.
 *
 * Gated on the document's own read permission, not its approve permission: the
 * creator needs to see who they are waiting on without holding approval
 * authority themselves.
 */
export async function getApproverPool(
  entityType: ApprovalEntityType,
  entityId: string,
  options?: {
    /**
     * Preview the Pool for this total instead of the document's saved one.
     *
     * The invoice nomination picker uses it while the reviewer is still editing:
     * the Pool depends on the amount, so offering the *old* total's members
     * would list people who cannot approve the figure about to be saved.
     */
    amount?: number | null;
  },
  config?: AxiosRequestConfig,
): Promise<ApproverPoolView> {
  const amount = options?.amount;
  const requestConfig: AxiosRequestConfig =
    amount === undefined || amount === null
      ? { ...config }
      : { ...config, params: { ...(config?.params as Record<string, unknown>), amount } };

  const { data } = await getApiClient().get<{ data: ApproverPoolView }>(
    pathsFor(entityType).approverPool(entityId),
    requestConfig,
  );
  return data.data;
}

/**
 * The Approver Pool a *new* material request would be routed to (FOR-347).
 *
 * The MR wizard creates-and-submits in one call, so the requester picks
 * approvers before any document exists. An MR Pool depends only on the
 * caller's company — it has no amount — so this prospective Pool is identical
 * to every real MR's Pool. Returns a view with `entityId: null` and no
 * nominations. Material requests only.
 */
export async function getProspectiveApproverPool(
  entityType: 'MATERIAL_REQUEST',
  config?: AxiosRequestConfig,
): Promise<ApproverPoolView> {
  void entityType; // single-entity today; the parameter keeps call sites explicit
  const { data } = await getApiClient().get<{ data: ApproverPoolView }>(
    MATERIAL_REQUESTS_PATHS.PROSPECTIVE_APPROVER_POOL,
    config,
  );
  return data.data;
}

/**
 * Nominate Pool members on a document already awaiting approval (FOR-308).
 *
 * Append-only and idempotent: re-nominating an existing nominee is a no-op
 * rather than a fresh email. Nominating outside the Pool is rejected
 * server-side — a Nomination can only ever narrow, never widen.
 */
export async function addApprovalNominations(
  entityType: ApprovalEntityType,
  entityId: string,
  body: { userIds: string[] },
  config?: AxiosRequestConfig,
): Promise<ApproverPoolView> {
  const { data } = await getApiClient().post<{ data: ApproverPoolView }>(
    pathsFor(entityType).nominations(entityId),
    body,
    config,
  );
  return data.data;
}

/**
 * Withdraw a nomination the caller made. Authority is untouched — the withdrawn
 * user keeps their place in the Pool and the document stays in their queue.
 */
export async function withdrawApprovalNomination(
  entityType: ApprovalEntityType,
  entityId: string,
  userId: string,
  config?: AxiosRequestConfig,
): Promise<ApproverPoolView> {
  const { data } = await getApiClient().delete<{ data: ApproverPoolView }>(
    pathsFor(entityType).nomination(entityId, userId),
    config,
  );
  return data.data;
}
