import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface StoreBannerPayload {
  name: string;
  type?: string;
  active?: boolean;
  link?: string;
  linkTarget?: string;
  title?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  pages?: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  order?: number;
}

@Injectable()
export class StoreBannersService {
  private readonly uploadsDir = join(process.cwd(), 'uploads');

  constructor(private readonly prisma: PrismaService) {}

  private extractFilenameFromUrl(url: string): string | null {
    const match = url.match(/\/uploads\/(.+)$/);
    return match ? match[1] : null;
  }

  private async deleteFile(filename: string): Promise<void> {
    if (!filename) return;
    try {
      const filepath = join(this.uploadsDir, filename);
      await fs.unlink(filepath);
    } catch (err) {
      // Arquivo já deletado ou não existe — continuar silenciosamente
      console.warn(`[StoreBanners] Arquivo não encontrado ou já deletado: ${filename}`, err.message);
    }
  }

  findActive() {
    const now = new Date();
    return this.prisma.storeBanner.findMany({
      where: {
        active: true,
        OR: [
          { scheduledStart: null },
          { scheduledStart: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { scheduledEnd: null },
              { scheduledEnd: { gte: now } },
            ],
          },
        ],
      },
      orderBy: { order: 'asc' },
    });
  }

  findAll() {
    return this.prisma.storeBanner.findMany({ orderBy: { order: 'asc' } });
  }

  create(data: StoreBannerPayload) {
    return this.prisma.storeBanner.create({
      data: {
        name: data.name,
        type: data.type ?? 'full',
        active: data.active ?? true,
        link: data.link ?? null,
        linkTarget: data.linkTarget ?? '_self',
        title: data.title ?? null,
        imageUrl: data.imageUrl,
        mobileImageUrl: data.mobileImageUrl ?? null,
        pages: data.pages ?? 'home',
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
        scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
        order: data.order ?? 0,
      },
    });
  }

  async update(id: string, data: Partial<StoreBannerPayload>) {
    const existing = await this.prisma.storeBanner.findUnique({ where: { id } });
    if (!existing) throw new Error(`Banner não encontrado: ${id}`);

    // Limpar imagem desktop anterior se uma nova for fornecida
    if (data.imageUrl !== undefined && existing.imageUrl !== data.imageUrl) {
      const filename = this.extractFilenameFromUrl(existing.imageUrl);
      if (filename) await this.deleteFile(filename);
    }

    // Limpar imagem mobile anterior se uma nova for fornecida
    if (data.mobileImageUrl !== undefined && existing.mobileImageUrl !== data.mobileImageUrl) {
      const filename = this.extractFilenameFromUrl(existing.mobileImageUrl);
      if (filename) await this.deleteFile(filename);
    }

    return this.prisma.storeBanner.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.link !== undefined && { link: data.link || null }),
        ...(data.linkTarget !== undefined && { linkTarget: data.linkTarget }),
        ...(data.title !== undefined && { title: data.title || null }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.mobileImageUrl !== undefined && { mobileImageUrl: data.mobileImageUrl || null }),
        ...(data.pages !== undefined && { pages: data.pages }),
        ...(data.scheduledStart !== undefined && { scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null }),
        ...(data.scheduledEnd !== undefined && { scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
  }

  remove(id: string) {
    return this.prisma.storeBanner.delete({ where: { id } });
  }

  async deleteWithCleanup(id: string) {
    const banner = await this.prisma.storeBanner.findUnique({ where: { id } });
    if (!banner) throw new Error(`Banner não encontrado: ${id}`);

    // Limpar arquivos de disco
    if (banner.imageUrl) {
      const filename = this.extractFilenameFromUrl(banner.imageUrl);
      if (filename) await this.deleteFile(filename);
    }

    if (banner.mobileImageUrl) {
      const filename = this.extractFilenameFromUrl(banner.mobileImageUrl);
      if (filename) await this.deleteFile(filename);
    }

    // Deletar do BD
    return this.prisma.storeBanner.delete({ where: { id } });
  }
}
