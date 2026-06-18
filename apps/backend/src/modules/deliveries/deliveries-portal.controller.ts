import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccessTokenPurpose, AccessTokenSubject, type AccessToken } from '@prisma/client';

import { Public } from '../../common/decorators/public.decorator';
import { CurrentAccessToken, RequireAccessToken } from '../access-tokens/access-token.decorators';

import { PortalIdentifyDto, PortalSubmitDto, PortalVerifyDto } from './deliveries.dto';
import { DeliveryAttachmentService } from './delivery-attachment.service';
import { DeliveryPortalService } from './delivery-portal.service';

const SUBMIT_TOKEN = {
  expectedPurpose: AccessTokenPurpose.DELIVERY_SUBMIT,
  expectedSubjectType: AccessTokenSubject.PURCHASE_ORDER,
};
const SESSION_TOKEN = {
  expectedPurpose: AccessTokenPurpose.DELIVERY_SESSION,
  expectedSubjectType: AccessTokenSubject.PURCHASE_ORDER,
};

/**
 * Public, token-authorised delivery portal (Epic 6 — QR-code flow). Every route
 * is @Public() (no JWT) and gated by @RequireAccessToken; the PO is resolved
 * from the token subject so the caller never names a PO id. The QR link carries a
 * long-lived DELIVERY_SUBMIT token (read PO / identify / verify); after the
 * delivery person verifies an emailed code they receive a short-lived
 * DELIVERY_SESSION token that authorises submit + uploads + finalize.
 */
@ApiTags('Delivery Portal')
@Controller('delivery-portal')
export class DeliveriesPortalController {
  constructor(
    private readonly portalService: DeliveryPortalService,
    private readonly attachmentService: DeliveryAttachmentService,
  ) {}

  // ── GET /v1/delivery-portal/po (DELIVERY_SUBMIT) ─────────────────────────────

  @Get('po')
  @Public()
  @RequireAccessToken(SUBMIT_TOKEN)
  @ApiOperation({ summary: 'Read-only PO header + lines for the public delivery form' })
  @ApiResponse({ status: 200, description: 'Read-only PO for the delivery portal' })
  @ApiResponse({ status: 403, description: 'Token missing, expired, revoked, or invalid' })
  async getPo(@CurrentAccessToken() token: AccessToken) {
    return this.portalService.getPortalPo(token.subjectId);
  }

  // ── POST /v1/delivery-portal/identify (DELIVERY_SUBMIT) ──────────────────────

  @Post('identify')
  @Public()
  @RequireAccessToken(SUBMIT_TOKEN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email a one-time delivery code (anti-enumeration: always ok)' })
  @ApiResponse({ status: 200, description: 'Always { ok: true }' })
  async identify(@CurrentAccessToken() token: AccessToken, @Body() dto: PortalIdentifyDto) {
    return this.portalService.identify(token.subjectId, dto.name, dto.email);
  }

  // ── POST /v1/delivery-portal/verify (DELIVERY_SUBMIT) ────────────────────────

  @Post('verify')
  @Public()
  @RequireAccessToken(SUBMIT_TOKEN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the emailed code and mint a delivery session token' })
  @ApiResponse({ status: 200, description: 'Session token for submit + uploads' })
  @ApiResponse({ status: 400, description: 'Incorrect or expired code' })
  async verify(@CurrentAccessToken() token: AccessToken, @Body() dto: PortalVerifyDto) {
    // `name` for the session is carried alongside the verified email; the portal
    // form re-sends it so the session token captures the submitter's name.
    return this.portalService.verify(token.subjectId, dto.email, dto.code, dto.email);
  }

  // ── POST /v1/delivery-portal/submit (DELIVERY_SESSION) ───────────────────────

  @Post('submit')
  @Public()
  @RequireAccessToken(SESSION_TOKEN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit the external delivery report (submitter from token)' })
  @ApiResponse({ status: 201, description: 'Delivery report created' })
  @ApiResponse({ status: 400, description: 'PO not deliverable or invalid lines' })
  async submit(@CurrentAccessToken() token: AccessToken, @Body() dto: PortalSubmitDto) {
    return this.portalService.submit(token, dto);
  }

  // ── POST /v1/delivery-portal/lines/:lineId/photos (DELIVERY_SESSION) ─────────

  @Post('lines/:lineId/photos')
  @Public()
  @RequireAccessToken(SESSION_TOKEN)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a damage photo on the session report (token-bound)' })
  @ApiResponse({ status: 201, description: 'Damage photo uploaded' })
  @ApiResponse({ status: 403, description: 'No report submitted on this session yet' })
  async uploadDamagePhoto(
    @CurrentAccessToken() token: AccessToken,
    @Param('lineId') lineId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const reportId = this.portalService.resolveSessionReportId(token);
    return this.attachmentService.uploadDamagePhotoForReport(reportId, lineId, file);
  }

  // ── POST /v1/delivery-portal/attachments (DELIVERY_SESSION) ──────────────────

  @Post('attachments')
  @Public()
  @RequireAccessToken(SESSION_TOKEN)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a supporting attachment on the session report (token-bound)' })
  @ApiResponse({ status: 201, description: 'Attachment uploaded' })
  @ApiResponse({ status: 403, description: 'No report submitted on this session yet' })
  async uploadAttachment(
    @CurrentAccessToken() token: AccessToken,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const reportId = this.portalService.resolveSessionReportId(token);
    return this.attachmentService.uploadAttachmentForReport(reportId, file);
  }

  // ── POST /v1/delivery-portal/finalize (DELIVERY_SESSION) ─────────────────────

  @Post('finalize')
  @Public()
  @RequireAccessToken(SESSION_TOKEN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalize the delivery session (consumes the session token)' })
  @ApiResponse({ status: 200, description: 'Session finalized' })
  async finalize(@CurrentAccessToken() token: AccessToken) {
    return this.portalService.finalize(token);
  }
}
