import { DeliveryOutcome } from '@forethread/shared-types';
import { AccessTokenPurpose, AccessTokenSubject, UserRole, type AccessToken } from '@prisma/client';

import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { DeliveriesPortalController } from '../deliveries-portal.controller';
import { DeliveriesController } from '../deliveries.controller';
import { DeliveriesService } from '../deliveries.service';
import { DeliveryAttachmentService } from '../delivery-attachment.service';
import { DeliveryPortalService } from '../delivery-portal.service';

const user: AuthenticatedUser = {
  id: 'u-1',
  email: 'po@example.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'company-1',
};

const multerFile = { originalname: 'f.pdf' } as unknown as Express.Multer.File;

describe('DeliveriesController', () => {
  const deliveries = {
    list: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    create: jest.fn().mockResolvedValue({ id: 'dr-1' }),
    get: jest.fn().mockResolvedValue({ id: 'dr-1' }),
    approve: jest.fn().mockResolvedValue({ id: 'dr-1' }),
    reject: jest.fn().mockResolvedValue({ id: 'dr-1' }),
  } as unknown as DeliveriesService & Record<string, jest.Mock>;
  const attachments = {
    uploadAttachment: jest.fn().mockResolvedValue({ id: 'att-1' }),
    deleteAttachment: jest.fn().mockResolvedValue({ success: true }),
    uploadDamagePhoto: jest.fn().mockResolvedValue({ id: 'ph-1' }),
    deleteDamagePhoto: jest.fn().mockResolvedValue({ success: true }),
  } as unknown as DeliveryAttachmentService & Record<string, jest.Mock>;

  const controller = new DeliveriesController(deliveries, attachments);

  beforeEach(() => jest.clearAllMocks());

  it('lists', async () => {
    await controller.list({}, user);
    expect(deliveries.list).toHaveBeenCalledWith(user, {});
  });

  it('creates', async () => {
    const dto = {
      purchaseOrderId: 'po-1',
      lines: [{ poLineItemId: 'li-1', quantityReceived: 1, outcome: DeliveryOutcome.DELIVERED }],
    };
    await controller.create(dto, user);
    expect(deliveries.create).toHaveBeenCalledWith(user, dto);
  });

  it('gets one', async () => {
    await controller.get('dr-1', user);
    expect(deliveries.get).toHaveBeenCalledWith('dr-1', user);
  });

  it('approves', async () => {
    await controller.approve('dr-1', user);
    expect(deliveries.approve).toHaveBeenCalledWith('dr-1', user);
  });

  it('rejects with the reason', async () => {
    await controller.reject('dr-1', { reason: 'bad' }, user);
    expect(deliveries.reject).toHaveBeenCalledWith('dr-1', 'bad', user);
  });

  it('uploads + deletes an attachment', async () => {
    await controller.uploadAttachment('dr-1', multerFile, user);
    expect(attachments.uploadAttachment).toHaveBeenCalledWith('dr-1', multerFile, user);
    await controller.deleteAttachment('dr-1', 'att-1', user);
    expect(attachments.deleteAttachment).toHaveBeenCalledWith('dr-1', 'att-1', user);
  });

  it('uploads + deletes a damage photo', async () => {
    await controller.uploadDamagePhoto('dr-1', 'li-1', multerFile, user);
    expect(attachments.uploadDamagePhoto).toHaveBeenCalledWith('dr-1', 'li-1', multerFile, user);
    await controller.deleteDamagePhoto('dr-1', 'li-1', 'ph-1', user);
    expect(attachments.deleteDamagePhoto).toHaveBeenCalledWith('dr-1', 'li-1', 'ph-1', user);
  });
});

describe('DeliveriesPortalController', () => {
  const portal = {
    getPortalPo: jest.fn().mockResolvedValue({ poNumber: 'PO-1' }),
    identify: jest.fn().mockResolvedValue({ ok: true }),
    verify: jest.fn().mockResolvedValue({ sessionToken: 's' }),
    submit: jest.fn().mockResolvedValue({ deliveryReportId: 'dr-1', reportNumber: 'DR-00001' }),
    finalize: jest.fn().mockResolvedValue({ ok: true }),
    resolveSessionReportId: jest.fn().mockReturnValue('dr-1'),
  } as unknown as DeliveryPortalService & Record<string, jest.Mock>;
  const attachments = {
    uploadAttachmentForReport: jest.fn().mockResolvedValue({ id: 'att-1' }),
    uploadDamagePhotoForReport: jest.fn().mockResolvedValue({ id: 'ph-1' }),
  } as unknown as DeliveryAttachmentService & Record<string, jest.Mock>;

  const controller = new DeliveriesPortalController(portal, attachments);

  const submitToken = {
    id: 'tok-1',
    subjectId: 'po-1',
    subjectType: AccessTokenSubject.PURCHASE_ORDER,
    purpose: AccessTokenPurpose.DELIVERY_SUBMIT,
  } as unknown as AccessToken;
  const sessionToken = {
    ...submitToken,
    purpose: AccessTokenPurpose.DELIVERY_SESSION,
  } as unknown as AccessToken;

  beforeEach(() => jest.clearAllMocks());

  it('reads the portal PO from the token subject', async () => {
    await controller.getPo(submitToken);
    expect(portal.getPortalPo).toHaveBeenCalledWith('po-1');
  });

  it('identifies', async () => {
    await controller.identify(submitToken, { name: 'Dan', email: 'd@x.com' });
    expect(portal.identify).toHaveBeenCalledWith('po-1', 'Dan', 'd@x.com');
  });

  it('verifies', async () => {
    await controller.verify(submitToken, { email: 'd@x.com', code: '123456' });
    expect(portal.verify).toHaveBeenCalledWith('po-1', 'd@x.com', '123456', 'd@x.com');
  });

  it('submits', async () => {
    const dto = {
      lines: [{ poLineItemId: 'li-1', quantityReceived: 1, outcome: DeliveryOutcome.DELIVERED }],
    };
    await controller.submit(sessionToken, dto);
    expect(portal.submit).toHaveBeenCalledWith(sessionToken, dto);
  });

  it('uploads a damage photo bound to the session report', async () => {
    await controller.uploadDamagePhoto(sessionToken, 'li-1', multerFile);
    expect(portal.resolveSessionReportId).toHaveBeenCalledWith(sessionToken);
    expect(attachments.uploadDamagePhotoForReport).toHaveBeenCalledWith('dr-1', 'li-1', multerFile);
  });

  it('uploads an attachment bound to the session report', async () => {
    await controller.uploadAttachment(sessionToken, multerFile);
    expect(attachments.uploadAttachmentForReport).toHaveBeenCalledWith('dr-1', multerFile);
  });

  it('finalizes', async () => {
    await controller.finalize(sessionToken);
    expect(portal.finalize).toHaveBeenCalledWith(sessionToken);
  });
});
