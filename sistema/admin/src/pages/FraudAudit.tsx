import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { fraudAPI, getApiErrorMessage, type FraudOverview } from '../services/api'

// Antifraude (refeita em 01/10/2026). O cliente paga na entrega ou na
// retirada: o risco real e a mesma pessoa abrir contas para repetir beneficio
// de primeira compra e o pedido de trote, que gasta separacao e viagem.

const TZ = 'America/Sao_Paulo'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const LEVEL = { HIGH: { label: 'Risco alto', dot: 'bg-rose-500' }, MEDIUM: { label: 'Atenção', dot: 'bg-amber-500' }, LOW: { label: 'Baixo', dot: 'bg-emerald-500' } } as const

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  const dot = tone === 'bad' ? 'bg-rose-500' : tone === 'warn' ? 'bg-amber-500' : tone === 'ok' ? 'bg-emerald-500' : ''
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums text-gray-900">
        {dot && <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />}
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

export default function FraudAudit() {
  const [data, setData] = useState<FraudOverview | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [howOpen, setHowOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setData((await fraudAPI.overview(30)).data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar o antifraude.'))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key)
    setNotice('')
    try {
      await fn()
      setNotice(ok)
      await load()
    } catch (e) {
      setNotice(getApiErrorMessage(e, 'Não foi possível concluir.'))
    } finally {
      setBusy(null)
    }
  }
  const block = (customerId: string, name: string) => {
    const reason = window.prompt(`Bloquear ${name}? O CPF, o WhatsApp, o e-mail e os aparelhos dessa pessoa também ficam bloqueados.\n\nMotivo (opcional):`)
    if (reason === null) return
    run(`b:${customerId}`, () => fraudAPI.block(customerId, reason.trim() || undefined), `${name} bloqueado.`)
  }

  const d = data
  const pending = d?.riskOrders.filter((o) => !o.riskReviewedAt && !['CANCELLED', 'REFUNDED'].includes(o.status)) ?? []
  const done = d?.riskOrders.filter((o) => o.riskReviewedAt || ['CANCELLED', 'REFUNDED'].includes(o.status)) ?? []

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <p className="max-w-3xl text-sm text-gray-500">
        Liga as contas da mesma pessoa (aparelho, impressão digital com a rede, e-mail e endereço), nega benefício de primeira compra a quem já comprou e dá uma nota de risco a cada pedido. Risco alto aparece na separação para a equipe ligar antes de separar.
      </p>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}
      {notice && <p className="rounded-2xl bg-white p-3 text-sm text-gray-800 ring-1 ring-black/[0.06]">{notice}</p>}

      {!d ? (
        !error && <div className="h-64 animate-pulse rounded-2xl bg-white/70" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Para conferir" value={String(d.summary.pendingReview)} tone={d.summary.pendingReview ? 'bad' : 'ok'} hint={`${d.summary.high} risco alto e ${d.summary.medium} atenção em 30 dias`} />
            <Stat label="Pedidos analisados · 30 dias" value={String(d.summary.assessed)} hint="todo pedido novo ganha nota de risco" />
            <Stat label="Benefícios negados" value={String(d.summary.denied)} tone={d.summary.denied ? 'warn' : undefined} hint="cupom ou frete de primeira compra" />
            <Stat label="Contas ligadas" value={String(d.summary.linkedAccounts)} hint={`${d.summary.blocked} pessoa(s) bloqueada(s)`} />
          </div>

          <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Pedidos para conferir</h3>
            {pending.length === 0 ? (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Nenhum pedido de risco esperando conferência.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-black/[0.05]">
                {pending.map((o) => {
                  const level = LEVEL[o.riskLevel || 'LOW']
                  return (
                    <li key={o.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
                          <span className={`h-2 w-2 rounded-full ${level.dot}`} />
                          {level.label} · {o.riskScore ?? 0} pontos
                          <span className="text-gray-500">· {o.erpDav ? `DAV ${o.erpDav}` : 'sem DAV'} · {o.customer?.name || 'Cliente'} · {brl(o.total)} · {when(o.createdAt)}</span>
                        </span>
                        <span className="mt-1 block text-xs text-gray-600">{(o.riskReasons || []).join(' · ')}</span>
                      </span>
                      <span className="flex shrink-0 gap-2">
                        <button type="button" disabled={busy === o.id} onClick={() => run(o.id, () => fraudAPI.review(o.id), 'Pedido marcado como conferido.')} className="rounded-xl bg-gray-900 px-3 py-1.5 text-xs text-white disabled:opacity-40">
                          Conferido
                        </button>
                        {o.customer && !o.customer.blocked && (
                          <button type="button" disabled={busy === `b:${o.customer.id}`} onClick={() => block(o.customer!.id, o.customer!.name)} className="rounded-xl px-3 py-1.5 text-xs text-rose-700 ring-1 ring-rose-200 disabled:opacity-40">
                            Bloquear cliente
                          </button>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {done.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-xs text-gray-500">{done.length} já conferido(s) ou cancelado(s)</summary>
                <ul className="mt-1 divide-y divide-black/[0.05]">
                  {done.map((o) => (
                    <li key={o.id} className="py-2 text-xs text-gray-600">
                      {LEVEL[o.riskLevel || 'LOW'].label} · {o.customer?.name || 'Cliente'} · {brl(o.total)} · {when(o.createdAt)} · {(o.riskReasons || []).join(' · ')}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Contas da mesma pessoa</h3>
              {d.clusters.length === 0 ? (
                <p className="mt-3 text-sm text-gray-600">Nenhuma conta ligada a outra até agora.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {d.clusters.map((c, i) => (
                    <li key={i} className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">
                        {c.accounts.length} contas · {c.via.join(', ')}
                        {c.coupons > 1 && <span className="ml-1 text-amber-700">· {c.coupons} cupons usados no grupo</span>}
                      </p>
                      <ul className="mt-1 divide-y divide-black/[0.05]">
                        {c.accounts.map((a) => (
                          <li key={a.customerId} className="flex items-center gap-2 py-1.5 text-sm">
                            <span className="min-w-0 flex-1 truncate text-gray-900">
                              {a.name}
                              <span className="ml-1 text-xs text-gray-500">CPF {a.cpf} · {a.orders} pedido(s){a.coupons ? ` · ${a.coupons} cupom(ns)` : ''}</span>
                            </span>
                            {a.blocked ? (
                              <span className="text-xs text-rose-700">bloqueado</span>
                            ) : (
                              <button type="button" disabled={busy === `b:${a.customerId}`} onClick={() => block(a.customerId, a.name)} className="shrink-0 text-xs text-rose-700 underline disabled:opacity-40">
                                bloquear
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Ocorrências · 30 dias</h3>
              {d.events.length === 0 ? (
                <p className="mt-3 text-sm text-gray-600">Nenhuma tentativa barrada.</p>
              ) : (
                <ul className="mt-2 max-h-80 divide-y divide-black/[0.05] overflow-y-auto">
                  {d.events.map((e) => (
                    <li key={e.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 text-gray-900">
                        {e.label}
                        {e.customer && <span className="text-gray-500"> · {e.customer}</span>}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-gray-500">{when(e.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {d.blocked.length > 0 && (
                <>
                  <h3 className="mt-4 text-[11px] font-medium uppercase tracking-wide text-gray-500">Bloqueados</h3>
                  <ul className="mt-1 divide-y divide-black/[0.05]">
                    {d.blocked.map((b) => (
                      <li key={b.customerId || b.at} className="flex items-center gap-3 py-2 text-sm">
                        <span className="min-w-0 flex-1">
                          <span className="text-gray-900">{b.name}</span>
                          <span className="block text-xs text-gray-500">{b.reason || 'sem motivo'} · {b.identifiers} identificador(es) · desde {when(b.at)}</span>
                        </span>
                        {b.customerId && (
                          <button type="button" disabled={busy === `u:${b.customerId}`} onClick={() => run(`u:${b.customerId}`, () => fraudAPI.unblock(b.customerId), `${b.name} desbloqueado.`)} className="shrink-0 text-xs text-gray-600 underline disabled:opacity-40">
                            desbloquear
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
            <button type="button" onClick={() => setHowOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Como a nota é calculada</h3>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${howOpen ? 'rotate-180' : ''}`} />
            </button>
            {howOpen && (
              <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                <li>Navegador automatizado (robô): +60</li>
                <li>Entrega frustrada antes (a pessoa, contando as contas ligadas): +35 cada, até 60</li>
                <li>Conta criada hoje com primeiro pedido acima de R$ 600: +40 (acima de R$ 300: +20)</li>
                <li>Mesmo aparelho ou e-mail de outras contas: +15 por conta, até 40</li>
                <li>3 ou mais contas usando o mesmo aparelho em 7 dias: +30</li>
                <li>Vários pedidos em 10 minutos: +30 · Acesso de fora do Brasil: +30 · E-mail descartável: +15</li>
                <li className="pt-1 text-gray-500">60 pontos ou mais é risco alto (ligar antes de separar); de 30 a 59, atenção. A nota não bloqueia pedido: só o bloqueio manual barra, e ele vale para CPF, WhatsApp, e-mail e aparelhos da pessoa.</li>
                <li className="text-gray-500">Benefício de primeira compra (cupom ou frete) vale por pessoa: conta nova no mesmo aparelho, e-mail ou endereço de quem já comprou não ganha de novo.</li>
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
