import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';

import { ERR } from '../../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/decorators/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;
    const projectId = request.params.id;

    // List endpoints handle scoping in the service layer
    if (!projectId) return true;

    // SuperAdmin bypasses all project access checks
    if (user.role === UserRole.SUPER_ADMIN) return true;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });

    if (!project) throw new NotFoundException(ERR.projects.notFound);

    // CompanyAdmin can access all projects in their company
    if (user.role === UserRole.COMPANY_ADMIN && user.companyId === project.companyId) {
      return true;
    }

    // Other roles must be a project member
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: user.id },
      },
    });

    if (!membership) {
      throw new ForbiddenException(ERR.projects.notMember);
    }

    return true;
  }
}
