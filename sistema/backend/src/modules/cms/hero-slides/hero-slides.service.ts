import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';

const DEFAULT_HERO_SLIDES = [
  {
    title: 'Vinhos que valem a pena',
    tag: 'Seleção Especial',
    description: 'Rótulos selecionados para presentear, comemorar ou deixar seu pedido mais especial.',
    ctaLabel: 'Ver vinhos',
    imageUrl: 'https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?auto=format&fit=crop&w=1600&q=80',
    link: '/adega',
    active: true,
  },
  {
    title: 'Padaria Artesanal',
    tag: 'Saiu do forno',
    description: 'Pães, bolos e lanches fresquinhos para deixar seu café ainda mais gostoso.',
    ctaLabel: 'Ver padaria',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1600&q=80',
    link: '/busca?q=padaria',
    active: true,
  },
];

@Injectable()
export class HeroSlidesService {
  constructor(private prisma: PrismaService) {}

  private async ensureDefaultData() {
    const existing = await this.prisma.heroSlide.findMany({
      select: { title: true, order: true },
      orderBy: { order: 'asc' },
    });

    const existingTitles = new Set(existing.map(item => item.title));
    const maxOrder = existing.length ? Math.max(...existing.map(item => item.order)) : -1;

    const missing = DEFAULT_HERO_SLIDES.filter(item => !existingTitles.has(item.title)).map((item, index) => ({
      ...item,
      order: maxOrder + index + 1,
    }));

    if (missing.length > 0) {
      await this.prisma.heroSlide.createMany({ data: missing });
    }
  }

  async findAll() {
    await this.ensureDefaultData();
    return this.prisma.heroSlide.findMany({
      orderBy: { order: 'asc' },
    });
  }

  create(data: { title: string; tag?: string; description?: string; ctaLabel?: string; imageUrl: string; link?: string; order?: number }) {
    return this.prisma.heroSlide.create({
      data,
    });
  }

  update(id: string, data: { title?: string; tag?: string; description?: string; ctaLabel?: string; imageUrl?: string; link?: string; active?: boolean; order?: number }) {
    return this.prisma.heroSlide.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.heroSlide.delete({
      where: { id },
    });
  }
}
