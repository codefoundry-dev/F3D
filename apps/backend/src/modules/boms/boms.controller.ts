import { BomListQueryDto, CreateBomDto } from '@forethread/shared-types';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { toBomDetailResponse, toBomListItemResponse } from './boms.mapper';
import { BomsService } from './boms.service';

@ApiTags('BOMs')
@ApiBearerAuth()
@Controller('boms')
export class BomsController {
  constructor(private readonly service: BomsService) {}

  // ── POST /v1/boms ─────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('bom.create')
  @ApiOperation({ summary: 'Create a project BOM from reviewed line items (US 5.01)' })
  @ApiResponse({ status: 201, description: 'BOM created; previous active BOM superseded' })
  @ApiResponse({ status: 400, description: 'Invalid items (unknown material)' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(@Body() dto: CreateBomDto, @CurrentUser() user: AuthenticatedUser) {
    const bom = await this.service.createBom(dto, user);
    return toBomDetailResponse(bom);
  }

  // ── GET /v1/boms?projectId= ───────────────────────────────────────────────

  @Get()
  @RequirePermissions('bom.read')
  @ApiOperation({ summary: 'List BOMs for the company, optionally scoped to a project' })
  @ApiResponse({ status: 200, description: 'BOMs, newest first' })
  async list(@Query() query: BomListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const boms = await this.service.listBoms(query.projectId, user);
    return boms.map(toBomListItemResponse);
  }

  // ── GET /v1/boms/:id ──────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('bom.read')
  @ApiOperation({ summary: 'Get a BOM with its line items' })
  @ApiResponse({ status: 200, description: 'BOM detail' })
  @ApiResponse({ status: 404, description: 'BOM not found' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const bom = await this.service.getBom(id, user);
    return toBomDetailResponse(bom);
  }
}
