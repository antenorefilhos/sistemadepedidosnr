import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Migra os dados de HeroSlide e PromoBanner (fragmentados) para o modulo
 * unificado StoreBanner -- ver TASK_DEV_SPRINT_ADMIN_SEARCH_BANNERS_SOLIDCOM_ENCARTES.md.
 * As tabelas legadas continuam existindo (nada e apagado), so param de ser
 * usadas pelo admin/storefront depois desta migracao.
 *
 * Idempotente: pula quem ja tem um StoreBanner com o mesmo name+slot criado
 * por essa migracao (marcado via campo sponsorName vazio nao serve de chave;
 * usamos o par name+slot porque HeroSlide/PromoBanner nao tem um id externo
 * pra guardar de volta).
 */
async function main() {
  const [heroSlides, promoBanners, existingStoreBanners] = await Promise.all([
    prisma.heroSlide.findMany(),
    prisma.promoBanner.findMany(),
    prisma.storeBanner.findMany({ select: { name: true, slot: true } }),
  ])

  const existingKey = new Set(existingStoreBanners.map((b) => `${b.slot}::${b.name}`))

  let heroMigrated = 0
  for (const slide of heroSlides) {
    const key = `hero::${slide.title}`
    if (existingKey.has(key)) continue

    await prisma.storeBanner.create({
      data: {
        name: slide.title,
        slot: 'hero',
        active: slide.active,
        order: slide.order,
        desktopImageUrl: slide.imageUrl,
        title: slide.title,
        badgeText: slide.tag || null,
        description: slide.description || null,
        ctaLabel: slide.ctaLabel || null,
        linkType: 'url',
        linkValue: slide.link || null,
      },
    })
    heroMigrated += 1
  }

  let promoMigrated = 0
  for (const banner of promoBanners) {
    const key = `intercalado::${banner.title}`
    if (existingKey.has(key)) continue

    await prisma.storeBanner.create({
      data: {
        name: banner.title,
        slot: 'intercalado',
        active: banner.active,
        order: banner.order,
        desktopImageUrl: banner.imageUrl,
        title: banner.title,
        badgeText: banner.badge || null,
        highlightNote: banner.highlightNote || null,
        description: banner.description || null,
        ctaLabel: banner.ctaLabel || null,
        overlayColor: banner.overlayColor || null,
        align: banner.align || 'left',
        linkType: banner.highlightedProductId ? 'product' : 'url',
        linkValue: banner.highlightedProductId || banner.ctaTo || null,
      },
    })
    promoMigrated += 1
  }

  console.log(`${heroMigrated} hero slide(s) migrado(s) para StoreBanner (slot=hero).`)
  console.log(`${promoMigrated} promo banner(s) migrado(s) para StoreBanner (slot=intercalado).`)
  console.log('HeroSlide e PromoBanner nao foram apagados -- so pararam de ser lidos pelo admin/storefront.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
