import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Notifica admins sobre pendências de mapeamento
   */
  async notifyPendingCategoryMappings() {
    const pendingMappings = await this.prisma.categoryMappingPending.findMany({
      where: { status: 'PENDING' },
      select: { id: true, ean: true, productName: true, createdAt: true },
    });

    if (pendingMappings.length === 0) {
      return 'Nenhuma pendência encontrada para notificar';
    }

    let created = 0;

    for (const mapping of pendingMappings) {
      const body = `Produto pendente: ${mapping.productName} (EAN: ${mapping.ean})`;
      const exists = await this.prisma.notification.findFirst({
        where: {
          type: 'CATEGORY_MAPPING_PENDING',
          body,
          read: false,
          customerId: null,
        },
        select: { id: true },
      });

      if (exists) continue;

      await this.prisma.notification.create({
        data: {
          type: 'CATEGORY_MAPPING_PENDING',
          title: 'Pendência de mapeamento',
          body,
          customerId: null,
        },
      });
      created += 1;
    }

    return `${created} notificações criadas para pendências.`;
  }

  /**
   * Lista notificações para admins
   */
  async listNotifications(limit = 20, offset = 0) {
    const notifications = await this.prisma.notification.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const total = await this.prisma.notification.count();

    return { notifications, total };
  }

  /**
   * Marca notificações como lidas
   */
  async markAsRead(notificationIds: string[]) {
    await this.prisma.notification.updateMany({
      where: { id: { in: notificationIds } },
      data: { read: true },
    });

    return `${notificationIds.length} notificações marcadas como lidas.`;
  }

  async listPendingMappingNotifications(limit = 20, offset = 0) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        type: 'CATEGORY_MAPPING_PENDING',
        customerId: null,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.notification.count({
      where: {
        type: 'CATEGORY_MAPPING_PENDING',
        customerId: null,
      },
    });

    const unread = await this.prisma.notification.count({
      where: {
        type: 'CATEGORY_MAPPING_PENDING',
        customerId: null,
        read: false,
      },
    });

    return { notifications, total, unread };
  }

  async markOneAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }
}