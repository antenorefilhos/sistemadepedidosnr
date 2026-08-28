/**
 * Regras do formulario de banner que valem a pena travar em teste.
 *
 * Moravam soltas dentro de StoreBannersManager.tsx. Saíram de lá porque a
 * regra de `pages` estava escrita duas vezes (no seletor de slot e no aplicar
 * modelo) — duas copias da mesma decisao e' exatamente como uma delas fica pra
 * tras sem ninguem notar.
 */
export type BannerSlot = 'hero' | 'intercalado' | 'category' | 'tarja' | 'popup';

export type BannerPages = 'home' | 'all' | 'category' | 'product';

/**
 * Onde cada slot naturalmente aparece. Banner de categoria criado com o default
 * 'home' ficaria salvo e invisivel na loja — a falha silenciosa que ja custou
 * caro neste projeto.
 */
export const DEFAULT_PAGES_BY_SLOT: Record<BannerSlot, BannerPages> = {
  hero: 'home',
  intercalado: 'home',
  category: 'category',
  tarja: 'home',
  popup: 'home',
};

/**
 * A pagina de publicacao acompanha o slot, com uma excecao: "Todas as paginas"
 * e' escolha deliberada de quem quer o banner em mais de um lugar, entao trocar
 * o slot nao pode desfazer isso.
 */
export const resolvePagesForSlot = (currentPages: BannerPages, slot: BannerSlot): BannerPages =>
  currentPages === 'all' ? 'all' : DEFAULT_PAGES_BY_SLOT[slot];

/** Limites de caracteres do formulario, alinhados ao que o card comporta. */
export const FIELD_LIMITS = {
  title: 60,
  description: 160,
  badgeText: 25,
  sponsorName: 30,
  ctaLabel: 25,
} as const;
