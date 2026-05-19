import { Injectable, NotFoundException } from '@nestjs/common';

import { ERR } from '../../common/constants/error-messages.const';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateViewDto {
  name: string;
  tableName: string;
  visibleColumns?: string[];
  columnOrder?: string[];
  sortBy?: string;
  sortDir?: string;
  quickFilter?: string;
  groupBy?: string;
}

interface UpdateViewDto {
  name?: string;
  visibleColumns?: string[];
  columnOrder?: string[];
  sortBy?: string | null;
  sortDir?: string | null;
  quickFilter?: string | null;
  groupBy?: string | null;
}

@Injectable()
export class ViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listViews(userId: string, tableName: string) {
    const views = await this.prisma.userTableView.findMany({
      where: { userId, tableName },
      orderBy: { createdAt: 'asc' },
    });

    return views.map((v) => ({
      id: v.id,
      name: v.name,
      tableName: v.tableName,
      visibleColumns: v.visibleColumns,
      columnOrder: v.columnOrder,
      sortBy: v.sortBy,
      sortDir: v.sortDir,
      quickFilter: v.quickFilter,
      groupBy: v.groupBy,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async createView(userId: string, dto: CreateViewDto) {
    const view = await this.prisma.userTableView.create({
      data: {
        userId,
        name: dto.name,
        tableName: dto.tableName,
        visibleColumns: dto.visibleColumns ?? [],
        columnOrder: dto.columnOrder ?? [],
        sortBy: dto.sortBy,
        sortDir: dto.sortDir,
        quickFilter: dto.quickFilter,
        groupBy: dto.groupBy,
      },
    });

    return {
      id: view.id,
      name: view.name,
      tableName: view.tableName,
      visibleColumns: view.visibleColumns,
      columnOrder: view.columnOrder,
      sortBy: view.sortBy,
      sortDir: view.sortDir,
      quickFilter: view.quickFilter,
      groupBy: view.groupBy,
      createdAt: view.createdAt.toISOString(),
    };
  }

  async updateView(userId: string, viewId: string, dto: UpdateViewDto) {
    const existing = await this.prisma.userTableView.findFirst({
      where: { id: viewId, userId },
    });

    if (!existing) throw new NotFoundException(ERR.views.notFound);

    const view = await this.prisma.userTableView.update({
      where: { id: viewId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.visibleColumns !== undefined && { visibleColumns: dto.visibleColumns }),
        ...(dto.columnOrder !== undefined && { columnOrder: dto.columnOrder }),
        ...(dto.sortBy !== undefined && { sortBy: dto.sortBy }),
        ...(dto.sortDir !== undefined && { sortDir: dto.sortDir }),
        ...(dto.quickFilter !== undefined && { quickFilter: dto.quickFilter }),
        ...(dto.groupBy !== undefined && { groupBy: dto.groupBy }),
      },
    });

    return {
      id: view.id,
      name: view.name,
      tableName: view.tableName,
      visibleColumns: view.visibleColumns,
      columnOrder: view.columnOrder,
      sortBy: view.sortBy,
      sortDir: view.sortDir,
      quickFilter: view.quickFilter,
      groupBy: view.groupBy,
      createdAt: view.createdAt.toISOString(),
    };
  }

  async deleteView(userId: string, viewId: string) {
    const existing = await this.prisma.userTableView.findFirst({
      where: { id: viewId, userId },
    });

    if (!existing) throw new NotFoundException(ERR.views.notFound);

    await this.prisma.userTableView.delete({ where: { id: viewId } });
  }

  async deleteAllViews(userId: string, tableName: string) {
    await this.prisma.userTableView.deleteMany({
      where: { userId, tableName },
    });
  }
}
