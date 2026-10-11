/**
 * Compartilhado entre HeroSlider, PromoBanner e o popup (Home.tsx) -- os
 * mapas de alinhamento viviam copiados e colados em cada arquivo, e foi
 * assim que o título do PromoBanner ficou sem o mesmo `line-clamp-2` do
 * HeroSlider por meses: o HeroSlider corrigiu um recorte de texto na sua
 * própria cópia e o PromoBanner nunca recebeu a mesma correção (achado em
 * 11/10/2026, revisão de banners). Os três usam os mesmos valores daqui em
 * vez de redefinir, pra essa divergência não voltar a acontecer.
 */
export type BannerAlign = 'left' | 'center' | 'right'

export const BANNER_ALIGN_CLASSES: Record<BannerAlign, string> = {
  left: 'self-start items-start text-left',
  center: 'self-center items-center text-center',
  right: 'self-end items-end text-right',
}

// A descricao e mais estreita que o bloco (max-w-*%), entao precisa da margem
// auto correspondente pra encostar no mesmo lado que o texto aponta -- sem
// isso, em align=right/center ela ficaria presa a esquerda do bloco.
export const BANNER_DESCRIPTION_ALIGN_CLASSES: Record<BannerAlign, string> = {
  left: '',
  center: 'mx-auto',
  right: 'ml-auto',
}

// O admin limita titulo a 60 caracteres e descricao a 160 partindo do
// pressuposto de que o storefront corta com reticencia nesses pontos (ver
// comentario de FIELD_LIMITS em StoreBannersManager.tsx). Sem o clamp, texto
// no limite quebra em mais linhas do que o card tem altura pra mostrar e e
// cortado cru pelo overflow-hidden do card -- nao reticenciado, cortado no
// meio da linha.
export const BANNER_TITLE_CLAMP = 'line-clamp-2'
export const BANNER_DESCRIPTION_CLAMP = 'line-clamp-3'
