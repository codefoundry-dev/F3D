import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { AccessTokenGuard } from './access-token.guard';
import { AccessTokensService } from './access-tokens.service';

@Module({
  imports: [PrismaModule],
  providers: [AccessTokensService, AccessTokenGuard],
  exports: [AccessTokensService, AccessTokenGuard],
})
export class AccessTokensModule {}
