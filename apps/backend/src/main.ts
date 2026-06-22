import { setDefaultResultOrder } from 'node:dns';

import { ClassSerializerInterceptor, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';

// Node 18+ defaults DNS resolution to "verbatim" order, which often returns the
// IPv6 (AAAA) address first. On hosts with broken IPv6, outbound HTTPS (e.g. the
// Gemini API) stalls until the dead IPv6 connection attempt times out — which
// surfaces as request timeouts. Prefer IPv4 unless explicitly overridden.
setDefaultResultOrder(
  (process.env.DNS_RESULT_ORDER as 'ipv4first' | 'verbatim' | undefined) ?? 'ipv4first',
);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Preserve the raw request body so the Resend webhook (FOR-213) can verify
    // the Svix signature against the exact bytes Resend signed.
    rawBody: true,
  });

  app.use(cookieParser());

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // ── Request body size ───────────────────────────────────────────────────────
  // The default body-parser limit (~100kb) is far too small for catalogue
  // ingest (FOR-228): confirming/editing a large extraction sends the full
  // edited result (tens of thousands of rows ≈ 10MB+) as JSON. Raise the JSON
  // and urlencoded limits while keeping rawBody capture intact for the Resend
  // webhook. Configurable via MAX_REQUEST_BODY_SIZE.
  const bodyLimit = configService.get<string>('MAX_REQUEST_BODY_SIZE', '50mb');
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:5179')
    .split(',')
    .map((o) => o.trim());

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.enableCors({
    origin: nodeEnv === 'production' ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    // `X-Access-Token` carries the tokenised vendor-portal credential (FOR-246/247
    // PO portal, Epic 6 delivery portal). It is a custom header, so cross-origin
    // browsers send a CORS preflight; it must be allow-listed or the real request
    // is blocked and the portal page misreads the failure as an invalid link.
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'X-App-Id', 'X-Access-Token'],
  });

  // ── API versioning ─────────────────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Global pipes & interceptors ────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ── Swagger / OpenAPI ──────────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Forethread API')
      .setDescription('B2B Procurement Management Platform REST API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addServer(`http://localhost:${String(port)}`, 'Local Development')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  const appUrl = configService.get<string>('APP_URL', `http://localhost:${String(port)}`);
  logger.log(`Backend running at ${appUrl}`);
  if (nodeEnv !== 'production') {
    logger.log(`Swagger UI available at ${appUrl}/api`);
  }
}

// Suppress the floating promise lint rule — this is the intentional entry point
void bootstrap();
