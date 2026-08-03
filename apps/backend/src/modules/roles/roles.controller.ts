import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import {
  CreateCustomRoleDto,
  RolesService,
  UpdateCustomRoleDto,
  UpdateRolePermissionsDto,
} from './roles.service';

interface AuthUser {
  id: string;
  role: string;
  companyId: string | null;
}

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions/catalog')
  @RequirePermissions('role.list')
  @ApiOperation({ summary: 'List the canonical permission catalog' })
  @ApiResponse({ status: 200, description: 'Permission catalog' })
  listCatalog() {
    return { items: this.rolesService.listCatalog() };
  }

  @Get()
  @RequirePermissions('role.list')
  @ApiOperation({ summary: 'List built-in roles with permission counts' })
  @ApiResponse({ status: 200, description: 'Roles summary' })
  listRoles() {
    return this.rolesService.listRoles().then((items) => ({ items }));
  }

  // ── Custom roles (FOR-252) ────────────────────────────────────────────────
  // Declared before the ':role' param routes so "custom" is not parsed as a
  // built-in role name.

  @Get('custom')
  @RequirePermissions('role.list')
  @ApiOperation({ summary: "List the caller's company custom roles" })
  @ApiResponse({ status: 200, description: 'Custom roles summary' })
  listCustomRoles(@CurrentUser() user: AuthUser) {
    return this.rolesService.listCustomRoles(user.companyId).then((items) => ({ items }));
  }

  @Post('custom')
  @RequirePermissions('role.create')
  @ApiOperation({ summary: 'Create a custom role' })
  @ApiResponse({ status: 201, description: 'Created custom role detail' })
  @ApiResponse({ status: 400, description: 'Duplicate name or unknown permission key' })
  createCustomRole(
    @Body() dto: CreateCustomRoleDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? undefined;
    return this.rolesService.createCustomRole(user.companyId, dto, user.id, ip);
  }

  @Get('custom/:id')
  @RequirePermissions('role.list')
  @ApiOperation({ summary: 'Get a custom role with its permissions' })
  @ApiResponse({ status: 200, description: 'Custom role detail' })
  @ApiResponse({ status: 404, description: 'Unknown custom role' })
  getCustomRole(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.rolesService.getCustomRoleDetail(id, user.companyId);
  }

  @Put('custom/:id')
  @RequirePermissions('role.update')
  @ApiOperation({ summary: 'Update a custom role (name, description, permissions)' })
  @ApiResponse({ status: 200, description: 'Updated custom role detail' })
  @ApiResponse({ status: 400, description: 'Duplicate name or unknown permission key' })
  @ApiResponse({ status: 404, description: 'Unknown custom role' })
  updateCustomRole(
    @Param('id') id: string,
    @Body() dto: UpdateCustomRoleDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? undefined;
    return this.rolesService.updateCustomRole(id, user.companyId, dto, user.id, ip);
  }

  @Delete('custom/:id')
  @RequirePermissions('role.delete')
  @ApiOperation({ summary: 'Delete a custom role' })
  @ApiResponse({ status: 200, description: 'Custom role deleted' })
  @ApiResponse({ status: 404, description: 'Unknown custom role' })
  deleteCustomRole(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const ip = req.ip ?? req.socket.remoteAddress ?? undefined;
    return this.rolesService.deleteCustomRole(id, user.companyId, user.id, ip);
  }

  // ── Built-in roles ────────────────────────────────────────────────────────

  @Get(':role')
  @RequirePermissions('role.list')
  @ApiOperation({ summary: 'Get permissions granted to a role' })
  @ApiResponse({ status: 200, description: 'Role detail with permission keys' })
  @ApiResponse({ status: 404, description: 'Unknown role' })
  getRole(@Param('role') role: string) {
    return this.rolesService.getRoleDetail(role);
  }

  @Put(':role/permissions')
  @RequirePermissions('role.update')
  @ApiOperation({ summary: 'Replace the permissions granted to a role' })
  @ApiResponse({ status: 200, description: 'Updated role detail' })
  @ApiResponse({ status: 400, description: 'Unknown permission key or SUPER_ADMIN target' })
  @ApiResponse({ status: 404, description: 'Unknown role' })
  updatePermissions(
    @Param('role') role: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const ip = req.ip ?? req.socket.remoteAddress ?? undefined;
    return this.rolesService.updateRolePermissions(
      role,
      dto.permissionKeys,
      user.id,
      ip,
      dto.thresholds,
    );
  }
}
