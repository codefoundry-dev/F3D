import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { RolesService, UpdateRolePermissionsDto } from './roles.service';

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
    const ip = (req.ip ?? req.socket.remoteAddress) ?? undefined;
    return this.rolesService.updateRolePermissions(
      role,
      dto.permissionKeys,
      user.id,
      ip,
      dto.thresholds,
    );
  }
}
