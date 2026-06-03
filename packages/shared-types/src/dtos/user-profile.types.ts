// Dependency-free current-user profile types (no class-validator /
// @nestjs/swagger). Safe to ship to the browser via the client barrel.

import type { UserRole, UserStatus } from '../enums';

/**
 * Shape returned by `GET /users/me` (the authenticated user's own profile).
 * Only the fields the frontend relies on are modelled here.
 */
export interface MeProfileResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  position: string | null;
  phone: string | null;
  avatarUrl: string | null;
  companyId: string | null;
  company: { id: string; legalName: string; type: string } | null;
  permissions: string[];
  /**
   * FOR-210: the current user's `po.approve` threshold (in the company's
   * currency). `null` means unlimited (no cap) — e.g. SUPER_ADMIN or an
   * uncapped grant. `0` means the role lacks the `po.approve` grant, so any
   * positive PO total requires approval before sending.
   */
  poApprovalThreshold: number | null;
}
