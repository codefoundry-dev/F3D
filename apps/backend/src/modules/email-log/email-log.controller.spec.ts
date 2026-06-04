import { UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

import { EmailLogController } from './email-log.controller';
import { EmailLogService } from './email-log.service';

const USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'buyer@contractor.local',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'company-1',
};

describe('EmailLogController', () => {
  let service: { listForRfq: jest.Mock; listForPurchaseOrder: jest.Mock };
  let controller: EmailLogController;

  beforeEach(() => {
    service = { listForRfq: jest.fn(), listForPurchaseOrder: jest.fn() };
    controller = new EmailLogController(service as unknown as EmailLogService);
  });

  describe('listRfqEmails', () => {
    it('delegates to the service with the rfq id and caller', async () => {
      const expected = [{ id: 'em-1' }];
      service.listForRfq.mockResolvedValue(expected);

      const result = await controller.listRfqEmails('rfq-1', USER);

      expect(service.listForRfq).toHaveBeenCalledWith('rfq-1', USER);
      expect(result).toBe(expected);
    });
  });

  describe('listPoEmails', () => {
    it('delegates to the service with the purchase order id and caller', async () => {
      const expected = [{ id: 'em-po-1' }];
      service.listForPurchaseOrder.mockResolvedValue(expected);

      const result = await controller.listPoEmails('po-1', USER);

      expect(service.listForPurchaseOrder).toHaveBeenCalledWith('po-1', USER);
      expect(result).toBe(expected);
    });
  });
});
