import { type MaterialDetailDto, RejectMaterialDto } from '@forethread/shared-types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MaterialStatus, Prisma } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

import { MaterialsService } from './materials.service';

/**
 * Catalogue lifecycle transitions for a single material (US 4.01). Mirrors the
 * PoStatusService structure: each method asserts the legal source status, makes
 * the transition, and returns the refreshed material detail.
 *
 * Permission gating (`material.approve` / `material.reject` / `material.archive`
 * / `material.restore`) is enforced on the controller. Approve / reject stay
 * SuperAdmin-only by virtue of their permissions; archive / restore are also
 * granted to Company-Admin / Procurement-Officer, so those two additionally run
 * `assertCanManageMaterial` — a company may only archive or restore rows it owns.
 */
@Injectable()
export class MaterialStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly materialsService: MaterialsService,
  ) {}

  // ── Approve (PENDING_APPROVAL → PUBLIC) ──────────────────────────────────

  async approve(id: string, user: AuthenticatedUser): Promise<MaterialDetailDto> {
    // Approving promotes a row into the shared catalogue: it becomes PUBLIC and
    // sheds its owning company (company_id → null), so a previously company-
    // private contribution (US 4.02) is now visible to everyone. `disconnect`
    // clears the optional company relation (FK → null).
    await this.transition(id, MaterialStatus.PENDING_APPROVAL, MaterialStatus.PUBLIC, {
      company: { disconnect: true },
    });
    return this.materialsService.getMaterialById(id, user);
  }

  // ── Reject (PENDING_APPROVAL → ARCHIVED) ─────────────────────────────────

  async reject(
    id: string,
    _dto: RejectMaterialDto | undefined,
    user: AuthenticatedUser,
  ): Promise<MaterialDetailDto> {
    // The optional `reason` is accepted by the API but not persisted this phase
    // (no reason column yet — Phase 3 introduces the change-request audit trail).
    await this.transition(id, MaterialStatus.PENDING_APPROVAL, MaterialStatus.ARCHIVED);
    return this.materialsService.getMaterialById(id, user);
  }

  // ── Archive (PUBLIC or PRIVATE → ARCHIVED) ───────────────────────────────

  async archive(id: string, user: AuthenticatedUser): Promise<MaterialDetailDto> {
    // Both a published row and a company's own PRIVATE row can be archived — a
    // company needs this to retire a material a document already references (and
    // which therefore cannot be hard-deleted). Ownership is enforced below: a
    // contractor archiving a PUBLIC row gets a 403.
    const material = await this.load(id);

    if (material.status !== MaterialStatus.PUBLIC && material.status !== MaterialStatus.PRIVATE) {
      throw new BadRequestException(ERR.materials.invalidStatusTransition(material.status));
    }

    this.materialsService.assertCanManageMaterial(material, user);

    await this.prisma.material.update({
      where: { id },
      data: { status: MaterialStatus.ARCHIVED },
    });

    return this.materialsService.getMaterialById(id, user);
  }

  // ── Restore (ARCHIVED → PUBLIC or PRIVATE) ───────────────────────────────

  async restore(id: string, user: AuthenticatedUser): Promise<MaterialDetailDto> {
    // An archived row's destination depends on its ownership: a company-owned row
    // (company_id set) restores to PRIVATE, back into that company's own
    // catalogue, while a public row (company_id null) restores straight to PUBLIC.
    const material = await this.load(id);

    if (material.status !== MaterialStatus.ARCHIVED) {
      throw new BadRequestException(ERR.materials.invalidStatusTransition(material.status));
    }

    // An ARCHIVED row is invisible to a contractor unless it is their own, so the
    // guard runs on ownership alone: a company restores only what it owns.
    this.materialsService.assertCanManageMaterial(material, user);

    const to = material.companyId !== null ? MaterialStatus.PRIVATE : MaterialStatus.PUBLIC;

    await this.prisma.material.update({
      where: { id },
      data: { status: to },
    });

    return this.materialsService.getMaterialById(id, user);
  }

  // ── Shared transition guard ──────────────────────────────────────────────

  /** Load the status + owning company of a material, 404-ing when it is missing. */
  private async load(
    id: string,
  ): Promise<{ id: string; status: MaterialStatus; companyId: string | null }> {
    const material = await this.prisma.material.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!material) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    return material;
  }

  /**
   * Load the material, assert it is in `from`, then move it to `to`. `extraData`
   * is merged into the update (e.g. clearing company_id on approval).
   */
  private async transition(
    id: string,
    from: MaterialStatus,
    to: MaterialStatus,
    extraData: Prisma.MaterialUpdateInput = {},
  ): Promise<void> {
    const material = await this.prisma.material.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!material) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    if (material.status !== from) {
      throw new BadRequestException(ERR.materials.invalidStatusTransition(material.status));
    }

    await this.prisma.material.update({
      where: { id },
      data: { status: to, ...extraData },
    });
  }
}
