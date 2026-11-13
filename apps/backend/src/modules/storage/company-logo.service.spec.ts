import { BadRequestException } from '@nestjs/common';

import { CompanyLogoService } from './company-logo.service';

describe('CompanyLogoService', () => {
  let storage: { upload: jest.Mock; getSignedUrl: jest.Mock };
  let prisma: { file: { create: jest.Mock }; company: { update: jest.Mock } };
  let service: CompanyLogoService;

  const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
    ({
      originalname: 'logo.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('fake'),
      ...overrides,
    }) as Express.Multer.File;

  beforeEach(() => {
    storage = {
      upload: jest.fn().mockResolvedValue({ bucket: 'b', key: 'logos/v1/uuid.png' }),
      getSignedUrl: jest.fn((key: string) => Promise.resolve(`https://signed.test/${key}`)),
    };
    prisma = { file: { create: jest.fn() }, company: { update: jest.fn() } };
    service = new CompanyLogoService(storage as never, prisma as never);
  });

  it('uploads under logos/<companyId>/, records the file and sets the company logo key', async () => {
    const file = makeFile();

    const result = await service.save('v1', file, 'u1');

    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^logos\/v1\/.+\.png$/),
      file.buffer,
      'image/png',
    );
    expect(prisma.file.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ key: 'logos/v1/uuid.png', uploadedById: 'u1' }),
    });
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { logoUrl: 'logos/v1/uuid.png' },
    });
    expect(result).toEqual({ id: 'v1', logoUrl: 'https://signed.test/logos/v1/uuid.png' });
  });

  it.each([
    ['no file', undefined],
    ['a non-image', makeFile({ mimetype: 'application/pdf' })],
    ['a file over 5 MB', makeFile({ size: 6 * 1024 * 1024 })],
  ])('rejects %s without uploading', async (_label, file) => {
    await expect(service.save('v1', file, 'u1')).rejects.toThrow(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
