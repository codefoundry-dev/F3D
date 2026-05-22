import {
  ConfirmDocExtractionDto,
  CreateDocExtractionDto,
  DocExtractionListQueryDto,
  UpdateDocExtractionDto,
} from '@forethread/shared-types';
import {
  BadRequestException,
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
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { toExtractionResponse } from './doc-intelligence.mapper';
import { DocIntelligenceService } from './doc-intelligence.service';

@ApiTags('Document Intelligence')
@ApiBearerAuth()
@Controller('doc-extractions')
export class DocIntelligenceController {
  constructor(private readonly service: DocIntelligenceService) {}

  // ── POST /v1/doc-extractions ────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions('docExtraction.create')
  @ApiOperation({
    summary: 'Upload a document and start a Gemini extraction job',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Extraction job created (PENDING/PROCESSING)' })
  @ApiResponse({ status: 400, description: 'Invalid file or extraction type' })
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateDocExtractionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!body.type) {
      throw new BadRequestException('type is required');
    }
    const job = await this.service.createExtraction(
      { type: body.type, promptHint: body.promptHint, file },
      user,
    );
    return toExtractionResponse(job);
  }

  // ── GET /v1/doc-extractions ─────────────────────────────────────────────

  @Get()
  @RequirePermissions('docExtraction.read')
  @ApiOperation({ summary: 'List extraction jobs accessible to the current user' })
  @ApiResponse({ status: 200, description: 'Paginated list of extractions' })
  async list(
    @Query() query: DocExtractionListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { items, meta } = await this.service.listExtractions(query, user);
    return { items: items.map(toExtractionResponse), meta };
  }

  // ── GET /v1/doc-extractions/:id ─────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('docExtraction.read')
  @ApiOperation({ summary: 'Get a single extraction job (poll endpoint)' })
  @ApiResponse({ status: 200, description: 'Extraction detail' })
  @ApiResponse({ status: 404, description: 'Extraction not found' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const job = await this.service.getExtraction(id, user);
    return toExtractionResponse(job);
  }

  // ── PATCH /v1/doc-extractions/:id ───────────────────────────────────────

  @Patch(':id')
  @RequirePermissions('docExtraction.update')
  @ApiOperation({ summary: 'Replace the edited extraction result' })
  @ApiResponse({ status: 200, description: 'Edited result saved' })
  @ApiResponse({ status: 400, description: 'Job is not in an editable state' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocExtractionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const job = await this.service.updateExtraction(id, dto.editedResult, user);
    return toExtractionResponse(job);
  }

  // ── POST /v1/doc-extractions/:id/confirm ───────────────────────────────

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('docExtraction.confirm')
  @ApiOperation({ summary: 'Confirm and lock the extraction result' })
  @ApiResponse({ status: 200, description: 'Extraction confirmed' })
  @ApiResponse({ status: 400, description: 'Job is not ready to be confirmed' })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmDocExtractionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const job = await this.service.confirmExtraction(id, dto.editedResult, user);
    return toExtractionResponse(job);
  }

  // ── DELETE /v1/doc-extractions/:id ──────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('docExtraction.delete')
  @ApiOperation({ summary: 'Delete an extraction job and its underlying file' })
  @ApiResponse({ status: 204, description: 'Extraction deleted' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.service.deleteExtraction(id, user);
  }
}
