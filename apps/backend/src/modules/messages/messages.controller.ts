import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import {
  CreateThreadDto,
  ListMessagesQueryDto,
  ListThreadsQueryDto,
  SendMessageDto,
} from './messages.dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('threads')
  @RequirePermissions('message.createThread')
  @ApiOperation({ summary: 'Create a new message thread' })
  @ApiResponse({ status: 201, description: 'Thread created successfully' })
  createThread(@Body() dto: CreateThreadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.messagesService.createThread(dto, user);
  }

  @Get('threads')
  @RequirePermissions('message.listThreads')
  @ApiOperation({ summary: 'List message threads for the current user' })
  @ApiResponse({ status: 200, description: 'Paginated thread list' })
  listThreads(@Query() query: ListThreadsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.messagesService.listThreads(query, user);
  }

  @Get('threads/:id/messages')
  @RequirePermissions('message.read')
  @ApiOperation({ summary: 'List messages in a thread' })
  @ApiResponse({ status: 200, description: 'Paginated message list' })
  @ApiResponse({ status: 403, description: 'Not a participant of this thread' })
  getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.getMessages(id, query, user);
  }

  @Post('threads/:id/messages')
  @RequirePermissions('message.send')
  @ApiOperation({ summary: 'Send a message in a thread' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Thread context document is closed' })
  @ApiResponse({ status: 403, description: 'Not a participant of this thread' })
  sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messagesService.sendMessage(id, dto, user);
  }
}
