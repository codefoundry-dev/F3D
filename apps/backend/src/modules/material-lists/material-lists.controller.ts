import { MaterialListsQueryDto } from '@forethread/shared-types';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { MaterialListsService } from './material-lists.service';

@ApiTags('Material Lists')
@ApiBearerAuth()
@Controller('material-lists')
export class MaterialListsController {
  constructor(private readonly service: MaterialListsService) {}

  // ── GET /v1/material-lists ────────────────────────────────────────────────

  @Get()
  @RequirePermissions('materialList.list')
  @ApiOperation({ summary: "List the company's saved material lists (US 5.05)" })
  @ApiResponse({ status: 200, description: 'Material lists, alphabetical' })
  async list(@Query() query: MaterialListsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listMaterialLists(query, user);
  }

  // ── GET /v1/material-lists/:id ────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('materialList.read')
  @ApiOperation({ summary: 'Get a material list with its items (US 5.05)' })
  @ApiResponse({ status: 200, description: 'Material list detail' })
  @ApiResponse({ status: 404, description: 'Material list not found' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getMaterialList(id, user);
  }
}
