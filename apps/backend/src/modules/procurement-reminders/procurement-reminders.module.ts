import { Module } from '@nestjs/common';

import { ExportModule } from '../export/export.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { ProcurementReminderService } from './procurement-reminder.service';

/** Daily overdue reminders for MRs, RFQs and POs (FOR-394). */
@Module({
  imports: [ExportModule, NotificationsModule],
  providers: [ProcurementReminderService],
})
export class ProcurementRemindersModule {}
