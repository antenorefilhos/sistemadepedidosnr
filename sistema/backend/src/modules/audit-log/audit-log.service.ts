import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    tenantId?: string;
    storeId?: string | null;
    action: string;
    entity: string;
    entityId: string;
    adminId?: string;
    changes?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: data.tenantId || 'tenant_default',
        storeId: data.storeId || null,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        adminId: data.adminId,
        changes: data.changes ? JSON.stringify(data.changes) : null,
      },
    });
  }

  async findAll() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
