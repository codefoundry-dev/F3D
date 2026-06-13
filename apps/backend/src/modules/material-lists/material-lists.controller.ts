import {
  AddMaterialListItemsDto,
  CreateMaterialListDto,
  MaterialListsQueryDto,
  UpdateMaterialListDto,
} from '@forethread/shared-types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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

  // ── POST /v1/material-lists ───────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('materialList.create')
  @ApiOperation({ summary: 'Create a material list (US 4.03)' })
  @ApiResponse({ status: 201, description: 'Material list created' })
  async create(@Body() dto: CreateMaterialListDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createList(dto, user);
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

  // ── PATCH /v1/material-lists/:id ──────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions('materialList.update')
  @ApiOperation({ summary: 'Update a material list name/description (US 4.03)' })
  @ApiResponse({ status: 200, description: 'Material list updated' })
  @ApiResponse({ status: 404, description: 'Material list not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialListDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateList(id, dto, user);
  }

  // ── DELETE /v1/material-lists/:id ─────────────────────────────────────────

  @Delete(':id')
  @RequirePermissions('materialList.delete')
  @ApiOperation({ summary: 'Delete a material list (US 4.03)' })
  @ApiResponse({ status: 200, description: 'Material list deleted' })
  @ApiResponse({ status: 404, description: 'Material list not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteList(id, user);
  }

  // ── POST /v1/material-lists/:id/items ─────────────────────────────────────

  @Post(':id/items')
  @RequirePermissions('materialList.manageItems')
  @ApiOperation({ summary: 'Add catalogue materials to a material list (US 4.03)' })
  @ApiResponse({ status: 201, description: 'Items added; returns the updated list detail' })
  @ApiResponse({ status: 400, description: 'One or more material ids are invalid' })
  @ApiResponse({ status: 404, description: 'Material list not found' })
  async addItems(
    @Param('id') id: string,
    @Body() dto: AddMaterialListItemsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addItems(id, dto, user);
  }

  // ── DELETE /v1/material-lists/:id/items/:itemId ───────────────────────────

  @Delete(':id/items/:itemId')
  @RequirePermissions('materialList.manageItems')
  @ApiOperation({ summary: 'Remove an item from a material list (US 4.03)' })
  @ApiResponse({ status: 200, description: 'Item removed; returns the updated list detail' })
  @ApiResponse({ status: 404, description: 'Material list not found' })
  async removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeItem(id, itemId, user);
  }
}
