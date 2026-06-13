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
 * / `material.restore`) is enforced on the controller; these methods are
 * SuperAdmin-only by virtue of those permissions and stay focused on the
 * state-machine rules.
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

  // ── Archive (PUBLIC → ARCHIVED) ──────────────────────────────────────────

  async archive(id: string, user: AuthenticatedUser): Promise<MaterialDetailDto> {
    await this.transition(id, MaterialStatus.PUBLIC, MaterialStatus.ARCHIVED);
    return this.materialsService.getMaterialById(id, user);
  }

  // ── Restore (ARCHIVED → PUBLIC or PENDING_APPROVAL) ───────────────────────

  async restore(id: string, user: AuthenticatedUser): Promise<MaterialDetailDto> {
    // An archived row's destination depends on its ownership (US 4.02): a
    // company-private row (company_id set) restores back to PENDING_APPROVAL —
    // it still needs catalogue approval to go public — while a public row
    // (company_id null) restores straight to PUBLIC.
    const material = await this.prisma.material.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!material) {
      throw new NotFoundException(ERR.materials.notFound);
    }

    if (material.status !== MaterialStatus.ARCHIVED) {
      throw new BadRequestException(ERR.materials.invalidStatusTransition(material.status));
    }

    const to =
      material.companyId !== null ? MaterialStatus.PENDING_APPROVAL : MaterialStatus.PUBLIC;

    await this.prisma.material.update({
      where: { id },
      data: { status: to },
    });

    return this.materialsService.getMaterialById(id, user);
  }

  // ── Shared transition guard ──────────────────────────────────────────────

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
