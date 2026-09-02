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
    version: '1.4.0',
    date: '02/09/2026',
    title: 'Entregas no Ar, Loja Destravada e Avisos ao Separador',
    highlights: [
      { type: 'fix', description: 'A loja pararia de vender assim que as janelas de entrega vencessem — bastava esquecer de cadastrar as de amanhã e todo cliente veria "janela de entrega inválida" no fechamento do pedido. Corrigido antes de acontecer.' },
      { type: 'fix', description: 'O aplicativo do entregador estava completamente quebrado: dava erro logo depois do login, sempre. Faltava uma coluna no banco que o sistema esperava desde o início.' },
      { type: 'feat', description: 'Nova tela "Entregas" em Operações: mostra os pedidos prontos esperando, monta a rota e libera para o entregador. Antes o pedido parava no caixa e ninguém conseguia passá-lo adiante.' },
      { type: 'feat', description: 'O entregador agora pega a entrega pelo próprio celular: vê a fila de pedidos prontos e toca em "pegar". A rota se monta sozinha, sem precisar de computador. Se dois entregadores tocarem no mesmo pedido, só um leva.' },
      { type: 'feat', description: 'O pedido só aparece para o entregador depois de finalizado no PDV — entregar mercadoria antes de faturar não é mais possível.' },
      { type: 'fix', description: 'A rota ficava marcada como "Montando" para sempre, mesmo com o entregador já na rua. Agora acompanha as paradas e fecha sozinha quando a última é entregue.' },
      { type: 'feat', description: 'O separador passa a ver quais itens o cliente NÃO aceita trocar. Antes ele decidia no escuro se podia substituir um produto em falta — e é ele quem fala com o cliente.' },
      { type: 'fix', description: 'Na confirmação de envio ao caixa, os botões apareciam espremidos num canto. Corrigidos, e com "Confirmar Envio" à esquerda e "Cancelar" à direita de propósito: toque duplo sem querer agora cai no Cancelar, não no envio, que é irreversível.' },
      { type: 'feat', description: 'A tela de Notificações ganhou histórico: o que foi disparado, quando, para quantos clientes e quantos leram.' },
      { type: 'feat', description: 'Ao disparar uma notificação dá para anexar um produto (com foto e link) ou apontar para um banner — o aviso abre exatamente onde aquele banner abre.' },
    ],
  },
  {
    version: '1.3.0',
    date: '28/08/2026',
    title: 'Avisos aos Clientes, E-mail Voltando a Sair e Vitrine Vigiada',
    highlights: [
      { type: 'fix', description: 'E-mail de "esqueci minha senha" nunca saía — nem o seu, nem o do cliente. A configuração de envio nunca chegou ao servidor. Corrigido e testado: agora sai de nao-responda@antenorefilhos.com.br.' },
      { type: 'feat', description: 'A lista de clientes ganhou a coluna "Avisos": mostra quem aceitou receber notificação no navegador. Antes não dava pra saber quantas pessoas um disparo alcançaria.' },
      { type: 'fix', description: 'O botão "Ativar notificações" da loja sumia quando o cliente passava o mouse em cima. Ele continuava funcionando, mas ninguém clica no que não vê — é provável que seja por isso que ninguém tinha ativado.' },
      { type: 'fix', description: 'As notificações chegavam com o logo apagado, se empilhavam uma sobre a outra e abriam uma aba nova a cada clique, fazendo o carrinho do cliente parecer perdido. As três coisas foram ajustadas.' },
      { type: 'fix', description: 'Quem fechava o aviso de notificação sem responder recebia "permissão bloqueada" e a instrução de mexer nas configurações do navegador — quando bastava tocar de novo. No celular Android isso era o caso comum, porque o Chrome mostra a pergunta como um sininho discreto que passa despercebido.' },
      { type: 'fix', description: 'A instrução para desbloquear notificação mandava procurar um "cadeado" que não existe no celular. Agora o texto muda conforme o aparelho.' },
      { type: 'fix', description: 'A geração automática de textos por IA tinha parado de funcionar: o modelo usado foi descontinuado pelo fornecedor em 26/08. Trocado por um atual, e agora uma falha dessas aparece como erro em vez de passar por "a IA decidiu não avisar".' },
      { type: 'feat', description: 'A loja passou a ser vigiada: se um produto marcado como SEMPRE no Solidcom sumir da vitrine, você recebe um e-mail de madrugada com a lista. Foi o que aconteceu com o "Limão kg".' },
      { type: 'fix', description: 'Produto marcado como SEMPRE no Solidcom sumia da vitrine e da busca sozinho, voltando só no dia seguinte. Eram 22 itens escondidos por engano (banana, tomate, melancia, laranja, couve, músculo, patinho, alcatra moída). Corrigido na raiz.' },
      { type: 'perf', description: 'Preço e estoque do Solidcom passam a ser atualizados 4 vezes por dia, em vez de só uma. A sincronização de encartes e promoções, que estava desligada, foi ligada.' },
      { type: 'feat', description: 'Banners agora aceitam uma foto separada para celular, e a foto se ajusta ao lado onde o texto está, para não cobrir o produto.' },
      { type: 'feat', description: 'Os banners passaram a contar quantas vezes foram vistos, não só quantas vezes foram clicados.' },
      { type: 'feat', description: 'A tela de banners ganhou explicações em cada campo, e o campo "Página de publicação" passou a funcionar de verdade — antes era salvo e ignorado.' },
      { type: 'fix', description: 'Alteração de banner no painel aparecia na loja só depois de limpar o cache do navegador. Agora aparece na hora.' },
    ],
  },
  {
    version: '1.2.8',
    date: '27/08/2026',
    title: 'Banner de Categoria na Loja e Ajustes de Navegação',
    highlights: [
      { type: 'feat', description: 'Banner de categoria agora aparece na loja: no topo da página da categoria escolhida e na Adega. Antes dava pra cadastrar, mas ele não era exibido em lugar nenhum.' },
      { type: 'feat', description: 'Dois modelos prontos de banner de categoria (Açougue e Adega) para começar sem partir do zero.' },
      { type: 'feat', description: 'Cliques nos banners intercalados passam a ser contabilizados, como já acontecia nos demais.' },
      { type: 'fix', description: 'Loja não desliza mais alguns pixels para o lado — a página deixou de ter barra de rolagem horizontal.' },
      { type: 'fix', description: 'Banners perderam o contorno dourado em volta: a foto agora vai até a borda do card, sem moldura.' },
      { type: 'fix', description: 'Botão dos banners de exemplo levava de volta para a mesma página. Agora aponta para as promoções.' },
    ],
  },
  {
    version: '1.2.7',
    date: '27/08/2026',
    title: 'Carrossel Hero em Cards, Overlay Direcional e Controle de Tempo',
    highlights: [
      { type: 'feat', description: 'Carrossel Hero virou faixa de cards individuais: cada banner desliza inteiro (imagem e texto juntos), com swipe 1:1 acompanhando o dedo.' },
      { type: 'feat', description: 'Tempo de exibição configurável por slide (3s, 5s, 7s, 10s ou valor livre até 60s) — banner com texto longo pode ficar mais tempo na tela.' },
      { type: 'feat', description: 'Overlay agora acompanha o alinhamento: escurece o lado onde o texto está e libera o outro pra foto aparecer.' },
      { type: 'feat', description: 'Cor do overlay aplicada com fidelidade — verde, azul, dourado e cores fortes não saem mais lavadas.' },
      { type: 'feat', description: 'Novo modelo pronto de banner para páginas de categoria (Destaque do Departamento).' },
      { type: 'feat', description: 'Limite de caracteres com contador nos campos do banner, alinhado ao que cabe sem cortar na loja.' },
      { type: 'fix', description: 'Hero e banners intercalados unificados em 3 zonas (selo no topo, texto no meio, botão na base) e com a mesma altura.' },
      { type: 'fix', description: 'Bolinhas do carrossel saíram de cima da foto para abaixo do card, centralizadas.' },
      { type: 'fix', description: 'Swipe do Hero voltou a funcionar no iPhone (Safari e Chrome).' },
      { type: 'fix', description: 'Edição de banner no admin reflete na loja em segundos, sem esperar o cache antigo de 10 minutos.' },
    ],
  },
  {
    version: '1.2.6',
    date: '26/08/2026',
    title: 'Gestão Visual de Banners, Sync Assíncrono e Expurgo ERP',
    highlights: [
      { type: 'feat', description: 'Novo modal de Banners em 2 camadas: básica com cards visuais ilustrados e avançada em acordeão.' },
      { type: 'feat', description: 'Sincronização assíncrona do ERP Solidcom em segundo plano com acompanhamento de status em tempo real.' },
      { type: 'feat', description: 'Distribuição intercalada e equilibrada dos banners promocionais entre as prateleiras da loja.' },
      { type: 'fix', description: 'Expurgo e inativação automática de produtos desativados no Solidcom (respeito a ativo=false no catálogo).' },
      { type: 'fix', description: 'Eliminação definitiva do vácuo no rodapé com alinhamento milimétrico acima da navegação mobile.' },
    ],
  },
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
