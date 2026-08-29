import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Truck, Plus, Play, CheckCircle2, MapPin, RefreshCw, PackageCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { fulfillmentAPI, ordersAPI } from '../../services/api'

/**
 * Roteirizacao: transforma pedido separado em rota que o app do entregador ve.
 *
 * Este era o elo que faltava na operacao inteira. O backend tinha o CRUD de
 * rota desde sempre e o cliente da API do admin tambem -- `createRoute`,
 * `addStop`, `startRoute` --, mas NENHUMA tela chamava. Resultado: o separador
 * mandava o pedido pro caixa e ali ele parava, porque ninguem conseguia montar
 * rota. Por isso a producao tinha zero rotas, zero paradas e zero eventos de
 * motorista, com o fluxo de entrega nunca tendo rodado uma unica vez.
 */

/** Status de pedido que ja pode entrar numa rota (saiu da separacao). */
const PRONTOS_PARA_ROTA = ['READY_FOR_CHECKOUT', 'READY_FOR_DELIVERY']

// Valores reais do backend (schema.prisma + delivery.service.ts). Eu tinha
// chutado PENDING/IN_PROGRESS aqui e estava errado: rota nasce PLANNED e vai
// pra OUT_FOR_DELIVERY ao ser liberada.
const STATUS_ROTA: Record<string, { label: string; classe: string }> = {
  PLANNED: { label: 'Montando', classe: 'bg-amber-50 text-amber-700' },
  READY: { label: 'Pronta', classe: 'bg-sky-50 text-sky-700' },
  OUT_FOR_DELIVERY: { label: 'Em rota', classe: 'bg-blue-50 text-blue-700' },
  COMPLETED: { label: 'Concluída', classe: 'bg-emerald-50 text-emerald-700' },
}

const STATUS_PARADA: Record<string, string> = {
  PENDING: 'Aguardando',
  OUT_FOR_DELIVERY: 'A caminho',
  DELIVERED: 'Entregue',
  FAILED: 'Falhou',
}

export default function DeliveryRoutesSection() {
  const queryClient = useQueryClient()
  const [motoristaId, setMotoristaId] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['fulfillment-routes'] })
    queryClient.invalidateQueries({ queryKey: ['orders-prontos-rota'] })
  }

  const { data: motoristas = [] } = useQuery({
    queryKey: ['fulfillment-drivers'],
    queryFn: async () => (await fulfillmentAPI.listDrivers()).data,
  })

  const { data: rotas = [], isLoading: carregandoRotas } = useQuery({
    queryKey: ['fulfillment-routes'],
    queryFn: async () => (await fulfillmentAPI.listRoutes()).data,
  })

  // Pedidos que sairam da separacao e ainda nao estao em nenhuma rota. O filtro
  // de "ja esta em rota" e feito aqui porque o endpoint de pedidos nao sabe de
  // rota -- sao modulos separados.
  const { data: prontos = [] } = useQuery({
    queryKey: ['orders-prontos-rota'],
    queryFn: async () => {
      const todos = await Promise.all(
        PRONTOS_PARA_ROTA.map(async (status) => (await ordersAPI.getAll({ status })).data),
      )
      return todos.flat()
    },
  })

  const idsEmRota = new Set(rotas.flatMap((r) => r.stops.map((s) => s.orderId)))
  const disponiveis = prontos.filter(
    (p) => !idsEmRota.has(p.id) && (p as { fulfillmentType?: string }).fulfillmentType !== 'PICKUP',
  )

  const comErro = (acao: string) => () => setErro(`Não foi possível ${acao}. Tente novamente.`)

  const criarRota = useMutation({
    mutationFn: () => fulfillmentAPI.createRoute({ driverId: motoristaId || undefined }),
    onSuccess: () => { setErro(null); invalidar() },
    onError: comErro('criar a rota'),
  })

  const adicionarParada = useMutation({
    mutationFn: ({ routeId, orderId }: { routeId: string; orderId: string }) =>
      fulfillmentAPI.addStop(routeId, { orderId }),
    onSuccess: () => { setErro(null); invalidar() },
    onError: comErro('adicionar o pedido à rota'),
  })

  const iniciarRota = useMutation({
    mutationFn: (routeId: string) => fulfillmentAPI.startRoute(routeId),
    onSuccess: () => { setErro(null); invalidar() },
    onError: comErro('liberar a rota'),
  })

  const concluirRota = useMutation({
    mutationFn: (routeId: string) => fulfillmentAPI.completeRoute(routeId),
    onSuccess: () => { setErro(null); invalidar() },
    onError: comErro('concluir a rota'),
  })

  const rotasAbertas = rotas.filter((r) => r.status !== 'COMPLETED')

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck size={20} className="text-[#5D082A]" />
          <h1 className="text-2xl font-bold text-gray-800">Entregas</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={invalidar}>
          <RefreshCw size={14} /> Atualizar
        </Button>
      </div>

      {erro && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      {motoristas.length === 0 && (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nenhum entregador cadastrado. Um perfil de entregador é criado sozinho quando você dá
          acesso ao módulo <strong>Entrega</strong> a alguém na tela de Equipe.
        </p>
      )}

      {/* Nova rota */}
      <div className="mb-6 rounded-xl border border-[#f1dbe3] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Nova rota</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="rota-motorista" className="mb-1 block text-xs font-semibold text-gray-600">
              Entregador
            </label>
            <Select id="rota-motorista" value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)}>
              <option value="">Definir depois</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>
          <Button type="button" onClick={() => criarRota.mutate()} disabled={criarRota.isPending}>
            <Plus size={15} /> {criarRota.isPending ? 'Criando...' : 'Criar rota'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          A rota só aparece no aplicativo do entregador depois de liberada.
        </p>
      </div>

      {/* Pedidos aguardando rota */}
      <div className="mb-6 rounded-xl border border-[#f1dbe3] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <PackageCheck size={16} className="text-[#5D082A]" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Aguardando rota ({disponiveis.length})
          </h2>
        </div>
        {disponiveis.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhum pedido de entrega esperando. Pedidos aparecem aqui depois que a separação termina.
          </p>
        ) : (
          <ul className="space-y-2">
            {disponiveis.map((pedido) => (
              <li key={pedido.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
                <span className="font-mono text-xs text-gray-500">{pedido.id.slice(0, 8)}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">
                  {pedido.customer?.name ?? 'Cliente'}
                </span>
                {rotasAbertas.length === 0 ? (
                  <span className="text-xs text-gray-400">Crie uma rota primeiro</span>
                ) : (
                  <Select
                    aria-label={`Adicionar pedido ${pedido.id.slice(0, 8)} a uma rota`}
                    value=""
                    onChange={(e) => e.target.value && adicionarParada.mutate({ routeId: e.target.value, orderId: pedido.id })}
                    className="w-auto"
                  >
                    <option value="">Adicionar à rota...</option>
                    {rotasAbertas.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.driver?.name ?? 'Sem entregador'} — {r.stops.length} parada(s)
                      </option>
                    ))}
                  </Select>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rotas */}
      <div className="rounded-xl border border-[#f1dbe3] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Rotas</h2>
        {carregandoRotas ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : rotas.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma rota criada ainda.</p>
        ) : (
          <ul className="space-y-4">
            {rotas.map((rota) => {
              const st = STATUS_ROTA[rota.status] ?? { label: rota.status, classe: 'bg-gray-100 text-gray-600' }
              const entregues = rota.stops.filter((s) => s.status === 'DELIVERED').length
              return (
                <li key={rota.id} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.classe}`}>{st.label}</Badge>
                    <span className="text-sm font-semibold text-gray-800">
                      {rota.driver?.name ?? 'Sem entregador'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {entregues}/{rota.stops.length} entregue(s)
                    </span>
                    <div className="ml-auto flex gap-2">
                      {(rota.status === 'PLANNED' || rota.status === 'READY') && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => iniciarRota.mutate(rota.id)}
                          disabled={rota.stops.length === 0 || !rota.driverId || iniciarRota.isPending}
                          title={
                            !rota.driverId
                              ? 'Defina um entregador antes de liberar'
                              : rota.stops.length === 0
                                ? 'Adicione ao menos um pedido'
                                : 'Libera a rota no aplicativo do entregador'
                          }
                        >
                          <Play size={13} /> Liberar
                        </Button>
                      )}
                      {rota.status === 'OUT_FOR_DELIVERY' && (
                        <Button type="button" size="sm" variant="outline" onClick={() => concluirRota.mutate(rota.id)} disabled={concluirRota.isPending}>
                          <CheckCircle2 size={13} /> Concluir
                        </Button>
                      )}
                    </div>
                  </div>

                  {rota.stops.length > 0 && (
                    <ul className="mt-3 space-y-1 border-l-2 border-[#E8D7B0] pl-3">
                      {rota.stops.map((parada) => (
                        <li key={parada.id} className="flex items-center gap-2 text-sm">
                          <MapPin size={12} className="shrink-0 text-gray-400" />
                          <span className="font-mono text-xs text-gray-500">{parada.sequence}.</span>
                          <span className="font-mono text-xs text-gray-500">{parada.orderId.slice(0, 8)}</span>
                          <span className="text-xs text-gray-600">{STATUS_PARADA[parada.status] ?? parada.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
