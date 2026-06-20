// Client-safe exports (no NestJS, class-validator, or class-transformer dependencies)

// Enums
export * from './enums/index';

// Dependency-free DTO types & guards (bom.dto / quote-extraction.dto have no
// @nestjs/swagger decorators, so they are safe to ship to the browser — unlike
// the rest of ./dtos/*).
export * from './dtos/bom.dto';
export * from './dtos/quote-extraction.dto';
export * from './dtos/catalogue-extraction.dto';
export * from './dtos/po-delivery.types';
export * from './dtos/user-profile.types';
export * from './dtos/email-log.types';
export * from './dtos/inventory.types';
export * from './dtos/delivery.types';

// Validation utils
export * from './validation';

// Zod schemas (client-side validation)
export * from './schemas/auth.schema';
export * from './schemas/user.schema';
export * from './schemas/project.schema';
export * from './schemas/rfq.schema';
export * from './schemas/material.schema';
