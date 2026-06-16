import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { ListStockBalanceQueryDto, ListStockMovementQueryDto } from './inventory.dto';
import { InventoryService } from './inventory.service';

/**
 * Read-only inventory endpoints (Epic 7). Movements are created exclusively by
 * the PO-receipt (push-in) and MR-approval (push-out) hooks — there is no direct
 * POST to write a movement. Every query is company-scoped in the service.
 */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── GET /v1/inventory/balances ─────────────────────────────────────────────

  @Get('balances')
  @RequirePermissions('inventory.viewBalances')
  @ApiOperation({ summary: 'List on-hand stock balances per material and location' })
  @ApiResponse({ status: 200, description: 'On-hand balances' })
  async getBalances(
    @Query() query: ListStockBalanceQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.getBalances(user, query);
  }

  // ── GET /v1/inventory/movements ────────────────────────────────────────────

  @Get('movements')
  @RequirePermissions('inventory.viewMovements')
  @ApiOperation({ summary: 'List inventory movements (ledger), newest first' })
  @ApiResponse({ status: 200, description: 'Inventory movement ledger' })
  async listMovements(
    @Query() query: ListStockMovementQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.listMovements(user, query);
  }
}
