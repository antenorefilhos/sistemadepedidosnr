/**
 * Resolve o destino de um StoreBanner (linkType + linkValue) para a rota que o
 * storefront abre.
 *
 * COPIA DELIBERADA de `resolveBannerLink` em
 * `sistema/frontend/src/utils/homeCategories.ts`. Backend e storefront sao
 * pacotes npm separados e cada imagem Docker builda com o contexto na propria
 * pasta -- um modulo compartilhado ficaria fora dos dois e quebraria o build.
 * Mesmo tratamento ja dado a tinta do overlay entre admin e storefront.
 *
 * O que impede as duas copias de divergirem em silencio e o teste de paridade
 * em `frontend/src/utils/homeCategories.test.ts`, que importa este arquivo e
 * compara as duas saidas. Se divergirem, o teste do storefront fica vermelho.
 *
 * Por que o backend precisa disso: a notificacao push que aponta pra um banner
 * tem que abrir exatamente onde o botao do banner abriria. Resolver aqui, na
 * hora do envio, e o unico jeito de gravar a URL certa no push.
 */

const normalizeCategoryCode = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const toCategoryUrlParam = (value: string) => normalizeCategoryCode(value).toLowerCase().replace(/_/g, '-')

const normalizeWineLink = (link?: string) => {
  if (!link) return '#'
  const normalized = link.trim().toLowerCase()
  if (normalized === '/vinhos' || normalized === '/adega' || normalized === '/adega-antenor') {
    return '/adega'
  }
  return link
}

export const resolveBannerLink = (linkValue?: string | null, linkType?: string): string => {
  if (!linkValue || !linkValue.trim()) return '/mercado'
  const trimmed = linkValue.trim()

  // URL externa completa (http:// ou https://)
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  // Produto: linkValue e o id do produto, rota fixa /produto/:id (ver App.tsx)
  if (linkType === 'product') {
    return trimmed.startsWith('/produto/') ? trimmed : `/produto/${trimmed}`
  }

  // Rota relativa ja formatada (ex: link avulso tipo "url" apontando /promocoes)
  if (trimmed.startsWith('/') && !trimmed.includes(' ') && !trimmed.includes('&')) {
    return normalizeWineLink(trimmed)
  }

  // Categoria: nome vindo do CMS -> slug de ?cat=. Adega tem pagina propria.
  const clean = trimmed.replace(/^\//, '').trim()
  const lower = clean.toLowerCase()
  if (lower.includes('adega') || lower.includes('vinho')) return '/adega'

  const slug = toCategoryUrlParam(clean)
  if (slug) return `/mercado?cat=${slug}`

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
