import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, ChevronRight, RefreshCw } from 'lucide-react'
import { deliverySupervisionAPI, getApiErrorMessage, type DeliverySupervision } from '../../services/api'
import { OrderDetail } from './OrdersSection'

// Entregas e retiradas (refeita em 29/09/2026 com o Jonathan): acompanhamento.
// O entregador monta a propria rota no app pegando pedidos da fila -- as 5
// rotas da historia nasceram assim; a montagem manual que existia aqui nunca
// foi usada (e tinha beco sem saida: rota "sem entregador" nao podia ser
// liberada). Intervencoes: atribuir entrega que ninguem pegou e decidir o que
// fazer com entrega nao realizada.

const REFRESH_MS = 30_000
const STOP_LABEL: Record<string, string> = { PENDING: 'vai sair', OUT_FOR_DELIVERY: 'a caminho', ARRIVED: 'chegou no endereço' }

function duration(min: number) {
  if (min < 60) return `${min} min`
  if (min < 1440) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`
  const d = Math.floor(min / 1440)
  return `${d} ${d === 1 ? 'dia' : 'dias'}`
}
const first = (name: string) => name.split(' ')[0]

function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">{title}</h2>
        {aside && <div className="text-xs text-gray-400">{aside}</div>}
      </header>
      {children}
    </section>
  )
}

function OrderLine({ code, dav, customer, extra, late, onOpen, action }: { code: string; dav?: string | null; customer: string; extra: ReactNode; late?: boolean; onOpen: () => void; action?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <button type="button" onClick={onOpen} className="group flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${late ? 'bg-amber-500' : ''}`} aria-label={late ? 'atenção' : undefined} />
        <span className="min-w-0">
          <span className="block text-sm text-gray-900">
            <span className="font-mono text-xs text-gray-500">#{code}</span>
            {dav && <span className="tabular-nums"> · DAV {dav}</span>}
            {customer && <span> · {first(customer)}</span>}
          </span>
          <span className="block text-xs text-gray-500">{extra}</span>
        </span>
        {!action && <ChevronRight size={16} className="ml-auto shrink-0 text-gray-300 group-hover:text-gray-500" />}
      </button>
      {action}
    </li>
  )
}

export default function DeliveryRoutesSection() {
  const [period, setPeriod] = useState<'day' | 'week'>('day')
  const [data, setData] = useState<DeliverySupervision | null>(null)
  const [error, setError] = useState('')
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const [assign, setAssign] = useState<{ orderId: string; code: string; driverId: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await deliverySupervisionAPI.get(period)
      setData(res.data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar as entregas.'))
    }
  }, [period])

  useEffect(() => {
    load()
    const t = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load])

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      await load()
      return true
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível concluir a ação.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  const updatedAt = data ? new Date(data.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}
      {!data && !error && <div className="h-48 animate-pulse rounded-2xl bg-white/70" />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Prontas para sair', value: data.ready.length },
              { label: 'Em rota', value: data.onRoute.length },
              { label: 'Entregues hoje', value: data.deliveredToday },
              { label: 'Não entregues', value: data.failed.length },
              { label: 'Retiradas esperando', value: data.pickups.length },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-black/[0.06] bg-white p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`mt-1 text-[26px] font-semibold leading-none tabular-nums ${k.value ? 'text-gray-900' : 'text-gray-300'}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {data.failed.length > 0 && (
            <Panel title="Não entregues · decidir">
              <ul className="divide-y divide-black/[0.05]">
                {data.failed.map((f) => (
                  <OrderLine
                    key={f.orderId}
                    code={f.code}
                    dav={f.dav}
                    customer={f.customer}
                    late
                    onOpen={() => setOpenOrderId(f.orderId)}
                    extra={<>{f.neighborhood || 'endereço'} · {f.driver && `${first(f.driver)}: `}{f.reason || 'sem motivo informado'} · há {duration(f.minutes)}</>}
                    action={
                      <span className="flex w-full gap-2 sm:w-auto">
                        <button type="button" disabled={busy} onClick={() => act(() => deliverySupervisionAPI.retry(f.orderId))} className="rounded-xl bg-gray-900 px-3 py-1.5 text-xs text-white disabled:opacity-40">
                          Tentar de novo
                        </button>
                        <button type="button" onClick={() => setOpenOrderId(f.orderId)} className="rounded-xl border border-black/[0.08] px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                          Abrir pedido
                        </button>
                      </span>
                    }
                  />
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-400">Fale com o cliente antes: "Tentar de novo" devolve o pedido para a fila dos entregadores. Para cancelar, abra o pedido.</p>
            </Panel>
          )}

          <Panel title="Prontas para sair" aside={<span className="inline-flex items-center gap-2">atualizado às {updatedAt}<button type="button" onClick={load} aria-label="Atualizar" className="rounded-lg p-1 text-gray-400 hover:text-gray-700"><RefreshCw size={14} /></button></span>}>
            {data.ready.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma entrega esperando entregador.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.ready.map((r) => (
                  <OrderLine
                    key={r.orderId}
                    code={r.code}
                    dav={r.dav}
                    customer={r.customer}
                    late={r.minutes >= 30}
                    onOpen={() => setOpenOrderId(r.orderId)}
                    extra={<>{r.neighborhood || 'sem bairro'} · {r.items} itens · pronta há {duration(r.minutes)}</>}
                    action={
                      <button type="button" onClick={() => setAssign({ orderId: r.orderId, code: r.code, driverId: '' })} className="ml-auto rounded-xl border border-black/[0.08] px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                        Atribuir
                      </button>
                    }
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Em rota">
            {data.onRoute.length === 0 ? (
              <p className="text-sm text-gray-400">Ninguém na rua agora.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.onRoute.map((r) => (
                  <OrderLine
                    key={r.orderId}
                    code={r.code}
                    dav={r.dav}
                    customer={r.customer}
                    late={r.minutes >= 90}
                    onOpen={() => setOpenOrderId(r.orderId)}
                    extra={<>{first(r.driver)} · {r.neighborhood || 'endereço'} · {STOP_LABEL[r.stopStatus] || r.stopStatus} há {duration(r.minutes)}</>}
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Retiradas esperando o cliente">
            {data.pickups.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma retirada pendente.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.pickups.map((p) => (
                  <OrderLine
                    key={p.orderId}
                    code={p.code}
                    dav={p.dav}
                    customer={p.customer}
                    late={p.minutes >= 240}
                    onOpen={() => setOpenOrderId(p.orderId)}
                    extra={<>pronta há {duration(p.minutes)} · abra para chamar no WhatsApp</>}
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Desempenho dos entregadores"
            aside={
              <div role="tablist" className="flex rounded-lg border border-black/[0.06] p-0.5">
                {(['day', 'week'] as const).map((p) => (
                  <button key={p} role="tab" aria-selected={period === p} type="button" onClick={() => setPeriod(p)} className={`rounded-md px-2.5 py-1 text-xs ${period === p ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
                    {p === 'day' ? 'Hoje' : '7 dias'}
                  </button>
                ))}
              </div>
            }
          >
            {data.team.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma entrega no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-2 font-normal">Entregador</th>
                      <th className="py-2 text-right font-normal">Entregues</th>
                      <th className="py-2 text-right font-normal">Tempo médio</th>
                      <th className="py-2 text-right font-normal">Não entregues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {data.team.map((t) => (
                      <tr key={t.driver}>
                        <td className="py-2.5 text-gray-900">{t.driver}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-700">{t.delivered}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-700">{t.avgMinutes != null ? duration(t.avgMinutes) : '—'}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-700">{t.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400">Tempo médio: da saída para a entrega até a confirmação no app.</p>
          </Panel>
        </>
      )}

      {openOrderId && <OrderDetail orderId={openOrderId} onClose={() => setOpenOrderId(null)} onChanged={load} />}

      {assign && data && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h3 className="text-base font-semibold text-gray-900">Atribuir entrega · #{assign.code}</h3>
            <p className="mt-1 text-sm text-gray-500">O pedido entra na rota do entregador e aparece no app dele.</p>
            <select value={assign.driverId} onChange={(e) => setAssign({ ...assign, driverId: e.target.value })} className="mt-4 h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm" autoFocus>
              <option value="">Escolha…</option>
              {data.drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {data.drivers.length === 0 && <p className="mt-2 text-xs text-gray-500">Nenhum entregador ativo. Dê acesso ao módulo Entrega a alguém em Equipe.</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAssign(null)} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Voltar</button>
              <button
                type="button"
                disabled={!assign.driverId || busy}
                onClick={async () => {
                  if (await act(() => deliverySupervisionAPI.assign(assign.orderId, assign.driverId))) setAssign(null)
                }}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                {busy ? 'Salvando…' : 'Atribuir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
