import { AlertTriangle, Layers, LayoutGrid, Monitor, Tag } from 'lucide-react';
import type { BannerPages, BannerSlot } from './bannerRules';

/* Tipos e constantes de StoreBannersManager -- extraidos (JON-65, Auditoria
 * 360) por serem dados puros sem estado, usados tanto pelo formulario quanto
 * pelo preview. */

export type LinkType = 'url' | 'category' | 'product' | 'search' | 'campaign';
export type LinkTarget = '_self' | '_blank';

export interface StoreBanner {
  id: string;
  name: string;
  slot: BannerSlot;
  targetCategory?: string | null;
  active: boolean;
  linkType: LinkType;
  linkValue?: string | null;
  linkTarget: LinkTarget;
  title?: string | null;
  description?: string | null;
  badgeText?: string | null;
  highlightNote?: string | null;
  ctaLabel?: string | null;
  overlayColor?: string | null;
  displayDuration?: number;
  align?: 'left' | 'center' | 'right';
  sponsorName?: string | null;
  desktopImageUrl: string;
  mobileImageUrl?: string | null;
  pages: BannerPages;
  startDate?: string | null;
  endDate?: string | null;
  campaignErpId?: number | null;
  campaignName?: string | null;
  campaignEndDate?: string | null;
  campaignFound?: boolean | null;
  order: number;
  impressionsCount: number;
  clicksCount: number;
}

export interface FormState {
  name: string;
  slot: BannerSlot;
  targetCategory: string;
  active: boolean;
  linkType: LinkType;
  linkValue: string;
  linkTarget: LinkTarget;
  title: string;
  description: string;
  badgeText: string;
  highlightNote: string;
  ctaLabel: string;
  overlayColor: string;
  align: 'left' | 'center' | 'right';
  displayDuration: number;
  sponsorName: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  pages: BannerPages;
  startDate: string;
  endDate: string;
  campaignErpId: string;
}

export interface FormErrors {
  name?: string;
  desktopImageUrl?: string;
  endDate?: string;
}

export interface Notice {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

export const SLOT_TABS: { value: BannerSlot | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'hero', label: 'Carrossel Hero' },
  { value: 'intercalado', label: 'Banners Intercalados' },
  { value: 'category', label: 'Categorias' },
  { value: 'tarja', label: 'Tarjas Informativas' },
  { value: 'popup', label: 'Popup' },
];

export const SLOT_OPTIONS: { value: BannerSlot; label: string; shortLabel: string; dims: string; icon: typeof Monitor }[] = [
  { value: 'hero', label: 'Topo Principal (Hero Carousel)', shortLabel: 'Hero Carousel', dims: 'Desktop até 1920px · Mobile até 767px', icon: Monitor },
  { value: 'intercalado', label: 'Entre as Prateleiras (Intercalado)', shortLabel: 'Intercalado', dims: 'Desktop até 850px · Mobile até 767px', icon: LayoutGrid },
  { value: 'category', label: 'Topo de Categoria', shortLabel: 'Categoria', dims: 'Desktop até 850px · Mobile até 767px', icon: Tag },
  { value: 'tarja', label: 'Tarja de Aviso / Regras', shortLabel: 'Tarja', dims: 'Desktop até 1920px · Mobile até 767px', icon: AlertTriangle },
  { value: 'popup', label: 'Popup', shortLabel: 'Popup', dims: 'Desktop até 900px · Mobile até 767px', icon: Layers },
];

// 'product' fica de fora: a pagina de produto nao renderiza banner nenhum
// hoje, entao oferecer a opcao seria prometer o que nao acontece. Volta
// quando existir o espaco la (ver "espacos patrocinados" em docs/roadmap.md).
export const PAGES_OPTIONS: { value: BannerPages; label: string }[] = [
  { value: 'home', label: 'Página inicial' },
  { value: 'category', label: 'Páginas de categoria' },
  { value: 'all', label: 'Todas as páginas' },
];

export const SLOT_LABEL: Record<BannerSlot, string> = {
  hero: 'Hero',
  intercalado: 'Intercalado',
  category: 'Categoria',
  tarja: 'Tarja',
  popup: 'Popup',
};

export const SLOT_COLOR: Record<BannerSlot, string> = {
  hero: 'bg-blue-100 text-blue-700',
  intercalado: 'bg-purple-100 text-purple-700',
  category: 'bg-emerald-100 text-emerald-700',
  tarja: 'bg-amber-100 text-amber-700',
  popup: 'bg-rose-100 text-rose-700',
};

/**
 * Medidas derivadas da proporção REAL do card em cada tela (medido em
 * 28/08/2026 na loja em produção, 390px e 1440px), em 2x para tela retina:
 *
 *   hero        mobile 1.49:1   desktop 3.67:1
 *   category    mobile 1.53:1   desktop 3.67:1   (largura cheia, igual ao hero)
 *   intercalado mobile 1.49:1   desktop 1.81:1   (meia largura no desktop)
 *   tarja       mobile 7.2:1    desktop 22.3:1
 *
 * As anteriores estavam chutadas: hero mobile pedia 1080x1350 (retrato) para
 * um card deitado, e categoria repetia a medida do intercalado sendo que ela
 * ocupa a largura toda. Arte na proporção errada não quebra — o object-cover
 * corta —, mas o operador perde justamente a parte que quis mostrar.
 */
export const ART_GUIDE: Record<BannerSlot, { desktop: string; desktopKb: number; mobile: string; mobileKb: number }> = {
  hero: { desktop: '1920x520', desktopKb: 350, mobile: '800x540', mobileKb: 180 },
  category: { desktop: '1920x520', desktopKb: 350, mobile: '800x540', mobileKb: 180 },
  intercalado: { desktop: '1240x686', desktopKb: 260, mobile: '800x540', mobileKb: 180 },
  tarja: { desktop: '1920x88', desktopKb: 180, mobile: '800x110', mobileKb: 120 },
  popup: { desktop: '900x600', desktopKb: 220, mobile: '900x600', mobileKb: 180 },
};

export const MAX_IMAGE_SIZE_MB = 5;

export const OVERLAY_PRESETS: { label: string; hex: string }[] = [
  { label: 'Preto', hex: '#000000' },
  { label: 'Marrom Antenor', hex: '#231F20' },
  { label: 'Vinho', hex: '#5D082A' },
  { label: 'Dourado', hex: '#D2BB8A' },
  { label: 'Verde', hex: '#0F5132' },
  { label: 'Azul', hex: '#1E3A5F' },
];

export const DEFAULT_OVERLAY_HEX = '#231F20';
export const DEFAULT_OVERLAY_OPACITY = 60;

export const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

export const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;

/** Interpreta o overlayColor salvo (rgba(...) ou #hex) em {hex, opacidade 0-100}. */
export const parseOverlayColor = (value: string): { hex: string; opacity: number } => {
  const trimmed = value.trim();
  const rgbaMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/i);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    return {
      hex: rgbToHex(Number(r), Number(g), Number(b)),
      opacity: a !== undefined ? Math.round(Number(a) * 100) : 100,
    };
  }
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    const { r, g, b } = hexToRgb(trimmed);
    return { hex: rgbToHex(r, g, b), opacity: 100 };
  }
  return { hex: DEFAULT_OVERLAY_HEX, opacity: DEFAULT_OVERLAY_OPACITY };
};

export const composeOverlayColor = (hex: string, opacityPct: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${(opacityPct / 100).toFixed(2)})`;
};

/**
 * Modelos ricos pra comecar de algo pronto em vez de formulario em branco --
 * cobrem os 4 slots (hero, intercalado, tarja, popup) com badge, CTA, overlay
 * e alinhamento ja definidos. Imagem e nome continuam manuais (nao da pra
 * adivinhar). Aplicar um modelo so sobrescreve esses campos, o resto do
 * formulario (link, agendamento, patrocinador) fica intacto.
 */
export type BannerTemplate = {
  id: string;
  slot: BannerSlot;
  label: string;
  swatch: string;
  title: string;
  description: string;
  badgeText: string;
  ctaLabel: string;
  overlayColor: string;
  align?: 'left' | 'center' | 'right';
};

export const BANNER_TEMPLATES: BannerTemplate[] = [
  {
    id: 'hero-lancamento',
    slot: 'hero',
    label: 'Hero — Lançamento',
    swatch: '#231F20',
    title: 'Chegou a novidade que você esperava',
    description: 'Conheça os lançamentos da semana com condições especiais.',
    badgeText: 'Novidade',
    ctaLabel: 'Conferir agora',
    overlayColor: composeOverlayColor('#231F20', 55),
  },
  {
    id: 'hero-oferta',
    slot: 'hero',
    label: 'Hero — Grande Oferta',
    swatch: '#5D082A',
    title: 'Grande oferta da semana',
    description: 'Preços especiais por tempo limitado. Aproveite antes que acabe.',
    badgeText: 'Só essa semana',
    ctaLabel: 'Ver ofertas',
    overlayColor: composeOverlayColor('#5D082A', 60),
  },
  {
    id: 'intercalado-destaque',
    slot: 'intercalado',
    label: 'Intercalado — Produto em Destaque',
    swatch: '#231F20',
    title: 'Direto da nossa seleção especial',
    description: 'Qualidade Antenor & Filhos com preço que cabe no seu bolso.',
    badgeText: 'Mais vendido',
    ctaLabel: 'Aproveitar',
    overlayColor: composeOverlayColor('#231F20', 65),
    align: 'left',
  },
  {
    id: 'intercalado-combo',
    slot: 'intercalado',
    label: 'Intercalado — Combo Econômico',
    swatch: '#0F5132',
    title: 'Monte seu combo e economize',
    description: 'Combine produtos selecionados e pague menos.',
    badgeText: 'Economia',
    ctaLabel: 'Montar combo',
    overlayColor: composeOverlayColor('#0F5132', 60),
    align: 'right',
  },
  {
    id: 'category-departamento',
    slot: 'category',
    label: 'Categoria — Destaque do Departamento',
    swatch: '#5D082A',
    title: 'O melhor do departamento',
    description: 'Seleção de itens escolhidos a dedo para esta categoria.',
    badgeText: 'Especial',
    ctaLabel: 'Ver departamento',
    overlayColor: composeOverlayColor('#5D082A', 55),
    align: 'left',
  },
  {
    id: 'tarja-frete',
    slot: 'tarja',
    label: 'Tarja — Frete Grátis',
    swatch: '#1E3A5F',
    title: 'Frete grátis acima de R$150',
    description: 'Válido para toda a loja, direto no seu endereço.',
    badgeText: 'Frete grátis',
    ctaLabel: 'Aproveitar agora',
    overlayColor: composeOverlayColor('#231F20', 35),
  },
  {
    id: 'popup-cupom',
    slot: 'popup',
    label: 'Popup — Cupom de Boas-vindas',
    swatch: '#D2BB8A',
    title: 'Ganhe 10% na primeira compra',
    description: 'Use o cupom no fechamento do pedido.',
    badgeText: 'Exclusivo',
    ctaLabel: 'Resgatar cupom',
    overlayColor: composeOverlayColor('#5D082A', 70),
  },
];

export const emptyForm = (): FormState => ({
  name: '',
  slot: 'hero',
  targetCategory: '',
  active: true,
  linkType: 'url',
  linkValue: '',
  linkTarget: '_self',
  title: '',
  description: '',
  badgeText: '',
  highlightNote: '',
  ctaLabel: '',
  overlayColor: '',
  align: 'left',
  displayDuration: 5,
  sponsorName: '',
  desktopImageUrl: '',
  mobileImageUrl: '',
  pages: 'home',
  startDate: '',
  endDate: '',
  campaignErpId: '',
});

export const isValidUrl = (v: string) => {
  if (!v.trim()) return true;
  if (v.startsWith('/')) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

// Preview de "pra onde o link vai" no formulario de categoria. Espelha (sem
// importar, admin e storefront sao apps separados) a heuristica adega/vinho
// + slug de sistema/frontend/src/utils/homeCategories.ts:resolveBannerLink --
// qualquer ajuste na regra de slug de categoria precisa ser feito nos dois lugares.
export const previewCategoryDestination = (categoryName: string) => {
  const lower = categoryName.toLowerCase();
  if (lower.includes('adega') || lower.includes('vinho')) return '/adega';
  const slug = lower
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `/mercado?cat=${slug}`;
};

export type ScheduleStatus = 'scheduled' | 'live' | 'expired' | 'always' | 'campaign-live' | 'campaign-missing';

export function getScheduleStatus(item: StoreBanner): ScheduleStatus {
  if (item.campaignErpId != null) {
    return item.campaignFound ? 'campaign-live' : 'campaign-missing';
  }
  const now = Date.now();
  const start = item.startDate ? new Date(item.startDate).getTime() : null;
  const end = item.endDate ? new Date(item.endDate).getTime() : null;
  if (start && now < start) return 'scheduled';
  if (end && now > end) return 'expired';
  if (!start && !end) return 'always';
  return 'live';
}

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  scheduled: 'Agendado',
  live: 'No ar',
  expired: 'Expirado',
  always: 'Sempre ativo',
  'campaign-live': 'Segue encarte',
  'campaign-missing': 'Encarte não sincronizado',
};

export const SCHEDULE_STATUS_COLOR: Record<ScheduleStatus, string> = {
  scheduled: 'text-amber-600',
  live: 'text-emerald-600',
  expired: 'text-gray-400',
  always: 'text-gray-400',
  'campaign-live': 'text-emerald-600',
  'campaign-missing': 'text-amber-600',
};
