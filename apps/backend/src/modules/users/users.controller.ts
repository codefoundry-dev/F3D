import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

import { ERR } from '../../common/constants/error-messages.const';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

import {
  UsersService,
  CreateUserDto,
  UpdateUserDto,
  UpdateMeDto,
  ChangePasswordDto,
  UserListQueryDto,
} from './users.service';

interface AuthUser {
  id: string;
  role: string;
  companyId: string | null;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user' })
  async getMe(@CurrentUser() user: AuthUser) {
    const result = await this.usersService.getMe(user.id);
    return this.resolveAvatarUrl(result);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Updated profile' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload current user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Avatar uploaded' })
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException(ERR.storage.onlyImagesAllowedFormats);
    }
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException(ERR.storage.fileTooLarge('5MB'));

    const ext = path.extname(file.originalname);
    const key = `avatars/${user.id}/${randomUUID()}${ext}`;

    const result = await this.storageService.upload(key, file.buffer, file.mimetype);

    await this.prisma.file.create({
      data: {
        bucket: result.bucket,
        key: result.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: user.id,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: result.key },
    });

    return { id: user.id, avatarUrl: this.storageService.getPublicUrl(result.key) };
  }

  @Get('me/avatar-url')
  @ApiOperation({ summary: 'Get public URL for current user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar URL' })
  async getAvatarUrl(@CurrentUser() user: AuthUser) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    });
    if (!u?.avatarUrl) return { url: null };
    return { url: this.storageService.getPublicUrl(u.avatarUrl) };
  }

  @Get()
  @RequirePermissions('user.list')
  @ApiOperation({ summary: 'List users (SuperAdmin: all; CompanyAdmin/Vendor: own company)' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async listUsers(@Query() query: UserListQueryDto, @CurrentUser() user: AuthUser) {
    const result = await this.usersService.listUsers(query, user);
    const items = result.items.map((item) => this.resolveAvatarUrl(item));
    return { ...result, items };
  }

  @Post()
  @RequirePermissions('user.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create and invite a new user' })
  @ApiResponse({ status: 201, description: 'User created and invitation sent' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.createUser(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getUser(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const result = await this.usersService.getUser(id, user);
    return this.resolveAvatarUrl(result);
  }

  @Patch(':id')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'Updated user' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.updateUser(id, dto, user);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('user.deactivate')
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate sole admin' })
  deactivateUser(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.deactivateUser(id, user);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('user.reactivate')
  @ApiOperation({ summary: 'Reactivate deactivated user' })
  @ApiResponse({ status: 200, description: 'User reactivated' })
  reactivateUser(@Param('id') id: string) {
    return this.usersService.reactivateUser(id);
  }

  @Post(':id/initiate-reset-password')
  @RequirePermissions('user.initiateResetPassword')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin-initiated password reset for a user' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  @ApiResponse({ status: 400, description: 'User is not active' })
  initiateResetPassword(@Param('id') id: string) {
    return this.usersService.initiateResetPassword(id);
  }

  @Post(':id/resend-invitation')
  @RequirePermissions('user.resendInvitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend invitation email to pending user' })
  @ApiResponse({ status: 200, description: 'Invitation resent' })
  resendInvitation(@Param('id') id: string) {
    return this.usersService.resendInvitation(id);
  }

  @Delete(':id/invitation')
  @RequirePermissions('user.cancelInvitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel pending invitation and remove user' })
  @ApiResponse({ status: 200, description: 'Invitation cancelled' })
  cancelInvitation(@Param('id') id: string) {
    return this.usersService.cancelInvitation(id);
  }

  /** Convert S3 key stored in avatarUrl to a public URL */
  private resolveAvatarUrl<T extends { avatarUrl: string | null }>(item: T): T {
    if (item.avatarUrl) {
      return { ...item, avatarUrl: this.storageService.getPublicUrl(item.avatarUrl) };
    }
    return item;
  }
}
