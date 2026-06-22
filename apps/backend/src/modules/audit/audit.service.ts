import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PrismaService } from '../../prisma/prisma.service';

export { AuditAction };

export class AuditLogQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value))
  limit?: number = 25;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  performedById?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

interface LogInput {
  action: AuditAction;
  /** Null for guest (tokenised) actions — pair with `performedByLabel`. */
  performedById: string | null;
  /** Human label for a guest action when there is no `performedById` (FOR-247). */
  performedByLabel?: string;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: LogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: input.action,
        performedById: input.performedById,
        performedByLabel: input.performedByLabel,
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel: input.targetLabel,
        metadata: input.metadata ?? Prisma.JsonNull,
        ipAddress: input.ipAddress,
      },
    });
  }

  async listLogs(query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (query.action) where.action = query.action;
    if (query.targetType) where.targetType = query.targetType;
    if (query.performedById) where.performedById = query.performedById;

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
