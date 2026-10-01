import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { getApiErrorMessage, integrationsAPI, productsAPI, type IntegrationsOverview } from '../services/api'

// Integracoes (refeita em 01/10/2026). Antes: textos de vitrine sobre
// conectores que nem existiam e o status do Solidcom, desligado desde 10/09.
// Agora: o que o lojista precisa saber do ERP (AntenorApi) e o que fazer.

const TZ = 'America/Sao_Paulo'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const ago = (iso: string | null) => {
  if (!iso) return 'nunca'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`
}
const MODULE_INFO: Record<string, string> = {
  antenorapi: 'ERP da loja: catálogo, pedidos (DAV), cancelamento, faturamento e status do caixa.',
  solidcom: 'ERP antigo, desligado desde 10/09/2026. Fica de reserva: ligado, assume pedidos se a AntenorApi falhar.',
  hubspot: 'CRM. Precisa de conta e chave do HubSpot.',
  nfe: 'Emissão de NF-e pelo site. Hoje a nota sai no caixa.',
  payments: 'Pagamento online (PIX/cartão no site). Hoje o caixa cobra na entrega ou retirada.',
}

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

export default function Integrations() {
  const [data, setData] = useState<IntegrationsOverview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    try {
      setData((await integrationsAPI.overview(30)).data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar as integrações.'))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  // Sync do catalogo: o mesmo da tela Produtos, acompanhado ate terminar.
  useEffect(() => {
    if (!syncing) return
    const t = setInterval(async () => {
      try {
        const s = await productsAPI.syncStatus()
        if (!s.data.running) {
          setSyncing(false)
          setNotice(s.data.lastError ? `O sync falhou: ${s.data.lastError}` : 'Catálogo sincronizado.')
          load()
        }
      } catch {
        /* tenta no proximo ciclo */
      }
    }, 5000)
    return () => clearInterval(t)
  }, [syncing, load])

  const act = async (key: string, fn: () => Promise<{ data: { success?: boolean; reason?: string } }>, ok: string) => {
    setBusy(key)
    setNotice('')
    try {
      const r = (await fn()).data
      setNotice(r.success ? ok : `Não deu certo: ${r.reason || 'sem resposta do ERP'}`)
      await load()
    } catch (e) {
      setNotice(getApiErrorMessage(e, 'Não foi possível concluir.'))
    } finally {
      setBusy(null)
    }
  }

  const toggleModule = async (key: string, on: boolean) => {
    if (key === 'antenorapi' && !on && !window.confirm('Desligar a AntenorApi para catálogo e pedidos? Sem ela (e sem o Solidcom ligado), pedido novo não chega ao caixa.')) return
    if (key === 'solidcom' && on && !window.confirm('Ligar o Solidcom como reserva? Ele só envia pedido quando a AntenorApi falhar.')) return
    setBusy(`mod:${key}`)
    try {
      await integrationsAPI.setModuleEnabled(key as never, on)
      await load()
    } catch (e) {
      setNotice(getApiErrorMessage(e, 'Não foi possível mudar o conector.'))
    } finally {
      setBusy(null)
    }
  }

  const d = data
  const noDav = d?.orders.withoutDav ?? []

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <p className="max-w-3xl text-sm text-gray-500">
        O site conversa com o ERP da loja (AntenorApi): puxa o catálogo, manda cada pedido para virar DAV no caixa, cancela lá quando cancela aqui e recebe de volta separação e faturamento.
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
            <Stat
              label="ERP"
              value={d.erp.status === 'ok' ? 'No ar' : d.erp.status === 'degraded' ? 'Com erro' : 'Fora do ar'}
              tone={d.erp.status === 'ok' ? 'ok' : 'bad'}
              hint={d.erp.status === 'ok' ? `respondeu em ${d.erp.latencyMs} ms` : d.erp.detail || 'sem resposta'}
            />
            <Stat
              label="Catálogo"
              value={d.catalog ? `Completo ${ago(d.catalog.at)}` : 'Nunca sincronizado'}
              tone={d.catalog && d.catalog.errors === 0 ? 'ok' : 'warn'}
              hint={[
                d.catalog && `${(d.catalog.synced ?? 0).toLocaleString('pt-BR')} produtos${d.catalog.errors ? `, ${d.catalog.errors} com erro` : ', sem erro'}`,
                d.catalogRecent && `alterações conferidas ${ago(d.catalogRecent.at)}`,
              ].filter(Boolean).join(' · ') || undefined}
            />
            <Stat
              label="Pedidos no caixa · 30 dias"
              value={`${d.orders.withDav} de ${d.orders.total}`}
              tone={noDav.length ? 'bad' : 'ok'}
              hint={noDav.length ? `${noDav.length} sem DAV: o separador não acha no PDV` : 'todos com DAV'}
            />
            <Stat
              label="Status vindos do caixa"
              value={d.pdvStatus.lastAt ? ago(d.pdvStatus.lastAt) : 'nenhum'}
              hint={`${d.pdvStatus.events} atualização(ões) de separação/faturamento em 30 dias`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                setNotice('')
                try {
                  await productsAPI.syncBackground()
                  setSyncing(true)
                } catch (e) {
                  setNotice(getApiErrorMessage(e, 'Não foi possível iniciar o sync.'))
                }
              }}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Sincronizando…' : 'Sincronizar catálogo agora'}
            </button>
            <span className="text-xs text-gray-500">Automático: alterações de hora em hora e catálogo completo 4 vezes ao dia.</span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Pedidos sem DAV</h3>
              {noDav.length === 0 ? (
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Todos os pedidos do período chegaram ao caixa.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-black/[0.05]">
                  {noDav.map((o) => (
                    <li key={o.orderId} className="flex items-start gap-3 py-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block text-gray-900">
                          {o.customer || 'Cliente'} · {brl(o.total)} · {when(o.createdAt)}
                        </span>
                        <span className="block break-words text-xs text-gray-500">
                          {o.reason || 'ainda não enviado'} · {o.failures} tentativa(s){o.autoRetry ? ' · reenviando sozinho a cada 10 min' : ' · parou de tentar sozinho'}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={busy === o.orderId}
                        onClick={() => act(o.orderId, () => integrationsAPI.resendOrder(o.orderId), 'Pedido enviado: já tem DAV.')}
                        className="shrink-0 rounded-xl bg-gray-900 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                      >
                        {busy === o.orderId ? 'Enviando…' : 'Reenviar'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-gray-500">Pedido que o ERP recusa é reenviado sozinho por cerca de 2 horas. Reenviar não duplica: o ERP devolve o mesmo DAV.</p>
            </section>

            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Cancelamentos no caixa · 30 dias</h3>
              <p className="mt-2 text-sm text-gray-700">{d.cancellations.ok} cancelado(s) também no ERP.</p>
              {d.cancellations.failed.length > 0 && (
                <ul className="mt-2 divide-y divide-black/[0.05]">
                  {d.cancellations.failed.map((c) => (
                    <li key={c.orderId} className="flex items-start gap-3 py-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block text-gray-900">{c.dav ? `DAV ${c.dav}` : 'Sem DAV'} · {c.customer || 'Cliente'} · {brl(c.total)}</span>
                        <span className="block break-words text-xs text-gray-500">Não cancelou no ERP: {c.reason || 'sem resposta'} · {when(c.at)}</span>
                      </span>
                      <button
                        type="button"
                        disabled={busy === c.orderId}
                        onClick={() => act(c.orderId, () => integrationsAPI.retryCancel(c.orderId), 'Cancelado também no ERP.')}
                        className="shrink-0 rounded-xl bg-gray-900 px-3 py-1.5 text-xs text-white disabled:opacity-40"
                      >
                        {busy === c.orderId ? 'Tentando…' : 'Tentar de novo'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {d.cancellations.invoiced.length > 0 && (
                <div className="mt-3">
                  <p className="flex gap-2 text-xs text-gray-600">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    Já estavam faturados no caixa quando foram cancelados aqui. O ERP não cancela cupom emitido: se o dinheiro precisa voltar, o estorno é no PDV.
                  </p>
                  <ul className="mt-1 divide-y divide-black/[0.05] pl-3.5">
                    {d.cancellations.invoiced.map((c) => (
                      <li key={c.orderId} className="py-1.5 text-sm text-gray-800">
                        {c.dav ? `DAV ${c.dav}` : 'Sem DAV'} · {c.customer || 'Cliente'} · {brl(c.total)} <span className="text-xs text-gray-500">· {when(c.at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {d.cancellations.failed.length === 0 && d.cancellations.invoiced.length === 0 && (
                <p className="mt-1 inline-flex items-center gap-2 text-sm text-gray-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Nada pendente.
                </p>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Conectores</h3>
            <ul className="mt-2 divide-y divide-black/[0.05]">
              {d.modules.map((m) => {
                const canToggle = m.key === 'antenorapi' || m.key === 'solidcom'
                return (
                  <li key={m.key} className="flex items-start gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-gray-900">
                        {m.name}
                        {!canToggle && m.configured === false && <span className="ml-2 text-xs text-gray-400">não configurado</span>}
                      </span>
                      <span className="block text-xs text-gray-500">{MODULE_INFO[m.key] || m.notes}</span>
                    </span>
                    {canToggle ? (
                      <Switch checked={m.enabled} disabled={busy === `mod:${m.key}`} onChange={(on) => toggleModule(m.key, on)} aria-label={`${m.enabled ? 'Desligar' : 'Ligar'} ${m.name}`} />
                    ) : (
                      <span className="shrink-0 text-xs text-gray-400">{m.enabled ? 'ligado' : 'desligado'}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
