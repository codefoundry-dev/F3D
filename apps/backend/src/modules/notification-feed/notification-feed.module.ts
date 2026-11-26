import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { NotificationEventsService } from './notification-events.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

/**
 * In-app notification feed (bell + panel + SSE). Global so the domain services
 * that already send transactional emails (rfqs, purchase-orders, bulk-orders,
 * messages) can inject {@link NotificationService} and mirror the same events
 * into the feed without every module importing this one.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventsService],
  exports: [NotificationService, NotificationEventsService],
})
export class NotificationFeedModule {}
