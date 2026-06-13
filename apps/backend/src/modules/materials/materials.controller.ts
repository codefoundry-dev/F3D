import {
  CatalogueImportRequestDto,
  CreateMaterialDto,
  DetectMaterialDuplicatesDto,
  MaterialListQueryDto,
  RejectMaterialDto,
  ResolveMaterialChangeDto,
  UpdateMaterialDto,
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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MaterialChangeRequestStatus } from '@prisma/client';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { MaterialStatusService } from './material-status.service';
import { MaterialsService } from './materials.service';

@ApiTags('Materials')
@ApiBearerAuth()
@Controller('materials')
export class MaterialsController {
  constructor(
    private readonly materialsService: MaterialsService,
    private readonly materialStatusService: MaterialStatusService,
  ) {}

  // ── GET /v1/materials ───────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('material.list')
  @ApiOperation({ summary: 'List materials with search, filter, and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of materials' })
  async listMaterials(
    @Query() query: MaterialListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.listMaterials(query, user);
  }

  // ── GET /v1/materials/categories ────────────────────────────────────────────
  // NOTE: static routes MUST stay declared before the `:id` routes below so the
  // router does not match `/categories`, `/suggestions`, etc. as an `:id`.

  @Get('categories')
  @RequirePermissions('material.listCategories')
  @ApiOperation({ summary: 'List all material categories' })
  @ApiResponse({ status: 200, description: 'List of material categories' })
  async listCategories() {
    return this.materialsService.listCategories();
  }

  // ── GET /v1/materials/suggestions ───────────────────────────────────────────

  @Get('suggestions')
  @RequirePermissions('material.suggestions')
  @ApiOperation({ summary: 'Quick search for materials (autocomplete)' })
  @ApiResponse({ status: 200, description: 'List of matching materials (max 10)' })
  async suggestions(@Query('search') search: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialsService.suggestions(search ?? '', user);
  }

  // ── POST /v1/materials ──────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('material.create')
  @ApiOperation({ summary: 'Create a new material' })
  @ApiResponse({ status: 201, description: 'Material created' })
  @ApiResponse({ status: 409, description: 'Duplicate material name' })
  async createMaterial(@Body() dto: CreateMaterialDto, @CurrentUser() user: AuthenticatedUser) {
    return this.materialsService.createMaterial(dto, user);
  }

  // ── POST /v1/materials/catalogue-import ───────────────────────────────────────

  @Post('catalogue-import')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('material.import')
  @ApiOperation({ summary: 'Bulk-import materials from a confirmed catalogue extraction' })
  @ApiResponse({ status: 200, description: 'Catalogue import summary' })
  @ApiResponse({ status: 404, description: 'Extraction not found' })
  async importCatalogue(
    @Body() dto: CatalogueImportRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.importCatalogueFromExtraction(dto.extractionId, user);
  }

  // ── POST /v1/materials/detect-duplicates ──────────────────────────────────────

  @Post('detect-duplicates')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('material.detectDuplicates')
  @ApiOperation({ summary: 'Check candidate rows against the catalogue for duplicates' })
  @ApiResponse({ status: 200, description: 'Per-candidate duplicate matches' })
  async detectDuplicates(
    @Body() dto: DetectMaterialDuplicatesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.detectDuplicates(dto, user);
  }

  // ── GET /v1/materials/change-requests ─────────────────────────────────────────
  // NOTE: declared before `:id` so the literal `change-requests` is not matched
  // as an `:id`.

  @Get('change-requests')
  @RequirePermissions('material.listChangeRequests')
  @ApiOperation({ summary: 'List material change requests awaiting review' })
  @ApiResponse({ status: 200, description: 'List of change requests' })
  async listChangeRequests(@Query('status') status?: string) {
    return this.materialsService.listChangeRequests(
      status as MaterialChangeRequestStatus | undefined,
    );
  }

  // ── PATCH /v1/materials/change-requests/:changeId/approve ──────────────────────

  @Patch('change-requests/:changeId/approve')
  @RequirePermissions('material.approveChange')
  @ApiOperation({ summary: 'Approve a change request (applies the diff to the material)' })
  @ApiResponse({ status: 200, description: 'Change request approved' })
  @ApiResponse({ status: 404, description: 'Change request not found' })
  async approveChangeRequest(
    @Param('changeId') changeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.approveChangeRequest(changeId, user);
  }

  // ── PATCH /v1/materials/change-requests/:changeId/reject ───────────────────────

  @Patch('change-requests/:changeId/reject')
  @RequirePermissions('material.rejectChange')
  @ApiOperation({ summary: 'Reject a change request (discards it)' })
  @ApiResponse({ status: 200, description: 'Change request rejected' })
  @ApiResponse({ status: 404, description: 'Change request not found' })
  async rejectChangeRequest(
    @Param('changeId') changeId: string,
    @Body() dto: ResolveMaterialChangeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.rejectChangeRequest(changeId, dto, user);
  }

  // ── GET /v1/materials/:id ─────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('material.read')
  @ApiOperation({ summary: 'Read a single material' })
  @ApiResponse({ status: 200, description: 'Material detail' })
  @ApiResponse({ status: 404, description: 'Material not found' })
  async getMaterial(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialsService.getMaterialById(id, user);
  }

  // ── PATCH /v1/materials/:id ────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions('material.update')
  @ApiOperation({ summary: 'Update a material' })
  @ApiResponse({ status: 200, description: 'Material updated' })
  @ApiResponse({ status: 404, description: 'Material not found' })
  @ApiResponse({ status: 409, description: 'Duplicate material name' })
  async updateMaterial(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.updateMaterial(id, dto, user);
  }

  // ── PATCH /v1/materials/:id/approve ────────────────────────────────────────────

  @Patch(':id/approve')
  @RequirePermissions('material.approve')
  @ApiOperation({ summary: 'Approve a pending material (→ PUBLIC)' })
  @ApiResponse({ status: 200, description: 'Material approved' })
  async approveMaterial(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialStatusService.approve(id, user);
  }

  // ── PATCH /v1/materials/:id/reject ─────────────────────────────────────────────

  @Patch(':id/reject')
  @RequirePermissions('material.reject')
  @ApiOperation({ summary: 'Reject a pending material (→ ARCHIVED)' })
  @ApiResponse({ status: 200, description: 'Material rejected' })
  async rejectMaterial(
    @Param('id') id: string,
    @Body() dto: RejectMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialStatusService.reject(id, dto, user);
  }

  // ── PATCH /v1/materials/:id/archive ────────────────────────────────────────────

  @Patch(':id/archive')
  @RequirePermissions('material.archive')
  @ApiOperation({ summary: 'Archive a published material (→ ARCHIVED)' })
  @ApiResponse({ status: 200, description: 'Material archived' })
  async archiveMaterial(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialStatusService.archive(id, user);
  }

  // ── PATCH /v1/materials/:id/restore ────────────────────────────────────────────

  @Patch(':id/restore')
  @RequirePermissions('material.restore')
  @ApiOperation({ summary: 'Restore an archived material (→ PUBLIC)' })
  @ApiResponse({ status: 200, description: 'Material restored' })
  async restoreMaterial(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialStatusService.restore(id, user);
  }

  // ── DELETE /v1/materials/:id ───────────────────────────────────────────────────

  @Delete(':id')
  @RequirePermissions('material.delete')
  @ApiOperation({ summary: 'Delete a material (blocked when referenced)' })
  @ApiResponse({ status: 200, description: 'Material deleted' })
  @ApiResponse({ status: 409, description: 'Material is referenced by documents' })
  async deleteMaterial(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialsService.deleteMaterial(id, user);
  }

  // ── PUT /v1/materials/:id/favourite ────────────────────────────────────────────

  @Put(':id/favourite')
  @RequirePermissions('material.favourite')
  @ApiOperation({ summary: 'Add a material to the current user favourites (idempotent)' })
  @ApiResponse({ status: 200, description: 'Material favourited' })
  @ApiResponse({ status: 404, description: 'Material not found' })
  async addFavourite(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialsService.addFavourite(id, user);
  }

  // ── DELETE /v1/materials/:id/favourite ─────────────────────────────────────────

  @Delete(':id/favourite')
  @RequirePermissions('material.favourite')
  @ApiOperation({ summary: 'Remove a material from the current user favourites (no-op safe)' })
  @ApiResponse({ status: 200, description: 'Material unfavourited' })
  async removeFavourite(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialsService.removeFavourite(id, user);
  }
}
