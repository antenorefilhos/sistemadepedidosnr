import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RadioTower, RefreshCw, Unlock, ShieldAlert, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { mostruarioAdminAPI, type MostruarioProduto } from '../services/api'

function formatMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TIER_LABEL: Record<string, { label: string; className: string }> = {
  TIER_1_GARANTIDO_SEMPRE: { label: 'Presença garantida', className: 'bg-green-100 text-green-700' },
  TIER_2_ATIVO_REGULAR: { label: 'Cauda longa ativa', className: 'bg-blue-100 text-blue-700' },
  TIER_2_CONDICIONAL_ESTOQUE: { label: 'Cauda longa ativa', className: 'bg-blue-100 text-blue-700' },
  TIER_3_QUARENTENA_PICKING: { label: 'Quarentena', className: 'bg-amber-100 text-amber-700' },
}

/**
 * JON-205 (22/09/2026): governanca do "Motor de Presenca Real & Mostruario
 * Inteligente" (v1.18.0, AEF-048) -- a AntenorApi passou a decidir
 * SEMPRE/ESTOQUE/NUNCA por sinais reais (venda no PDV, cortes de picking),
 * nao so pelo estoque cru do ERP. Esta tela e a janela pro Jonathan ver e
 * agir sobre essa decisao, sem precisar confiar cegamente na automacao.
 */
export default function Mostruario() {
  const [filialId] = useState(1)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: metricas, isLoading: loadingMetricas } = useQuery({
    queryKey: ['mostruario-metricas', filialId],
    queryFn: () => mostruarioAdminAPI.getMetricas(filialId).then((r) => r.data),
  })

  const { data: quarentena, isLoading: loadingQuarentena } = useQuery({
    queryKey: ['mostruario-quarentena', filialId],
    queryFn: () => mostruarioAdminAPI.getQuarentena(filialId).then((r) => r.data),
  })

  const { data: salvos, isLoading: loadingSalvos } = useQuery({
    queryKey: ['mostruario-salvos', filialId],
    queryFn: () => mostruarioAdminAPI.getProdutosSalvos(filialId).then((r) => r.data),
  })

  const recalcularMutation = useMutation({
    mutationFn: () => mostruarioAdminAPI.recalcular(filialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mostruario-metricas', filialId] })
      queryClient.invalidateQueries({ queryKey: ['mostruario-quarentena', filialId] })
      queryClient.invalidateQueries({ queryKey: ['mostruario-salvos', filialId] })
    },
  })

  const unlockMutation = useMutation({
    mutationFn: (produto: MostruarioProduto) =>
      mostruarioAdminAPI.desbloquear({ cdProduto: produto.cdProduto, filialId, motivo: 'Liberado manualmente pela gerência' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mostruario-quarentena', filialId] })
      setUnlockError(null)
    },
    onError: (err: any) => setUnlockError(err?.response?.data?.message || 'Erro ao desbloquear produto.'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <RadioTower size={22} /> Mostruário Inteligente
          </h1>
          <p className="text-sm text-gray-500">Quais produtos a AntenorApi mantém no ar mesmo com estoque zerado, e quem está em quarentena por corte de separação.</p>
        </div>
        <Button variant="outline" onClick={() => recalcularMutation.mutate()} disabled={recalcularMutation.isPending}>
          <RefreshCw size={16} className={`mr-1 ${recalcularMutation.isPending ? 'animate-spin' : ''}`} />
          {recalcularMutation.isPending ? 'Recalculando...' : 'Recalcular agora'}
        </Button>
      </div>

      {/* Resumo */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        {loadingMetricas ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : !metricas ? (
          <p className="text-sm text-gray-500">Sem dados.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-md bg-green-50 p-3">
                <p className="text-xs font-semibold uppercase text-green-700">Salvos do estoque negativo</p>
                <p className="mt-1 text-2xl font-bold text-green-800">{metricas.impactoOperacional.produtosSalvosDoEstoqueNegativo}</p>
              </div>
              <div className="rounded-md bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase text-blue-700">Ativos no site</p>
                <p className="mt-1 text-2xl font-bold text-blue-800">{metricas.resumo.totalAtivosNoSite}</p>
              </div>
              <div className="rounded-md bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase text-amber-700">Em quarentena agora</p>
                <p className="mt-1 text-2xl font-bold text-amber-800">{metricas.resumo.emQuarentenaPicking}</p>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase text-gray-600">Catálogo garantido</p>
                <p className="mt-1 text-2xl font-bold text-gray-800">{metricas.impactoOperacional.percentualCatalogoGarantido}%</p>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <TrendingUp size={16} /> Departamentos com mais itens salvos
              </p>
              <div className="space-y-1.5">
                {metricas.topDepartamentosGarantidos.slice(0, 6).map((d) => (
                  <div key={d.departamento} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{d.departamento}</span>
                    <span className="text-gray-500">{d.itensSalvos} de {d.totalItens}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-400">Atualizado em {new Date(metricas.atualizadoEm).toLocaleString('pt-BR')}</p>
          </>
        )}
      </div>

      {/* Quarentena */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <ShieldAlert size={18} className="text-amber-600" />
          <h2 className="font-semibold text-gray-900">Em quarentena</h2>
          <span className="text-xs text-gray-400">(2+ cortes de separação nas últimas 48h — some da loja até vender de novo no PDV)</span>
        </div>
        {loadingQuarentena ? (
          <p className="p-6 text-sm text-gray-500">Carregando...</p>
        ) : !quarentena?.length ? (
          <p className="p-6 text-sm text-gray-400">Nenhum produto em quarentena agora.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Cortes (48h)</th>
                <th className="px-4 py-3">Último corte</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {quarentena.map((p) => (
                <tr key={p.cdProduto} className="border-b border-gray-50">
                  <td className="px-4 py-3">{p.nome}</td>
                  <td className="px-4 py-3">{p.totalCortesPicking48h}</td>
                  <td className="px-4 py-3">{p.ultimoCortePicking ? new Date(p.ultimoCortePicking).toLocaleString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => unlockMutation.mutate(p)}
                      disabled={unlockMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Unlock size={14} /> Liberar agora
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {unlockError && <p className="border-t border-gray-100 p-3 text-sm font-medium text-red-600">{unlockError}</p>}
      </div>

      {/* Produtos salvos */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Salvos do estoque negativo</h2>
          <p className="text-xs text-gray-400">Estoque no ERP está zerado/negativo, mas o produto continua vendendo de verdade no caixa — mantido online.</p>
        </div>
        {loadingSalvos ? (
          <p className="p-6 text-sm text-gray-500">Carregando...</p>
        ) : !salvos?.length ? (
          <p className="p-6 text-sm text-gray-400">Nenhum produto nessa situação agora.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Estoque ERP</th>
                <th className="px-4 py-3">Vendas PDV (48h)</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Preço</th>
              </tr>
            </thead>
            <tbody>
              {salvos.map((p) => {
                const tier = TIER_LABEL[p.tier] || { label: p.tier, className: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={p.cdProduto} className="border-b border-gray-50">
                    <td className="px-4 py-3">
                      {p.nome}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${tier.className}`}>{tier.label}</span>
                    </td>
                    <td className="px-4 py-3 text-red-600">{p.estoqueERP}</td>
                    <td className="px-4 py-3">{p.vezesVendidoPDV48h}x</td>
                    <td className="px-4 py-3">{p.scorePresencaReal}</td>
                    <td className="px-4 py-3">{formatMoney(p.precoVenda)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
