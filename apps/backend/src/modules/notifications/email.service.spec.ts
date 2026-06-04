/* eslint-disable @typescript-eslint/no-require-imports */

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });

jest.mock('nodemailer', () => ({
  createTransport: mockCreateTransport,
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn().mockReturnValue('<html>{{content}}</html>'),
  readdirSync: jest.fn().mockReturnValue([]),
}));

jest.mock('handlebars', () => {
  const compile = jest.fn().mockReturnValue(jest.fn().mockReturnValue('<html>rendered</html>'));
  return {
    compile,
    registerPartial: jest.fn(),
  };
});

jest.mock(
  '@forethread/i18n/locales/en/emails.json',
  () => ({
    invitation: {
      subject: 'Welcome to Forethread — Activate Your Account',
      greeting: 'Hi {{name}},',
    },
    otp: {
      subject: 'Your Forethread Login Code',
      plainText:
        'Your one-time login code is: {{otp}}\n\nThis code expires in {{expiresMinutes}} minutes.',
    },
    passwordReset: { subject: 'Forethread — Password Reset Request', greeting: 'Hi {{name}},' },
    deactivation: {
      subject: 'Forethread — Your Account Has Been Deactivated',
      greeting: 'Hi {{name}},',
    },
    reactivation: {
      subject: 'Forethread — Your Account Has Been Reactivated',
      greeting: 'Hi {{name}},',
    },
    vendorInvitation: {
      subject: "Forethread — You've Been Invited to Join as a Vendor",
      greeting: 'Hi {{name}},',
    },
    vendorCompanyInvitation: {
      subject: 'Forethread — Your Company Has Been Invited',
      greeting: 'Hello,',
    },
    rfqReceived: {
      subject: 'Forethread — New RFQ Received: {{rfqNumber}}',
      greeting: 'Hello,',
    },
    poIssued: {
      subject: 'Forethread — Purchase Order Issued: {{poNumber}}',
      greeting: 'Hello,',
    },
    changeRequestProposed: {
      subject: 'Forethread — Change Request Proposed for {{bulkId}}',
      greeting: 'Hello,',
    },
    changeRequestApproved: {
      subject: 'Forethread — Change Request Approved for {{bulkId}}',
      greeting: 'Hello,',
    },
    changeRequestRejected: {
      subject: 'Forethread — Change Request Rejected for {{bulkId}}',
      greeting: 'Hello,',
    },
    bulkOrderCancelled: {
      subject: 'Forethread — Bulk Order {{bulkId}} Cancelled',
      greeting: 'Hello,',
    },
    quoteUpdated: {
      subject: 'Forethread — Quote Updated for {{rfqNumber}}',
      greeting: 'Hello,',
    },
    invitationExpiredNotification: {
      subject: 'Forethread — Invitation Link Expired for {{invitedUserName}}',
      greeting: 'Hi {{name}},',
      body: '{{invitedUserName}} ({{invitedUserEmail}}) attempted to use their invitation link, which is no longer valid.',
    },
    footer: { privacyPolicy: 'Privacy policy', and: 'and', termsOfService: 'Terms of service' },
  }),
  { virtual: true },
);

import { ConfigService } from '@nestjs/config';

import type { EmailLogService } from '../email-log/email-log.service';

import { EmailService } from './email.service';
import type { ResendService } from './resend.service';

describe('EmailService', () => {
  let service: EmailService;
  let configService: jest.Mocked<ConfigService>;
  let resendService: { isConfigured: jest.Mock; send: jest.Mock };
  let emailLogService: { recordOutbound: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });

    emailLogService = { recordOutbound: jest.fn().mockResolvedValue({ id: 'log-id' }) };

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          SMTP_FROM: 'test@forethread.local',
          SMTP_HOST: 'localhost',
          SMTP_PORT: 1025,
          SMTP_USER: undefined,
          SMTP_PASS: undefined,
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    resendService = {
      isConfigured: jest.fn().mockReturnValue(false),
      send: jest.fn().mockResolvedValue({ status: 'queued', id: 'resend-id' }),
    };

    service = new EmailService(
        configService,
        resendService as unknown as ResendService,
        emailLogService as unknown as EmailLogService,
      );
    service.onModuleInit();
  });

  describe('constructor', () => {
    it('should create a nodemailer transport', () => {
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 1025,
          secure: false,
        }),
      );
    });

    it('should include auth when SMTP_USER is set', () => {
      const authConfig = {
        get: jest.fn((key: string, defaultValue?: unknown) => {
          const config: Record<string, unknown> = {
            SMTP_FROM: 'test@forethread.local',
            SMTP_HOST: 'smtp.example.com',
            SMTP_PORT: 587,
            SMTP_USER: 'user@example.com',
            SMTP_PASS: 'password123',
          };
          return config[key] ?? defaultValue;
        }),
      } as unknown as jest.Mocked<ConfigService>;

      new EmailService(
        authConfig,
        resendService as unknown as ResendService,
        emailLogService as unknown as EmailLogService,
      );

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { user: 'user@example.com', pass: 'password123' },
        }),
      );
    });
  });

  describe('onModuleInit', () => {
    it('should register partials when partials directory exists', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['header.html', 'footer.html']);

      const svc = new EmailService(
        configService,
        resendService as unknown as ResendService,
        emailLogService as unknown as EmailLogService,
      );
      svc.onModuleInit();

      const Handlebars = require('handlebars');
      expect(Handlebars.registerPartial).toHaveBeenCalledTimes(2);
    });

    it('should throw when template is not found in renderEmail', () => {
      const svc = new EmailService(
        configService,
        resendService as unknown as ResendService,
        emailLogService as unknown as EmailLogService,
      );
      svc.onModuleInit();

      // Access private renderEmail via sending with invalid template
      // The templates Map should have the known templates, test missing one via mock
      const templatesMap = (svc as any).templates as Map<string, unknown>;
      templatesMap.clear(); // clear all templates

      expect(() => {
        (svc as any).renderEmail('nonexistent', {});
      }).toThrow('Email template "nonexistent" not found');
    });
  });

  describe('sendOtpEmail', () => {
    it('should send OTP email with correct arguments', async () => {
      const expiresAt = new Date(Date.now() + 10 * 60000);

      await service.sendOtpEmail('user@test.com', '123456', expiresAt);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'user@test.com',
          subject: 'Your Forethread Login Code',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendOtpEmail('user@test.com', '123456', new Date(Date.now() + 600000)),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendInvitationEmail', () => {
    it('should send invitation email with correct arguments', async () => {
      await service.sendInvitationEmail('user@test.com', 'https://activate.test', 'John');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'user@test.com',
          subject: 'Welcome to Forethread — Activate Your Account',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendInvitationEmail('user@test.com', 'https://activate.test', 'John'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      await service.sendPasswordResetEmail('user@test.com', 'https://reset.test', 'John');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'user@test.com',
          subject: 'Forethread — Password Reset Request',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendPasswordResetEmail('user@test.com', 'https://reset.test', 'John'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendDeactivationEmail', () => {
    it('should send deactivation email', async () => {
      await service.sendDeactivationEmail('user@test.com', 'John');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'user@test.com',
          subject: 'Forethread — Your Account Has Been Deactivated',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(service.sendDeactivationEmail('user@test.com', 'John')).resolves.toBeUndefined();
    });
  });

  describe('sendReactivationEmail', () => {
    it('should send reactivation email', async () => {
      await service.sendReactivationEmail('user@test.com', 'John');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'user@test.com',
          subject: 'Forethread — Your Account Has Been Reactivated',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(service.sendReactivationEmail('user@test.com', 'John')).resolves.toBeUndefined();
    });
  });

  describe('sendVendorInvitationEmail', () => {
    it('should send vendor invitation email', async () => {
      await service.sendVendorInvitationEmail(
        'vendor@test.com',
        'https://activate.test/vendor',
        'Vendor User',
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'vendor@test.com',
          subject: "Forethread — You've Been Invited to Join as a Vendor",
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendVendorInvitationEmail(
          'vendor@test.com',
          'https://activate.test/vendor',
          'Vendor User',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendVendorCompanyInvitationEmail', () => {
    it('should send vendor company invitation email', async () => {
      await service.sendVendorCompanyInvitationEmail('company@vendor.com');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'company@vendor.com',
          subject: 'Forethread — Your Company Has Been Invited',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendVendorCompanyInvitationEmail('company@vendor.com'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendInvitationExpiredNotification', () => {
    it('should send invitation expired notification', async () => {
      await service.sendInvitationExpiredNotification(
        'admin@test.com',
        'Admin User',
        'Invited User',
        'invited@test.com',
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'admin@test.com',
          subject: 'Forethread — Invitation Link Expired for Invited User',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendInvitationExpiredNotification(
          'admin@test.com',
          'Admin User',
          'Invited User',
          'invited@test.com',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendRfqReceivedEmail', () => {
    it('should send RFQ received email', async () => {
      await service.sendRfqReceivedEmail('vendor@test.com', 'RFQ-001', 'https://reply.test');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'vendor@test.com',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendRfqReceivedEmail('vendor@test.com', 'RFQ-001', 'https://reply.test'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendPoIssuedEmail', () => {
    it('should send PO issued email without attachment', async () => {
      await service.sendPoIssuedEmail('vendor@test.com', 'PO-001', 'https://view.test');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'vendor@test.com',
          attachments: [],
        }),
      );
    });

    it('should send PO issued email with PDF attachment', async () => {
      const pdfBuffer = Buffer.from('fake-pdf');
      await service.sendPoIssuedEmail('vendor@test.com', 'PO-001', 'https://view.test', pdfBuffer);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [{ filename: 'PO-PO-001.pdf', content: pdfBuffer }],
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendPoIssuedEmail('vendor@test.com', 'PO-001', 'https://view.test'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendChangeRequestProposedEmail', () => {
    it('should send change request proposed email', async () => {
      await service.sendChangeRequestProposedEmail(
        'user@test.com',
        'BULK-001',
        'John Doe',
        'https://view.test',
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'user@test.com',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendChangeRequestProposedEmail(
          'user@test.com',
          'BULK-001',
          'John Doe',
          'https://view.test',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendChangeRequestApprovedEmail', () => {
    it('should send change request approved email', async () => {
      await service.sendChangeRequestApprovedEmail(
        'user@test.com',
        'BULK-001',
        'https://view.test',
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'user@test.com',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendChangeRequestApprovedEmail('user@test.com', 'BULK-001', 'https://view.test'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendChangeRequestRejectedEmail', () => {
    it('should send change request rejected email', async () => {
      await service.sendChangeRequestRejectedEmail(
        'user@test.com',
        'BULK-001',
        'https://view.test',
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'user@test.com',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendChangeRequestRejectedEmail('user@test.com', 'BULK-001', 'https://view.test'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendBulkOrderCancelledEmail', () => {
    it('should send bulk order cancelled email', async () => {
      await service.sendBulkOrderCancelledEmail('user@test.com', 'BULK-001', 'Admin User');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'user@test.com',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendBulkOrderCancelledEmail('user@test.com', 'BULK-001', 'Admin User'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendQuoteUpdatedEmail', () => {
    it('should send quote updated email', async () => {
      await service.sendQuoteUpdatedEmail(
        'user@test.com',
        'RFQ-001',
        'VendorCo',
        'https://view.test',
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@forethread.local',
          to: 'user@test.com',
        }),
      );
    });

    it('should not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendQuoteUpdatedEmail('user@test.com', 'RFQ-001', 'VendorCo', 'https://view.test'),
      ).resolves.toBeUndefined();
    });
  });

  describe('transport selection (Resend preferred over SMTP)', () => {
    it('routes through Resend and skips SMTP when Resend is configured', async () => {
      resendService.isConfigured.mockReturnValue(true);

      await service.sendInvitationEmail('user@test.com', 'https://activate.test', 'John');

      expect(resendService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Welcome to Forethread — Activate Your Account',
        }),
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('does not pass an SMTP from address to Resend (Resend uses RESEND_FROM)', async () => {
      resendService.isConfigured.mockReturnValue(true);

      await service.sendInvitationEmail('user@test.com', 'https://activate.test', 'John');

      const payload = resendService.send.mock.calls[0][0] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('from');
    });

    it('forwards the PDF attachment to Resend on PO issued emails', async () => {
      resendService.isConfigured.mockReturnValue(true);
      const pdfBuffer = Buffer.from('fake-pdf');

      await service.sendPoIssuedEmail('vendor@test.com', 'PO-001', 'https://view.test', pdfBuffer);

      expect(resendService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [{ filename: 'PO-PO-001.pdf', content: pdfBuffer }],
        }),
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('falls back to SMTP when Resend is not configured', async () => {
      resendService.isConfigured.mockReturnValue(false);

      await service.sendInvitationEmail('user@test.com', 'https://activate.test', 'John');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'test@forethread.local', to: 'user@test.com' }),
      );
      expect(resendService.send).not.toHaveBeenCalled();
    });

    it('does not throw when Resend returns an error result', async () => {
      resendService.isConfigured.mockReturnValue(true);
      resendService.send.mockResolvedValue({
        status: 'error',
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      });

      await expect(
        service.sendInvitationEmail('user@test.com', 'https://activate.test', 'John'),
      ).resolves.toBeUndefined();
    });
  });
});
