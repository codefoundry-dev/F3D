import { CreateMaterialDto, MaterialListQueryDto } from '@forethread/shared-types';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';

import { MaterialsService } from './materials.service';

@ApiTags('Materials')
@ApiBearerAuth()
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  // ── GET /v1/materials ───────────────────────────────────────────────────────

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PROCUREMENT_OFFICER,
    UserRole.FINANCIAL_OFFICER,
    UserRole.WAREHOUSE_OFFICER,
    UserRole.FOREMAN,
    UserRole.VENDOR,
  )
  @ApiOperation({ summary: 'List materials with search, filter, and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of materials' })
  async listMaterials(
    @Query() query: MaterialListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialsService.listMaterials(query, user);
  }

  // ── GET /v1/materials/categories ────────────────────────────────────────────

  @Get('categories')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PROCUREMENT_OFFICER,
    UserRole.FINANCIAL_OFFICER,
    UserRole.WAREHOUSE_OFFICER,
    UserRole.FOREMAN,
    UserRole.VENDOR,
  )
  @ApiOperation({ summary: 'List all material categories' })
  @ApiResponse({ status: 200, description: 'List of material categories' })
  async listCategories() {
    return this.materialsService.listCategories();
  }

  // ── GET /v1/materials/suggestions ───────────────────────────────────────────

  @Get('suggestions')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.PROCUREMENT_OFFICER,
    UserRole.FINANCIAL_OFFICER,
    UserRole.WAREHOUSE_OFFICER,
    UserRole.FOREMAN,
    UserRole.VENDOR,
  )
  @ApiOperation({ summary: 'Quick search for materials (autocomplete)' })
  @ApiResponse({ status: 200, description: 'List of matching materials (max 10)' })
  async suggestions(@Query('search') search: string) {
    return this.materialsService.suggestions(search ?? '');
  }

  // ── POST /v1/materials ──────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
  @ApiOperation({ summary: 'Create a new material' })
  @ApiResponse({ status: 201, description: 'Material created' })
  @ApiResponse({ status: 409, description: 'Duplicate material name' })
  async createMaterial(@Body() dto: CreateMaterialDto, @CurrentUser() user: AuthenticatedUser) {
    return this.materialsService.createMaterial(dto, user);
  }
}
