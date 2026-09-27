import type { Product } from '../types'

// URL limpa e semantica do produto: /p/<nome-em-slug>-<erpProductId>.
// O codigo do ERP no fim e o que resolve o produto (estavel); o nome e so
// para leitura/SEO -- se o nome mudar, a URL antiga continua abrindo o mesmo
// produto e o canonical aponta para a nova.
export const slugify = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const productPath = (product: Pick<Product, 'id' | 'name' | 'erpProductId'>) =>
  product.erpProductId ? `/p/${slugify(product.name)}-${product.erpProductId}` : `/produto/${product.id}`

/** Extrai o erpProductId do fim do slug (`vinho-tinto-...-22030` -> `22030`). */
export const erpIdFromSlug = (slug: string) => (String(slug || '').match(/-(\d+)$/) || [])[1] || ''
