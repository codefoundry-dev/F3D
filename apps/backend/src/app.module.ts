import { randomUUID } from 'crypto';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { WinstonLoggerModule } from './common/logger/winston.logger';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BulkOrdersModule } from './modules/bulk-orders/bulk-orders.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GeminiModule } from './modules/gemini/gemini.module';
import { GoogleModule } from './modules/google/google.module';
import { HealthModule } from './modules/health/health.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { RfqsModule } from './modules/rfqs/rfqs.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { ViewsModule } from './modules/views/views.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // ── Configuration (global) ──────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      cache: true,
    }),

    // ── Correlation IDs (nestjs-cls) ────────────────────────────────────────
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: { headers: Record<string, string | undefined> }) =>
          req.headers['x-request-id'] ?? randomUUID(),
      },
    }),

    // ── Rate limiting ───────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000, // 1 minute
        limit: 100,
      },
    ]),

    // ── Database ────────────────────────────────────────────────────────────
    PrismaModule,

    // ── Logger ─────────────────────────────────────────────────────────────
    WinstonLoggerModule,

    // ── Domain modules ──────────────────────────────────────────────────────
    NotificationsModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    GoogleModule,
    GeminiModule,
    ProjectsModule,
    RfqsModule,
    PurchaseOrdersModule,
    BulkOrdersModule,
    InvoicesModule,
    MaterialsModule,
    DashboardModule,
    StorageModule,
    VendorsModule,
    MessagesModule,
    ViewsModule,
    HealthModule,
  ],
  providers: [
    // ── Global exception filter ─────────────────────────────────────────────
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },

    // ── Global interceptors (order matters: logging first, then transform) ──
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },

    // ── Global guards (throttler → jwt → roles) ─────────────────────────────
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
