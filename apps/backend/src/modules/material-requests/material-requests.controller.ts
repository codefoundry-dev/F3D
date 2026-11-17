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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApprovalEntityType } from '@prisma/client';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';
import { NominateApproversDto } from '../approvals/approvals.dto';
import { ApprovalsService } from '../approvals/approvals.service';
import { LinePhotoService } from '../storage/line-photo.service';

import {
  ConvertToPoDto,
  ConvertToRfqDto,
  CreateMaterialRequestDto,
  DeclineMaterialRequestDto,
  ListMaterialRequestQueryDto,
  SubmitMaterialRequestDto,
  UpdateMaterialRequestDto,
} from './material-requests.dto';
import { MaterialRequestsService } from './material-requests.service';

@ApiTags('Material Requests')
@ApiBearerAuth()
@Controller('material-requests')
export class MaterialRequestsController {
  constructor(
    private readonly materialRequestsService: MaterialRequestsService,
    private readonly approvalsService: ApprovalsService,
    private readonly linePhotos: LinePhotoService,
  ) {}

  // ── POST /v1/material-requests ─────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('materialRequest.create')
  @ApiOperation({ summary: 'Create a new material request' })
  @ApiResponse({ status: 201, description: 'Material request created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(@Body() dto: CreateMaterialRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.create(user, dto);
  }

  // ── POST /v1/material-requests/line-photos ─────────────────────────────────

  @Post('line-photos')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('materialRequest.create')
  @ApiOperation({
    summary: 'Upload a photo for a request line; send the returned fileId as photoFileId',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Photo uploaded' })
  @ApiResponse({ status: 400, description: 'Missing file, not an image, or too large' })
  async uploadLinePhoto(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.linePhotos.upload(file, user.id);
  }

  // ── GET /v1/material-requests ──────────────────────────────────────────────

  @Get()
  @RequirePermissions('materialRequest.list')
  @ApiOperation({ summary: 'List material requests accessible to the current user' })
  @ApiResponse({ status: 200, description: 'Material requests' })
  async list(@Query() query: ListMaterialRequestQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.list(user, query);
  }

  // ── GET /v1/material-requests/approver-pool ────────────────────────────────
  // NOTE: Must be before the :id route so "approver-pool" is not matched as an id.

  @Get('approver-pool')
  @RequirePermissions('materialRequest.create')
  @ApiOperation({
    summary: 'The Approver Pool a new material request would be routed to (FOR-347)',
    description:
      'A prospective Pool: the wizard creates-and-submits in one call, so the ' +
      'requester picks approvers before any MR exists. An MR Pool depends only ' +
      'on the company (there is no amount), so this is identical to every real ' +
      "MR's Pool. Gated on materialRequest.create — the audience is requesters.",
  })
  @ApiResponse({ status: 200, description: 'Prospective Approver Pool view (entityId null)' })
  async getProspectiveApproverPool(@CurrentUser() user: AuthenticatedUser) {
    return this.approvalsService.getProspectivePool(ApprovalEntityType.MATERIAL_REQUEST, user);
  }

  // ── GET /v1/material-requests/:id ──────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('materialRequest.read')
  @ApiOperation({ summary: 'Get a single material request by ID' })
  @ApiResponse({ status: 200, description: 'Material request detail' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.get(id, user);
  }

  // ── GET /v1/material-requests/:id/audit ────────────────────────────────────

  @Get(':id/audit')
  @RequirePermissions('materialRequest.read')
  @ApiOperation({ summary: 'Get the audit/activity trail for a material request' })
  @ApiResponse({ status: 200, description: 'Chronological audit entries for the MR' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async getAuditTrail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.getAuditTrail(id, user);
  }

  // ── PATCH /v1/material-requests/:id ────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions('materialRequest.update')
  @ApiOperation({ summary: 'Update a draft material request' })
  @ApiResponse({ status: 200, description: 'Material request updated' })
  @ApiResponse({ status: 400, description: 'MR is not in DRAFT status or validation error' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialRequestsService.update(id, user, dto);
  }

  // ── POST /v1/material-requests/:id/submit ──────────────────────────────────

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('materialRequest.submit')
  @ApiOperation({
    summary: 'Submit a draft material request (DRAFT → SUBMITTED)',
    description:
      'Routes the MR to its Approver Pool (FOR-347). Optional nomineeIds narrow ' +
      'who is notified — never who may approve.',
  })
  @ApiResponse({ status: 200, description: 'Material request submitted' })
  @ApiResponse({ status: 400, description: 'MR is not in DRAFT status, or nominee not in Pool' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto?: SubmitMaterialRequestDto,
  ) {
    return this.materialRequestsService.submit(id, user, dto);
  }

  // ── GET /v1/material-requests/:id/approver-pool ────────────────────────────

  @Get(':id/approver-pool')
  @RequirePermissions('materialRequest.read')
  @ApiOperation({
    summary: "The material request's Approver Pool, its nominees, and who resolved it",
    description:
      'Gated on materialRequest.read, not materialRequest.approve: the ' +
      'requester needs to see who they are waiting on without holding approval ' +
      'authority themselves. The Pool is recomputed live on every call.',
  })
  @ApiResponse({ status: 200, description: 'Approver Pool view' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async getApproverPool(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.approvalsService.getApproverPool(ApprovalEntityType.MATERIAL_REQUEST, id, user);
  }

  // ── POST /v1/material-requests/:id/nominations ─────────────────────────────

  @Post(':id/nominations')
  @RequirePermissions('materialRequest.read')
  @ApiOperation({
    summary: 'Nominate further Approver Pool members on an MR awaiting approval',
    description:
      'Routing only — gated on materialRequest.read because nominating is not ' +
      'an approval act. Only the requester may nominate, only while the ' +
      'approval is open, and only Pool members. Re-nominating is a no-op.',
  })
  @ApiResponse({ status: 201, description: 'Updated Approver Pool view' })
  @ApiResponse({ status: 400, description: 'Nominee outside the Pool, or MR not pending' })
  @ApiResponse({ status: 403, description: 'Caller did not raise this material request' })
  async nominateApprovers(
    @Param('id') id: string,
    @Body() dto: NominateApproversDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Through MaterialRequestsService, not ApprovalsService: the nominee has to
    // be notified, and the MR's email templates live with the MR.
    return this.materialRequestsService.nominateApprovers(id, dto.userIds, user);
  }

  // ── DELETE /v1/material-requests/:id/nominations/:userId ───────────────────

  @Delete(':id/nominations/:userId')
  @RequirePermissions('materialRequest.read')
  @ApiOperation({
    summary: 'Withdraw a nomination',
    description:
      'Removes the routing hint only. The withdrawn user keeps their place in ' +
      'the Approver Pool and can still approve the material request.',
  })
  @ApiResponse({ status: 200, description: 'Updated Approver Pool view' })
  @ApiResponse({ status: 404, description: 'No such nomination' })
  async withdrawNomination(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalsService.withdrawNomination(
      ApprovalEntityType.MATERIAL_REQUEST,
      id,
      userId,
      user,
    );
  }

  // ── POST /v1/material-requests/:id/approve ─────────────────────────────────

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('materialRequest.approve')
  @ApiOperation({ summary: 'Approve a submitted material request (SUBMITTED → APPROVED)' })
  @ApiResponse({ status: 200, description: 'Material request approved' })
  @ApiResponse({ status: 400, description: 'MR is not in SUBMITTED status' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.approve(id, user);
  }

  // ── POST /v1/material-requests/:id/decline ─────────────────────────────────

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('materialRequest.decline')
  @ApiOperation({ summary: 'Decline a submitted material request (reason required)' })
  @ApiResponse({ status: 200, description: 'Material request declined' })
  @ApiResponse({ status: 400, description: 'MR is not in SUBMITTED status' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async decline(
    @Param('id') id: string,
    @Body() dto: DeclineMaterialRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialRequestsService.decline(id, user, dto);
  }

  // ── POST /v1/material-requests/:id/cancel ──────────────────────────────────

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('materialRequest.cancel')
  @ApiOperation({ summary: 'Cancel a material request (requester or approver only)' })
  @ApiResponse({ status: 200, description: 'Material request cancelled' })
  @ApiResponse({ status: 400, description: 'MR cannot be cancelled in its current status' })
  @ApiResponse({ status: 403, description: 'Only the requester or an approver may cancel' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.cancel(id, user);
  }

  // ── POST /v1/material-requests/:id/convert-to-rfq ──────────────────────────

  @Post(':id/convert-to-rfq')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('materialRequest.convert')
  @ApiOperation({ summary: 'Convert an approved material request into a draft RFQ' })
  @ApiResponse({ status: 201, description: 'Draft RFQ created from the MR' })
  @ApiResponse({ status: 400, description: 'MR is not in APPROVED status' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async convertToRfq(
    @Param('id') id: string,
    @Body() dto: ConvertToRfqDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialRequestsService.convertToRfq(id, user, dto);
  }

  // ── POST /v1/material-requests/:id/convert-to-po ───────────────────────────

  @Post(':id/convert-to-po')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('materialRequest.convert')
  @ApiOperation({ summary: 'Convert an approved material request into a draft purchase order' })
  @ApiResponse({ status: 201, description: 'Draft PO created from the MR' })
  @ApiResponse({ status: 400, description: 'MR is not in APPROVED status or vendor missing' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async convertToPo(
    @Param('id') id: string,
    @Body() dto: ConvertToPoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialRequestsService.convertToPo(id, user, dto);
  }
}
