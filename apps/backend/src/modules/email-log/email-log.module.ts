import { Module } from '@nestjs/common';

import { EmailLogController } from './email-log.controller';
import { EmailLogService } from './email-log.service';
import { ResendWebhookController } from './resend-webhook.controller';

/**
 * Email delivery log (FOR-213): records outbound transactional emails and folds
 * in Resend webhook events so send status, opens, and bounces surface on the RFQ
 * and PO detail pages. PrismaModule and ConfigModule are global, so they need no
 * explicit import here.
 */
@Module({
  controllers: [EmailLogController, ResendWebhookController],
  providers: [EmailLogService],
  exports: [EmailLogService],
})
export class EmailLogModule {}
