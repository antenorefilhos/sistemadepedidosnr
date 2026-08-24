import { X, Sparkles, Wrench, Gauge, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ChangelogRelease {
  version: string;
  date: string;
  title: string;
  highlights: Array<{
    type: 'feat' | 'fix' | 'perf' | 'docs';
    description: string;
  }>;
}

export const ADMIN_CHANGELOG: ChangelogRelease[] = [
  {
    version: '1.2.5',
    date: '24/08/2026',
    title: 'Módulo de Mídia, Encartes ERP e Experiência Adega',
    highlights: [
      { type: 'feat', description: 'Unificação total dos gerenciadores em StoreBanners (Hero, Intercalado, Categorias e Tarjas).' },
      { type: 'feat', description: 'Vínculo de campanhas e encartes com o ERP Solidcom com vigência automática.' },
      { type: 'feat', description: 'Filtros por tipo de vinho na Adega (Tintos, Brancos, Rosés, Suaves, Espumantes).' },
      { type: 'fix', description: 'Busca inteligente de produtos no Admin com tokenização e ordenação por relevância.' },
      { type: 'fix', description: 'Ajuste do espaçamento inferior do rodapé no mobile e desktop.' },
    ],
  },
  {
    version: '1.2.4',
    date: '22/08/2026',
    title: 'Deduplicação Multi-EAN & Correções de Catálogo',
    highlights: [
      { type: 'fix', description: 'Fusão de 971 grupos de produtos duplicados no banco (catálogo consolidado sem duplicatas).' },
      { type: 'fix', description: 'Busca e leitor de código de barras aceitam EAN principal e secundários.' },
      { type: 'fix', description: 'Purga de categorias legadas do ERP mantendo estritamente as 17 categorias comerciais oficiais.' },
      { type: 'fix', description: 'Página da Adega carregando 54 rótulos ativos com fotos nítidas sobre fundo champagne.' },
    ],
  },
  {
    version: '1.2.3',
    date: '21/08/2026',
    title: 'Master Sprint: Storefront, Adega & Páginas Legais',
    highlights: [
      { type: 'feat', description: 'Páginas oficiais de Termos de Uso e Política de Privacidade (LGPD).' },
      { type: 'feat', description: 'Rodapé institucional completo com horários de loja e delivery, dados fiscais e métodos de pagamento.' },
      { type: 'feat', description: 'Novo visual da Adega com header glassmorphism e cards dark premium.' },
    ],
  },
];

const TYPE_CONFIG: Record<ChangelogRelease['highlights'][number]['type'], { label: string; icon: typeof Sparkles; className: string }> = {
  feat: { label: 'Novidade', icon: Sparkles, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  fix: { label: 'Correção', icon: Wrench, className: 'border-amber-200 bg-amber-50 text-amber-700' },
  perf: { label: 'Performance', icon: Gauge, className: 'border-blue-200 bg-blue-50 text-blue-700' },
  docs: { label: 'Documentação', icon: FileText, className: 'border-gray-200 bg-gray-50 text-gray-700' },
};

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChangelogModal({ open, onClose }: ChangelogModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-[linear-gradient(180deg,#fffafc_0%,#fff_100%)]">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={18} className="text-[#8A6A3A]" />
              Novidades do Admin
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Histórico de versões e atualizações recentes</p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-gray-400 hover:bg-gray-100"
            aria-label="Fechar changelog"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
          {ADMIN_CHANGELOG.map((release, idx) => (
            <div key={release.version} className="relative">
              {idx < ADMIN_CHANGELOG.length - 1 && (
                <div className="absolute left-[7px] top-6 bottom-[-2rem] w-px bg-gray-100" />
              )}
              <div className="flex items-start gap-3">
                <div className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#5D082A] bg-white" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">v{release.version}</span>
                    <span className="text-xs text-gray-400">{release.date}</span>
                  </div>
                  <h3 className="mt-0.5 text-sm font-semibold text-[#5D082A]">{release.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {release.highlights.map((highlight, hIdx) => {
                      const config = TYPE_CONFIG[highlight.type];
                      const Icon = config.icon;
                      return (
                        <li key={hIdx} className="flex items-start gap-2 text-sm text-gray-600">
                          <Badge variant="outline" className={`mt-0.5 shrink-0 h-auto px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.className}`}>
                            <Icon size={10} />
                            {config.label}
                          </Badge>
                          <span className="leading-relaxed">{highlight.description}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400">Antenor & Filhos · Painel Admin</p>
        </div>
      </div>
    </div>
  );
}
