import { Bell, BellOff, BellRing } from 'lucide-react'
import { usePushEquipe } from '../hooks/usePushEquipe'

/**
 * Faixa que oferece ligar o aviso de pedido novo para separar, no aparelho.
 *
 * Fica visivel enquanto o push NAO estiver ativo, de proposito: o app so
 * cumpre o papel dele se avisar sozinho, e um funcionario que nao ligou isso
 * nao sabe que esta perdendo servico. Some assim que ativa -- lembrete
 * permanente vira ruido e ensina a ignorar a tela.
 */
export function AvisoPush() {
  const { estado, ocupado, ativar } = usePushEquipe()

  if (estado === 'carregando' || estado === 'ativo') return null

  const textoPorEstado: Record<string, string> = {
    negado:
      'As notificacoes estao bloqueadas para este site. Libere nas configuracoes do navegador para receber avisos de pedido novo para separar.',
    'sem-suporte':
      'Para receber avisos no iPhone, instale este app: toque em Compartilhar e depois em "Adicionar a Tela de Inicio".',
    'sem-https': 'Avisos so funcionam em conexao segura (https).',
    'sem-chave': 'Avisos indisponiveis: falta configurar a chave de notificacao no servidor.',
    erro: 'Nao foi possivel ativar os avisos agora. Tente de novo.',
    dispensado: 'Voce ainda nao respondeu o pedido de permissao. Toque para tentar de novo.',
  }
  const mensagem = textoPorEstado[estado]
  // Estados sem acao possivel do lado do funcionario nao ganham botao: botao
  // que nao resolve nada ensina que tocar nao adianta.
  const podeTentar = estado === 'desativado' || estado === 'dispensado' || estado === 'erro'

  return (
    <div className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <div className="flex items-start gap-2.5">
        {estado === 'negado' ? (
          <BellOff size={18} className="mt-0.5 shrink-0 text-amber-700" />
        ) : (
          <Bell size={18} className="mt-0.5 shrink-0 text-amber-700" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900">Avisos desligados</p>
          <p className="mt-0.5 text-xs text-amber-800">
            {mensagem || 'Ligue os avisos para ser chamado quando houver pedido novo para separar, mesmo com o app fechado.'}
          </p>
          {podeTentar && (
            <button
              type="button"
              onClick={ativar}
              disabled={ocupado}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white active:bg-amber-700 disabled:opacity-60"
            >
              <BellRing size={15} />
              {ocupado ? 'Ativando...' : 'Ativar avisos'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
