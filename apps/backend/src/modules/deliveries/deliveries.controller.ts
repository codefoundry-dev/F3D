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

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import {
  CreateDeliveryReportDto,
  ListDeliveryReportQueryDto,
  RejectDeliveryReportDto,
} from './deliveries.dto';
import { DeliveriesService } from './deliveries.service';
import { DeliveryAttachmentService } from './delivery-attachment.service';

@ApiTags('Delivery Reports')
@ApiBearerAuth()
@Controller('delivery-reports')
export class DeliveriesController {
  constructor(
    private readonly deliveriesService: DeliveriesService,
    private readonly attachmentService: DeliveryAttachmentService,
  ) {}

  // ── GET /v1/delivery-reports ────────────────────────────────────────────────

  @Get()
  @RequirePermissions('delivery.list')
  @ApiOperation({ summary: 'List delivery reports for the current user company' })
  @ApiResponse({ status: 200, description: 'Paginated list of delivery reports' })
  async list(@Query() query: ListDeliveryReportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveriesService.list(user, query);
  }

  // ── POST /v1/delivery-reports ───────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('delivery.create')
  @ApiOperation({ summary: 'Create an internal delivery report (SUBMITTED)' })
  @ApiResponse({ status: 201, description: 'Delivery report created' })
  @ApiResponse({ status: 400, description: 'PO not deliverable or invalid lines' })
  async create(@Body() dto: CreateDeliveryReportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveriesService.create(user, dto);
  }

  // ── GET /v1/delivery-reports/:id ────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('delivery.read')
  @ApiOperation({ summary: 'Get a single delivery report by id' })
  @ApiResponse({ status: 200, description: 'Delivery report detail' })
  @ApiResponse({ status: 404, description: 'Delivery report not found' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveriesService.get(id, user);
  }

  // ── PATCH /v1/delivery-reports/:id/approve ──────────────────────────────────

  @Patch(':id/approve')
  @RequirePermissions('delivery.approve')
  @ApiOperation({ summary: 'Approve a submitted delivery report (flows to PO + inventory)' })
  @ApiResponse({ status: 200, description: 'Delivery report approved' })
  @ApiResponse({ status: 400, description: 'Report is not in SUBMITTED status' })
  @ApiResponse({ status: 404, description: 'Delivery report not found' })
  async approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveriesService.approve(id, user);
  }

  // ── PATCH /v1/delivery-reports/:id/reject ───────────────────────────────────

  @Patch(':id/reject')
  @RequirePermissions('delivery.reject')
  @ApiOperation({ summary: 'Reject a submitted delivery report (reason required)' })
  @ApiResponse({ status: 200, description: 'Delivery report rejected' })
  @ApiResponse({ status: 400, description: 'Report is not in SUBMITTED status' })
  @ApiResponse({ status: 404, description: 'Delivery report not found' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDeliveryReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deliveriesService.reject(id, dto.reason, user);
  }

  // ── POST /v1/delivery-reports/:id/attachments ───────────────────────────────

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('delivery.uploadAttachment')
  @ApiOperation({ summary: 'Upload a supporting attachment to a delivery report' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Attachment uploaded' })
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentService.uploadAttachment(id, file, user);
  }

  // ── DELETE /v1/delivery-reports/:id/attachments/:attId ──────────────────────

  @Delete(':id/attachments/:attId')
  @RequirePermissions('delivery.deleteAttachment')
  @ApiOperation({ summary: 'Delete a delivery report attachment' })
  @ApiResponse({ status: 200, description: 'Attachment deleted' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async deleteAttachment(
    @Param('id') id: string,
    @Param('attId') attId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentService.deleteAttachment(id, attId, user);
  }

  // ── POST /v1/delivery-reports/:id/lines/:lineId/photos ──────────────────────

  @Post(':id/lines/:lineId/photos')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('delivery.uploadAttachment')
  @ApiOperation({ summary: 'Upload a damage photo to a delivery report line' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Damage photo uploaded' })
  async uploadDamagePhoto(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentService.uploadDamagePhoto(id, lineId, file, user);
  }

  // ── DELETE /v1/delivery-reports/:id/lines/:lineId/photos/:photoId ────────────

  @Delete(':id/lines/:lineId/photos/:photoId')
  @RequirePermissions('delivery.deleteAttachment')
  @ApiOperation({ summary: 'Delete a damage photo from a delivery report line' })
  @ApiResponse({ status: 200, description: 'Damage photo deleted' })
  @ApiResponse({ status: 404, description: 'Damage photo not found' })
  async deleteDamagePhoto(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentService.deleteDamagePhoto(id, lineId, photoId, user);
  }
}
