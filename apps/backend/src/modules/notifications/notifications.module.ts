import { Module } from '@nestjs/common';

import { EmailLogModule } from '../email-log/email-log.module';

import { EmailService } from './email.service';
import { ResendService } from './resend.service';

@Module({
  imports: [EmailLogModule],
  providers: [EmailService, ResendService],
  exports: [EmailService, ResendService],
})
export class NotificationsModule {}
