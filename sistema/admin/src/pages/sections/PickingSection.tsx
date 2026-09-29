import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, ChevronRight, RefreshCw, User } from 'lucide-react'
import { getApiErrorMessage, ordersAPI, pickingAPI, pickingSupervisionAPI, type PickingSupervision, type SubstitutionEvent } from '../../services/api'
import { OrderDetail } from './OrdersSection'

// Separacao (refeita em 29/09/2026 com o Jonathan): acompanhamento, nao uma
// segunda ferramenta de separar. Quem separa e o funcionario no app; aqui se
// ve quem separa o que, ha quanto tempo, o que espera separador ou cliente, e
// o desempenho da equipe. Unica intervencao: trocar o separador.

const REFRESH_MS = 30_000

function duration(min: number) {
  if (min < 60) return `${min} min`
  if (min < 1440) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`
  const d = Math.floor(min / 1440)
  return `${d} ${d === 1 ? 'dia' : 'dias'}`
}

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

export default function PickingSection() {
  const [period, setPeriod] = useState<'day' | 'week'>('day')
  const [data, setData] = useState<PickingSupervision | null>(null)
  const [error, setError] = useState('')
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const [reassign, setReassign] = useState<{ taskId: string; code: string; pickerId: string } | null>(null)
  const [saving, setSaving] = useState(false)
  // Trocas de produto (antes na tela "Desempenho", removida em 29/09/2026).
  const [swaps, setSwaps] = useState<SubstitutionEvent[]>([])

  useEffect(() => {
    const from = new Date(Date.now() - 30 * 86400000).toISOString()
    ordersAPI.listSubstitutions({ from, limit: 20 }).then((r) => setSwaps(r.data)).catch(() => setSwaps([]))
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await pickingSupervisionAPI.get(period)
      setData(res.data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar a separação.'))
    }
  }, [period])

  useEffect(() => {
    load()
    const t = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load])

  const saveReassign = async () => {
    if (!reassign?.pickerId) return
    setSaving(true)
    try {
      await pickingAPI.assignTask(reassign.taskId, reassign.pickerId)
      setReassign(null)
      await load()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível trocar o separador.'))
    } finally {
      setSaving(false)
    }
  }

  const updatedAt = data ? new Date(data.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
  const waitingCustomer = data?.picking.filter((p) => p.waitingCustomer).length ?? 0

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-5">
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {!data && !error && <div className="h-48 animate-pulse rounded-2xl bg-white/70" />}

      {data && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Esperando separador', value: data.waiting.length },
              { label: 'Em separação', value: data.picking.length - waitingCustomer },
              { label: 'Esperando cliente', value: waitingCustomer },
              { label: 'Enviados ao caixa hoje', value: data.sentToCashier },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl border border-black/[0.06] bg-white p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`mt-1 text-[26px] font-semibold leading-none tabular-nums ${k.value ? 'text-gray-900' : 'text-gray-300'}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Em separacao */}
          <Panel
            title="Em separação"
            aside={
              <span className="inline-flex items-center gap-2">
                atualizado às {updatedAt}
                <button type="button" onClick={load} aria-label="Atualizar" className="rounded-lg p-1 text-gray-400 hover:text-gray-700"><RefreshCw size={14} /></button>
              </span>
            }
          >
            {data.picking.length === 0 ? (
              <p className="text-sm text-gray-400">Ninguém separando agora.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.picking.map((p) => {
                  const pct = p.itemsTotal ? Math.round((p.itemsDone / p.itemsTotal) * 100) : 0
                  return (
                    <li key={p.taskId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <button type="button" onClick={() => setOpenOrderId(p.orderId)} className="group flex min-w-0 flex-1 items-center gap-3 text-left">
                        {p.late || p.waitingCustomer ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-label="atenção" /> : <span className="h-1.5 w-1.5 shrink-0" />}
                        <span className="min-w-0">
                          <span className="block text-sm text-gray-900">
                            <span className="font-mono text-xs text-gray-500">#{p.code}</span>
                            {p.dav && <span className="tabular-nums"> · DAV {p.dav}</span>}
                            {p.customer && <span> · {p.customer.split(' ')[0]}</span>}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {p.waitingCustomer ? 'esperando o cliente responder sobre troca' : `há ${duration(p.minutes)}`}
                            {(p.missing > 0 || p.substituted > 0) && ` · ${[p.missing && `${p.missing} em falta`, p.substituted && `${p.substituted} trocado`].filter(Boolean).join(', ')}`}
                          </span>
                        </span>
                        <ChevronRight size={16} className="ml-auto shrink-0 text-gray-300 group-hover:text-gray-500 sm:hidden" />
                      </button>
                      <div className="flex w-full items-center gap-3 sm:w-auto">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-[#5D082A]/80" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-12 text-xs tabular-nums text-gray-500">{p.itemsDone}/{p.itemsTotal}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReassign({ taskId: p.taskId, code: p.code, pickerId: p.pickerId || '' })}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 sm:ml-0"
                          title="Trocar separador"
                        >
                          <User size={13} /> {p.picker || 'sem separador'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          {/* Esperando separador */}
          <Panel title="Esperando separador">
            {data.waiting.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum pedido esperando.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {data.waiting.map((w) => (
                  <li key={w.orderId}>
                    <button type="button" onClick={() => setOpenOrderId(w.orderId)} className="group flex w-full items-center gap-3 py-2.5 text-left">
                      {w.late ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-label="atrasado" /> : <span className="h-1.5 w-1.5 shrink-0" />}
                      <span className="min-w-0 flex-1 text-sm text-gray-900">
                        <span className="font-mono text-xs text-gray-500">#{w.code}</span>
                        {w.dav && <span className="tabular-nums"> · DAV {w.dav}</span>}
                        {w.customer && <span> · {w.customer.split(' ')[0]}</span>}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-gray-500">{w.items} itens · há {duration(w.minutes)}</span>
                      <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-gray-500" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Desempenho da equipe */}
          <Panel
            title="Desempenho da equipe"
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
              <p className="text-sm text-gray-400">Nenhuma separação concluída no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-2 font-normal">Separador</th>
                      <th className="py-2 text-right font-normal">Pedidos</th>
                      <th className="py-2 text-right font-normal">Tempo médio</th>
                      <th className="py-2 text-right font-normal">Itens</th>
                      <th className="py-2 text-right font-normal">Em falta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {data.team.map((t) => (
                      <tr key={t.pickerId}>
                        <td className="py-2.5 text-gray-900">{t.picker}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-700">{t.orders}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-700">{t.avgMinutes != null ? duration(t.avgMinutes) : '—'}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-700">{t.items}</td>
                        <td className="py-2.5 text-right tabular-nums text-gray-700">{t.missingRate.toLocaleString('pt-BR')}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {data && (
        <Panel title="Trocas de produto · 30 dias">
          {swaps.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma troca de produto nos últimos 30 dias.</p>
          ) : (
            <ul className="divide-y divide-black/[0.05]">
              {swaps.map((ev) => (
                <li key={ev.id}>
                  <button type="button" onClick={() => setOpenOrderId(ev.orderId)} className="group flex w-full items-center gap-3 py-2.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-900">
                        {String(ev.payload.sourceProductName || 'produto')} <span className="text-gray-400">→</span> {String(ev.payload.substituteProductName || 'substituto')}
                      </span>
                      <span className="block text-xs text-gray-500">
                        #{ev.orderId.slice(-8).toUpperCase()} · {ev.actorName || 'separador'} · {new Date(ev.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {ev.payload.reason ? ` · ${String(ev.payload.reason)}` : ''}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-gray-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {openOrderId && <OrderDetail orderId={openOrderId} onClose={() => setOpenOrderId(null)} onChanged={load} />}

      {reassign && data && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h3 className="text-base font-semibold text-gray-900">Trocar separador · #{reassign.code}</h3>
            <p className="mt-1 text-sm text-gray-500">O pedido passa para quem você escolher, que continua a separação no app de onde parou.</p>
            <select
              value={reassign.pickerId}
              onChange={(e) => setReassign({ ...reassign, pickerId: e.target.value })}
              className="mt-4 h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm"
              autoFocus
            >
              <option value="">Escolha…</option>
              {data.pickers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {data.pickers.length === 0 && <p className="mt-2 text-xs text-gray-500">Ninguém com acesso à Separação (confira em Equipe).</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setReassign(null)} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Voltar</button>
              <button type="button" disabled={!reassign.pickerId || saving} onClick={saveReassign} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">
                {saving ? 'Salvando…' : 'Trocar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
