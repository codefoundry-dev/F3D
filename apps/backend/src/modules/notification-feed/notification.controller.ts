import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';

import { NotificationEventsService } from './notification-events.service';
import { ListNotificationsQueryDto } from './notification.dto';
import { NotificationService } from './notification.service';

/** Heartbeat cadence for the SSE stream — keeps intermediaries from closing an
 *  idle connection. Comfortably under common 60s proxy idle timeouts. */
const SSE_HEARTBEAT_MS = 25_000;

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly events: NotificationEventsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the current user's in-app notifications" })
  @ApiResponse({ status: 200, description: 'Paginated notifications with unread count' })
  list(@Query() query: ListNotificationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for the header badge' })
  @ApiResponse({ status: 200, description: '{ count }' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user);
  }

  /**
   * Server-Sent Events stream of the current user's new notifications. Written
   * straight to the raw response (not `@Sse()`) so the global response transform
   * never wraps the event frames. Auth is the standard cookie JWT — EventSource
   * sends it with `withCredentials`. `@SkipThrottle` because this is one
   * long-lived connection, not a burst of requests.
   */
  @Get('stream')
  @SkipThrottle()
  @ApiOperation({ summary: 'SSE stream of new notifications for the current user' })
  stream(@CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Res() res: Response): void {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Ask reverse proxies (nginx / Caddy) not to buffer the stream.
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    // Open the stream with a comment so the client's connection resolves promptly.
    res.write(': connected\n\n');

    const unsubscribe = this.events.subscribe(user.id, (notification) => {
      res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, SSE_HEARTBEAT_MS);

    const cleanup = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    req.on('close', cleanup);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification read' })
  @ApiResponse({ status: 201, description: '{ updated }' })
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markRead(user, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications read' })
  @ApiResponse({ status: 201, description: '{ updated }' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user);
  }
}
