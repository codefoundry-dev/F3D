import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';

import { ViewsService } from './views.service';

@ApiTags('Views')
@ApiBearerAuth()
@Controller('views')
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  // ── GET /v1/views?tableName=rfqs ──────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List saved views for the current user' })
  @ApiResponse({ status: 200, description: 'List of saved views' })
  async listViews(@Query('tableName') tableName: string, @CurrentUser() user: AuthenticatedUser) {
    return this.viewsService.listViews(user.id, tableName);
  }

  // ── POST /v1/views ────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a saved view' })
  @ApiResponse({ status: 201, description: 'View created' })
  async createView(
    @Body()
    body: {
      name: string;
      tableName: string;
      visibleColumns?: string[];
      columnOrder?: string[];
      sortBy?: string;
      sortDir?: string;
      quickFilter?: string;
      groupBy?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.viewsService.createView(user.id, body);
  }

  // ── PATCH /v1/views/:id ───────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved view' })
  @ApiResponse({ status: 200, description: 'View updated' })
  @ApiResponse({ status: 404, description: 'View not found' })
  async updateView(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      visibleColumns?: string[];
      columnOrder?: string[];
      sortBy?: string | null;
      sortDir?: string | null;
      quickFilter?: string | null;
      groupBy?: string | null;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.viewsService.updateView(user.id, id, body);
  }

  // ── DELETE /v1/views/:id ──────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved view' })
  @ApiResponse({ status: 200, description: 'View deleted' })
  @ApiResponse({ status: 404, description: 'View not found' })
  async deleteView(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.viewsService.deleteView(user.id, id);
    return { message: 'View deleted' };
  }

  // ── DELETE /v1/views?tableName=rfqs ───────────────────────────────────────

  @Delete()
  @ApiOperation({ summary: 'Delete all saved views for a table' })
  @ApiResponse({ status: 200, description: 'All views deleted' })
  async deleteAllViews(
    @Query('tableName') tableName: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.viewsService.deleteAllViews(user.id, tableName);
    return { message: 'All views deleted' };
  }
}
