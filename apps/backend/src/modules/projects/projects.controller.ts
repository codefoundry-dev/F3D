import {
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMembersDto,
  ProjectListQueryDto,
  PaginatedProjectsResponseDto,
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { ProjectAccessGuard } from './guards/project-access.guard';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ── GET /v1/projects ───────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('project.list')
  @ApiOperation({ summary: 'List projects accessible to the current user' })
  @ApiResponse({ status: 200, type: PaginatedProjectsResponseDto })
  async listProjects(@Query() query: ProjectListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.listProjects(query, user);
  }

  // ── POST /v1/projects ──────────────────────────────────────────────────────

  @Post()
  @RequirePermissions('project.create')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failure' })
  @ApiResponse({ status: 409, description: 'Project name already exists' })
  async createProject(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.createProject(dto, user);
  }

  // ── GET /v1/projects/:id ───────────────────────────────────────────────────

  @Get(':id')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Get project detail' })
  @ApiResponse({ status: 200, description: 'Project detail' })
  @ApiResponse({ status: 403, description: 'Not a project member' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProject(@Param('id') id: string) {
    return this.projectsService.getProject(id);
  }

  // ── PATCH /v1/projects/:id ─────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions('project.update')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Update project details' })
  @ApiResponse({ status: 200, description: 'Project updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition or validation failure' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'New name conflicts with existing project' })
  async updateProject(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.updateProject(id, dto, user);
  }

  // ── POST /v1/projects/:id/members ──────────────────────────────────────────

  @Post(':id/members')
  @RequirePermissions('project.manageMembers')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Add users to a project' })
  @ApiResponse({ status: 200, description: 'Members added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user IDs' })
  @ApiResponse({ status: 403, description: 'Only CompanyAdmin can manage members' })
  async addMembers(
    @Param('id') id: string,
    @Body() dto: AddProjectMembersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.addMembers(id, dto.userIds, user);
  }

  // ── DELETE /v1/projects/:id/members/:userId ────────────────────────────────

  @Delete(':id/members/:userId')
  @RequirePermissions('project.manageMembers')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Remove a user from a project' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot remove last member or auto-assigned creator' })
  @ApiResponse({ status: 403, description: 'Only CompanyAdmin can manage members' })
  @ApiResponse({ status: 404, description: 'User is not a member of this project' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.removeMember(id, userId, user);
  }

  // ── BOM stubs (Epic 7 — NOT IMPLEMENTED) ───────────────────────────────────

  @Get(':id/bom')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Get active BOM for a project (not yet implemented)' })
  @ApiResponse({ status: 501, description: 'BOM management is not yet available' })
  getBom() {
    return { success: false, error: 'BOM management is not yet available' };
  }

  @Post(':id/bom')
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ summary: 'Create or update project BOM (not yet implemented)' })
  @ApiResponse({ status: 501, description: 'BOM management is not yet available' })
  createBom() {
    return { success: false, error: 'BOM management is not yet available' };
  }
}
