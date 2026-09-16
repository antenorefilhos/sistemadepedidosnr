import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Layers, Maximize2, Minimize2, Monitor, Smartphone, X } from 'lucide-react';
import { resolveApiUrl } from '../services/api';
import { Button } from '@/components/ui/button';
import { buildOverlayGradient } from '../utils/bannerOverlay';
import type { StoreBanner } from '../utils/bannerTemplates';

/* Mockup da loja usado no painel lateral e no modal de tela cheia de
 * StoreBannersManager -- extraido (JON-65, Auditoria 360) por so depender de
 * props, sem estado do formulario. */

type PreviewDevice = 'desktop' | 'mobile';
type PreviewSize = 'default' | 'large';

/** Dimensoes e tipografia do mockup por tamanho -- "default" e o painel
 * lateral (coluna mais larga desde o pedido do usuario: 320px era espremido
 * demais pra ser util), "large" e o modal de tela cheia (Maximize2). */
const PREVIEW_SIZES: Record<PreviewSize, {
  mobileWidth: number;
  heroHeight: number;
  heroHeightMobile: number;
  tarjaHeight: number;
  interHeight: number;
  interHeightMobile: number;
  title: string;
  badge: string;
  cta: string;
  strip: string;
  shelfTitle: string;
  shelfCard: string;
}> = {
  default: {
    mobileWidth: 300,
    heroHeight: 148,
    heroHeightMobile: 190,
    tarjaHeight: 40,
    interHeight: 100,
    interHeightMobile: 118,
    title: 'text-xs',
    badge: 'text-[10px] px-2 py-0.5',
    cta: 'text-[10px] px-2.5 py-1',
    strip: 'text-xs',
    shelfTitle: 'text-[11px]',
    shelfCard: 'h-16',
  },
  large: {
    mobileWidth: 340,
    heroHeight: 240,
    heroHeightMobile: 280,
    tarjaHeight: 56,
    interHeight: 160,
    interHeightMobile: 180,
    title: 'text-base',
    badge: 'text-xs px-2.5 py-1',
    cta: 'text-xs px-3 py-1.5',
    strip: 'text-sm',
    shelfTitle: 'text-sm',
    shelfCard: 'h-24',
  },
};

/** Mini prateleira de produtos placeholder -- o preview representa a ordem e o
 * layout real da Home (ver Home.tsx), nao o catalogo real (buscar produtos
 * aqui seria peso extra pro admin sem ganho: o que importa validar aqui e o
 * banner, nao o card de produto). */
function MiniShelf({ title, size }: { title: string; size: PreviewSize }) {
  const s = PREVIEW_SIZES[size];
  return (
    <div className="px-3 py-3">
      <p className={`mb-2 font-bold uppercase tracking-wide text-gray-500 ${s.shelfTitle}`}>{title}</p>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex-1 rounded-md border border-gray-100 bg-gray-50 ${s.shelfCard}`} />
        ))}
      </div>
    </div>
  );
}

function PreviewBadge({ text, className }: { text?: string | null; className: string }) {
  if (!text) return null;
  return (
    <span className={`inline-flex w-fit items-center rounded bg-[#D2BB8A] font-bold uppercase tracking-wide text-[#231F20] ${className}`}>
      {text}
    </span>
  );
}

/** Overlay do banner no preview. Sem `align` gera tinta chapada, que e o que
 * tarja e popup usam; com `align` gera o mesmo gradiente direcional do
 * hero/intercalado/categoria -- senao o preview mostrava cor uniforme e o
 * operador so descobria a direcao real depois de publicar. A tinta em si vem
 * de utils/bannerOverlay.ts, cuja paridade com o storefront e garantida por
 * teste (ver o cabecalho daquele arquivo). */
function bannerOverlayStyle(overlayColor?: string | null, align?: 'left' | 'center' | 'right'): CSSProperties {
  const raw = overlayColor || 'rgba(35, 31, 32, 0.45)';
  return { background: align ? buildOverlayGradient(raw, align) : raw };
}

function PreviewBannerTile({
  banner,
  onSelect,
  height,
  size,
  layout = 'card',
  className,
}: {
  banner: StoreBanner;
  onSelect: (b: StoreBanner) => void;
  height: number;
  size: PreviewSize;
  /** 'strip' = faixa fina (tarja), uma linha de texto centralizada.
   *  'card' = badge + titulo + CTA empilhados no rodape (hero, intercalado). */
  layout?: 'strip' | 'card';
  className?: string;
}) {
  const s = PREVIEW_SIZES[size];
  return (
    <button
      type="button"
      onClick={() => onSelect(banner)}
      title={`Editar "${banner.name}"`}
      className={`group relative block w-full overflow-hidden rounded-md text-left ring-1 ring-black/5 transition-transform hover:scale-[1.01] ${className || ''}`}
      style={{ height }}
    >
      <img src={resolveApiUrl(banner.desktopImageUrl)} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="absolute inset-0"
        style={bannerOverlayStyle(banner.overlayColor, layout === 'strip' ? undefined : banner.align || 'left')}
      />
      {layout === 'strip' ? (
        <div className="relative z-10 flex h-full items-center gap-2 px-3">
          {banner.badgeText && (
            <span className={`shrink-0 rounded bg-[#D2BB8A] font-bold uppercase tracking-wide text-[#231F20] ${s.badge}`}>
              {banner.badgeText}
            </span>
          )}
          <p className={`truncate font-bold leading-none text-white ${s.strip}`}>{banner.title || banner.name}</p>
        </div>
      ) : (
        <div
          className={`relative z-10 flex h-full flex-col justify-end gap-1 p-2.5 ${
            banner.align === 'center' ? 'items-center text-center' : banner.align === 'right' ? 'items-end text-right' : 'items-start text-left'
          }`}
        >
          <PreviewBadge text={banner.badgeText} className={s.badge} />
          <p className={`line-clamp-2 font-bold leading-tight text-white ${s.title}`}>{banner.title || banner.name}</p>
          {banner.ctaLabel && (
            <span className={`w-fit rounded-sm bg-white/95 font-bold text-[#5D082A] ${s.cta}`}>{banner.ctaLabel}</span>
          )}
        </div>
      )}
      <span className="absolute inset-0 opacity-0 ring-2 ring-inset ring-gray-900 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

/**
 * Mockup da loja em si -- extraido de PreviewLayout pra ser reaproveitado
 * identico no painel lateral ("default") e no modal de tela cheia
 * ("large"), sem duplicar a logica de qual banner mostrar em cada slot.
 */
function PreviewMockup({
  size,
  isMobile,
  heroSlides,
  currentHero,
  heroIndex,
  setHeroIndex,
  tarja,
  pair,
  popup,
  popupOpen,
  setPopupOpen,
  onSelectBanner,
}: {
  size: PreviewSize;
  isMobile: boolean;
  heroSlides: StoreBanner[];
  currentHero: StoreBanner | undefined;
  heroIndex: number;
  setHeroIndex: (i: number) => void;
  tarja: StoreBanner | undefined;
  pair: StoreBanner[];
  popup: StoreBanner | undefined;
  popupOpen: boolean;
  setPopupOpen: (v: boolean) => void;
  onSelectBanner: (b: StoreBanner) => void;
}) {
  const s = PREVIEW_SIZES[size];
  return (
    <div
      className={`relative mx-auto select-none overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all ${
        isMobile ? '' : 'max-w-full'
      }`}
      style={isMobile ? { width: s.mobileWidth } : undefined}
    >
      {/* Bezel de smartphone no modo mobile -- deixa claro que e um mockup de
          tela, nao so uma coluna estreita cortando o layout desktop. */}
      {isMobile && (
        <div className="flex justify-center bg-gray-900 pb-1.5 pt-2.5">
          <div className="h-1 w-10 rounded-full bg-gray-600" />
        </div>
      )}

      {/* Tarja informativa */}
      {tarja ? (
        <PreviewBannerTile banner={tarja} onSelect={onSelectBanner} height={s.tarjaHeight} size={size} layout="strip" className="rounded-none" />
      ) : (
        <div className="flex h-7 items-center justify-center border-b border-dashed border-gray-200 text-xs text-gray-300">
          Sem tarja ativa
        </div>
      )}

      {/* Header mockup */}
      <div className="space-y-2 bg-[#5D082A] px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-20 rounded-full bg-white/40" />
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-white/25" />
            <div className="h-3 w-3 rounded-full bg-white/25" />
          </div>
        </div>
        <div className="h-5 rounded-full bg-white/95" />
        {!isMobile && (
          <div className="flex gap-1.5 overflow-hidden pt-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-5 w-5 shrink-0 rounded-full bg-white/15" />
            ))}
          </div>
        )}
      </div>

      {/* Hero */}
      {currentHero ? (
        <div className="relative">
          <PreviewBannerTile
            banner={currentHero}
            onSelect={onSelectBanner}
            height={isMobile ? s.heroHeightMobile : s.heroHeight}
            size={size}
            className="rounded-none"
          />
          {heroSlides.length > 1 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-10 flex justify-center gap-1.5">
              {heroSlides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHeroIndex(i);
                  }}
                  aria-label={`Ver slide ${i + 1}`}
                  className={`pointer-events-auto h-1.5 rounded-full transition-all ${
                    i === heroIndex ? 'w-5 bg-[#D2BB8A]' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-20 items-center justify-center border-b border-dashed border-gray-200 text-xs text-gray-300">
          Hero vazio
        </div>
      )}

      {/* Vitrine 1 */}
      <MiniShelf title="Ofertas para hoje" size={size} />

      {/* Banners intercalados */}
      {pair.length > 0 && (
        <div className={isMobile ? 'flex gap-2 overflow-hidden px-3 pb-3' : 'grid grid-cols-2 gap-2 px-3 pb-3'}>
          {pair.map((banner, i) => (
            <PreviewBannerTile
              key={banner.id}
              banner={banner}
              onSelect={onSelectBanner}
              height={isMobile ? s.interHeightMobile : s.interHeight}
              size={size}
              className={isMobile ? (i === 0 ? 'w-[78%] shrink-0' : 'w-[20%] shrink-0') : undefined}
            />
          ))}
        </div>
      )}

      {/* Vitrine 2 */}
      <MiniShelf title="Frescos da loja" size={size} />

      {/* Popup promocional */}
      <div className="border-t border-dashed border-gray-200 px-3 py-2">
        {popup ? (
          <button
            type="button"
            onClick={() => setPopupOpen(!popupOpen)}
            className="flex w-full items-center justify-between text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            <span className="flex items-center gap-1.5">
              <Layers size={13} /> Popup "{popup.name}"
            </span>
            {popupOpen ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        ) : (
          <p className="text-[11px] text-gray-300">Sem popup ativo</p>
        )}
      </div>

      {/* Popup: modal suspenso sobre o mockup inteiro, igual ao storefront */}
      {popup && popupOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full overflow-hidden rounded-lg bg-[#F7F0E4] shadow-xl ${size === 'large' ? 'max-w-[280px]' : 'max-w-[220px]'}`}>
            <button
              type="button"
              onClick={() => setPopupOpen(false)}
              aria-label="Fechar preview do popup"
              className="absolute right-2 top-2 z-10 rounded-full bg-black/30 p-1 text-white"
            >
              <X size={12} />
            </button>
            <button type="button" onClick={() => onSelectBanner(popup)} className="block w-full text-left">
              <div className="relative w-full" style={{ height: size === 'large' ? 130 : 96 }}>
                <img src={resolveApiUrl(popup.desktopImageUrl)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0" style={bannerOverlayStyle(popup.overlayColor)} />
              </div>
              <div className="space-y-1.5 p-3">
                <PreviewBadge text={popup.badgeText} className={s.badge} />
                <p className={`font-bold leading-tight text-[#231F20] ${s.title}`}>{popup.title || popup.name}</p>
                {popup.ctaLabel && (
                  <span className={`block w-full rounded bg-[#5D082A] text-center font-bold text-white ${s.cta}`}>
                    {popup.ctaLabel}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PreviewLayout({ banners, onSelectBanner }: { banners: StoreBanner[]; onSelectBanner: (b: StoreBanner) => void }) {
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [heroIndex, setHeroIndex] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const heroSlides = useMemo(
    () => banners.filter((b) => b.active && b.slot === 'hero' && b.desktopImageUrl).sort((a, b) => a.order - b.order),
    [banners],
  );
  const tarja = useMemo(
    () => banners.find((b) => b.active && b.slot === 'tarja' && b.desktopImageUrl),
    [banners],
  );
  const intercalados = useMemo(
    () => banners.filter((b) => b.active && b.slot === 'intercalado' && b.desktopImageUrl).sort((a, b) => a.order - b.order),
    [banners],
  );
  const popup = useMemo(
    () => banners.find((b) => b.active && b.slot === 'popup' && b.desktopImageUrl),
    [banners],
  );

  useEffect(() => {
    if (heroIndex >= heroSlides.length) setHeroIndex(0);
  }, [heroSlides.length, heroIndex]);

  // Esc fecha o modal de tela cheia, igual a qualquer outro modal do admin.
  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expanded]);

  const currentHero = heroSlides[heroIndex];
  const pair = intercalados.slice(0, 2);
  const isMobile = device === 'mobile';

  const deviceToggle = (
    <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      {([
        { value: 'desktop' as PreviewDevice, label: 'Desktop', icon: Monitor },
        { value: 'mobile' as PreviewDevice, label: 'Mobile', icon: Smartphone },
      ]).map((opt) => {
        const Icon = opt.icon;
        const active = device === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDevice(opt.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={13} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const mockupProps = {
    isMobile,
    heroSlides,
    currentHero,
    heroIndex,
    setHeroIndex,
    tarja,
    pair,
    popup,
    popupOpen,
    setPopupOpen,
    onSelectBanner,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">{deviceToggle}</div>
        <Button
          type="button"
          onClick={() => setExpanded(true)}
          variant="outline"
          size="icon"
          title="Expandir pré-visualização"
          className="h-[34px] w-[34px] shrink-0 rounded-lg border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <Maximize2 size={15} />
        </Button>
      </div>

      <PreviewMockup size="default" {...mockupProps} />

      {expanded && createPortal(
        // Portal pro <body>: o layout do admin tem o <header> do menu
        // principal com z-50 e a pagina inteira roda dentro de um <main
        // overflow-auto> -- mesmo com z-[100] aqui, essa combinacao faz o
        // header pintar por cima do modal em vez de atras (confirmado com
        // elementsFromPoint no devtools: o header aparecia primeiro no
        // hit-test mesmo com z-index menor). Renderizar direto no body
        // tira o modal desse contexto de empilhamento de vez.
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6">
          <div className="absolute inset-0" onClick={() => setExpanded(false)} />
          <div className="relative z-10 flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Pré-visualização ampliada</p>
                <p className="text-xs text-gray-400">Clique em qualquer banner pra editar</p>
              </div>
              <div className="flex items-center gap-2">
                {deviceToggle}
                <Button
                  type="button"
                  onClick={() => setExpanded(false)}
                  variant="outline"
                  size="icon"
                  title="Sair da tela cheia"
                  className="h-[34px] w-[34px] shrink-0 rounded-lg border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Minimize2 size={15} />
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto p-6">
              <PreviewMockup size="large" {...mockupProps} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
