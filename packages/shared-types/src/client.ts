// Client-safe exports (no NestJS, class-validator, or class-transformer dependencies)

// Enums
export * from './enums/index';

// Dependency-free DTO types & guards (bom.dto has no @nestjs/swagger decorators,
// so it is safe to ship to the browser — unlike the rest of ./dtos/*).
export * from './dtos/bom.dto';

// Validation utils
export * from './validation';

// Zod schemas (client-side validation)
export * from './schemas/auth.schema';
export * from './schemas/user.schema';
export * from './schemas/project.schema';
export * from './schemas/rfq.schema';
