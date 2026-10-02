import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ImageOff, Loader2, Search, Send, X } from 'lucide-react'
import {
  autoOffersAPI,
  cmsAPI,
  customersAPI,
  getApiErrorMessage,
  notificationsAdminAPI,
  productsAPI,
  resolveApiUrl,
  type AutoOfferPick,
  type CatalogProduct,
  type NotificationDispatch,
} from '../../services/api'
import NotificationQueueTab from './NotificationQueue'

// Notificacoes (refeita em 29/09/2026 com o Jonathan). Quatro partes:
// - Fila de envios (02/10/2026): o que vai sair com hora marcada (encarte,
//   oferta personalizada, agendado), para editar, cancelar, aprovar ou mandar ja.
// - Automatico: avisos de oferta por algoritmo proprio (sem IA externa): escolhe
//   a oferta de cada cliente pelo que ele compra/olha, aprende com o que foi
//   aberto e respeita limites. Aqui liga, ajusta, simula e ve o resultado.
// - Enviar aviso: envio manual com destino, publico e agendamento.
// - Historico: o que saiu, quantos abriram e quantos pedidos vieram em 48 h.

type Tab = 'queue' | 'auto' | 'send' | 'history'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')
const SOURCE_LABEL: Record<string, string> = { AUTO: 'Oferta personalizada', MANUAL: 'Manual', SCHEDULED: 'Agendado', CART: 'Carrinho esquecido', ORDER: 'Pedido', ENCARTE: 'Encarte' }
const codeOf = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export default function NotificationsSection() {
  const [tab, setTab] = useState<Tab>('queue')
  const [departments, setDepartments] = useState<Array<{ code: string; name: string }>>([])

  useEffect(() => {
    cmsAPI.categories
      .adminOverview()
      .then((r) => setDepartments(r.data.map((d) => ({ code: codeOf(d.name), name: d.shortName || d.name }))))
      .catch(() => setDepartments([]))
  }, [])
  const depName = useCallback((code: string) => departments.find((d) => d.code === code)?.name || code, [departments])

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-black/[0.06] bg-white p-1 sm:w-max">
        {(
          [
            ['queue', 'Fila de envios'],
            ['auto', 'Automático'],
            ['send', 'Enviar aviso'],
            ['history', 'Histórico'],
          ] as Array<[Tab, string]>
        ).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-xl px-3 py-1.5 text-sm ${tab === k ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'queue' && <NotificationQueueTab />}
      {tab === 'auto' && <AutoTab depName={depName} />}
      {tab === 'send' && <SendTab departments={departments} onSent={(scheduled) => setTab(scheduled ? 'queue' : 'history')} />}
      {tab === 'history' && <HistoryTab />}
    </div>
  )
}

// ─── Automatico ──────────────────────────────────────────────────────────────

function AutoTab({ depName }: { depName: (code: string) => string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof autoOffersAPI.overview>>['data'] | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ candidates: number; customers: number; picks: AutoOfferPick[] } | null>(null)
  const [busy, setBusy] = useState<'preview' | 'run' | null>(null)
  const [runResult, setRunResult] = useState('')

  const load = useCallback(async () => {
    try {
      setData((await autoOffersAPI.overview()).data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar.'))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const save = async (patch: Parameters<typeof autoOffersAPI.update>[0]) => {
    setSaving(true)
    try {
      await autoOffersAPI.update(patch)
      await load()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const simulate = async () => {
    setBusy('preview')
    setRunResult('')
    try {
      setPreview((await autoOffersAPI.preview()).data)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível simular.'))
    } finally {
      setBusy(null)
    }
  }

  const runNow = async () => {
    if (!preview?.picks.length || !window.confirm(`Enviar agora ${preview.picks.length} aviso(s), como mostra a simulação?`)) return
    setBusy('run')
    try {
      const r = (await autoOffersAPI.run()).data
      setRunResult(r.skipped ? `Não enviou: ${r.reason}.` : `Enviado para ${r.sent} cliente(s), ${r.products} oferta(s).`)
      setPreview(null)
      await load()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível enviar.'))
    } finally {
      setBusy(null)
    }
  }

  if (!data) return error ? <ErrorBox text={error} /> : <div className="h-64 animate-pulse rounded-2xl bg-white/70" />
  const s = data.settings
  const hours = s.sendHours.split(',').map(Number)
  const bySource = (src: string) => data.stats.find((x) => x.source === src) || { sent: 0, opened: 0, orders: 0, revenue: 0 }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {error && <ErrorBox text={error} />}
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Avisos automáticos de oferta</h3>
              <p className="mt-1 text-sm text-gray-500">
                {s.enabled ? 'Ligado.' : 'Desligado.'} Cada cliente com aviso ativado no celular recebe a oferta que mais combina com o que ele compra e olha na loja.
              </p>
            </div>
            <Toggle on={s.enabled} disabled={saving} onChange={(v) => save({ enabled: v })} label="Avisos automáticos" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-xs text-gray-500">
              <span className="font-medium text-gray-700">Desconto mínimo</span>
              <span className="block text-gray-400">Só oferta a partir disso</span>
              <select value={s.minDiscount} disabled={saving} onChange={(e) => save({ minDiscount: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900">
                {[10, 15, 20, 25, 30, 40].map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-gray-500">
              <span className="font-medium text-gray-700">Máximo por cliente</span>
              <span className="block text-gray-400">Por semana (e nunca 2 no mesmo dia)</span>
              <select value={s.maxPerWeek} disabled={saving} onChange={(e) => save({ maxPerWeek: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900">
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    {v} por semana
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4">
            <span className="block text-xs font-medium text-gray-700">Horários de envio</span>
            <span className="block text-xs text-gray-400">Só envia se a loja estiver no horário de entrega.</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from({ length: 13 }, (_, i) => i + 8).map((h) => {
                const on = hours.includes(h)
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={saving || (on && hours.length === 1)}
                    onClick={() => save({ sendHours: (on ? hours.filter((x) => x !== h) : [...hours, h]).join(',') })}
                    className={`rounded-lg px-2.5 py-1 text-sm tabular-nums ${on ? 'bg-gray-900 text-white' : 'border border-black/[0.08] text-gray-600 hover:bg-gray-50'}`}
                  >
                    {h}h
                  </button>
                )
              })}
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            {data.subscribers} cliente(s) com aviso ativado no celular.
            {s.lastRunAt && s.lastRunSummary && ` Último envio: ${new Date(s.lastRunAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}, ${s.lastRunSummary.sent} aviso(s).`}
          </p>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Próximo envio</h3>
              <p className="mt-0.5 text-xs text-gray-500">Simule para ver quem receberia qual oferta agora. Nada é enviado.</p>
            </div>
            <button type="button" onClick={simulate} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40">
              {busy === 'preview' && <Loader2 size={14} className="animate-spin" />} Simular agora
            </button>
          </div>
          {runResult && <p className="mt-3 text-sm text-gray-700">{runResult}</p>}
          {preview && (
            <div className="mt-3">
              <p className="text-xs text-gray-500">
                {preview.candidates} oferta(s) elegível(is) · {preview.picks.length} de {preview.customers} cliente(s) receberiam agora
                {preview.picks.length < preview.customers && ' (os outros já receberam aviso recente ou atingiram o limite)'}.
              </p>
              {preview.picks.length > 0 ? (
                <>
                  <ul className="mt-2 divide-y divide-black/[0.05] rounded-xl border border-black/[0.06]">
                    {preview.picks.map((p) => (
                      <li key={p.customerId} className="px-3 py-2">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate text-gray-900">{p.customerName.trim() || 'Cliente'}</span>
                          <span className="shrink-0 text-xs text-gray-400">{p.reason}</span>
                        </div>
                        <p className="truncate text-xs text-gray-600">{p.title}</p>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={runNow} disabled={busy !== null} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-sm text-white disabled:opacity-40">
                    {busy === 'run' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar agora
                  </button>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">Ninguém receberia agora.</p>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <h3 className="text-sm font-medium text-gray-900">Resultado · 30 dias</h3>
          <p className="mt-0.5 text-xs text-gray-400">"Abriram": tocou no aviso ou leu no sino do site. "Pedidos": comprou em até 48 h depois do aviso.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="py-1.5 font-normal">Origem</th>
                  <th className="py-1.5 text-right font-normal">Enviados</th>
                  <th className="py-1.5 text-right font-normal">Abriram</th>
                  <th className="py-1.5 text-right font-normal">Pedidos</th>
                  <th className="py-1.5 text-right font-normal">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] tabular-nums">
                {['AUTO', 'MANUAL', 'SCHEDULED', 'CART'].filter((src) => src === 'AUTO' || bySource(src).sent > 0).map((src) => {
                  const r = bySource(src)
                  return (
                    <tr key={src}>
                      <td className="py-2 text-gray-700">{SOURCE_LABEL[src]}</td>
                      <td className="py-2 text-right text-gray-900">{r.sent}</td>
                      <td className="py-2 text-right text-gray-900">
                        {r.opened} <span className="text-xs text-gray-400">{pct(r.opened, r.sent)}</span>
                      </td>
                      <td className="py-2 text-right text-gray-900">{r.orders}</td>
                      <td className="py-2 text-right text-gray-900">{brl(r.revenue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-900">O que o algoritmo aprendeu</h3>
          <p className="mt-0.5 text-xs text-gray-400">Departamentos cujos avisos são mais abertos ganham peso maior nas próximas escolhas (últimos 60 dias).</p>
          {data.departments.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Ainda aprendendo: precisa de avisos automáticos enviados e abertos. Até lá, todos os departamentos têm o mesmo peso.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.departments.map((d) => (
                <li key={d.category} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="truncate text-gray-700">{depName(d.category)}</span>
                    <span className="shrink-0 tabular-nums text-xs text-gray-500">
                      {d.opened}/{d.sent} abertos · peso {d.weight.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-gray-100">
                    <div className="h-1 rounded-full bg-[#5D082A]/70" style={{ width: `${(d.weight / 2) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-900">Como escolhe</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-gray-600">
            <li>Ofertas à venda, com foto e com o desconto mínimo.</li>
            <li>Nota da oferta: desconto × procura (vendas e visitas de 30 dias) × peso do departamento.</li>
            <li>Para cada cliente, mais peso ao que ele já comprou ou olhou.</li>
            <li>Limites: 1 por dia, o máximo semanal e nunca o mesmo produto em 14 dias.</li>
          </ol>
        </Card>
      </div>
    </div>
  )
}

// ─── Enviar aviso ────────────────────────────────────────────────────────────

type Audience = 'all' | 'segment' | 'one'

function SendTab({ departments, onSent }: { departments: Array<{ code: string; name: string }>; onSent: (scheduled: boolean) => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState<'home' | 'product' | 'banner'>('home')
  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<CatalogProduct[]>([])
  const [banners, setBanners] = useState<Array<{ id: string; title?: string; name?: string; slot: string; desktopImageUrl?: string }>>([])
  const [bannerId, setBannerId] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [inactiveDays, setInactiveDays] = useState('')
  const [category, setCategory] = useState('')
  const [customer, setCustomer] = useState<{ id: string; name: string; whatsapp?: string | null } | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Array<{ id: string; name: string; whatsapp?: string | null }>>([])
  const [count, setCount] = useState<number | null>(null)
  const [sendAt, setSendAt] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cmsAPI.storeBanners
      .getAll()
      .then((r) => setBanners(((r.data as any[]) || []).filter((b) => b.active)))
      .catch(() => setBanners([]))
  }, [])

  useEffect(() => {
    const q = productQuery.trim()
    if (q.length < 2) return setProductResults([])
    const t = setTimeout(() => productsAPI.catalog({ tab: 'site', search: q, limit: 8 }).then((r) => setProductResults(r.data.data)).catch(() => setProductResults([])), 250)
    return () => clearTimeout(t)
  }, [productQuery])

  useEffect(() => {
    const q = customerQuery.trim()
    if (q.length < 2) return setCustomerResults([])
    const t = setTimeout(() => customersAPI.getAll(q).then((r) => setCustomerResults((r.data as any[]).slice(0, 8))).catch(() => setCustomerResults([])), 250)
    return () => clearTimeout(t)
  }, [customerQuery])

  // Quantos receberiam.
  useEffect(() => {
    if (audience === 'one') return setCount(customer ? 1 : 0)
    const params = audience === 'segment' ? { inactiveDays: inactiveDays ? Number(inactiveDays) : undefined, purchasedCategory: category || undefined } : {}
    notificationsAdminAPI
      .segmentCount(params)
      .then((r) => setCount(r.data.count))
      .catch(() => setCount(null))
  }, [audience, inactiveDays, category, customer])

  const banner = banners.find((b) => b.id === bannerId)
  const image = target === 'banner' ? banner?.desktopImageUrl : target === 'product' && product?.hasPhoto ? `/uploads/products/${product.ean}.webp` : undefined
  const scheduling = Boolean(sendAt) && new Date(sendAt).getTime() > Date.now()
  const valid = title.trim() && body.trim() && (target !== 'product' || product) && (target !== 'banner' || bannerId) && (audience !== 'one' || customer) && (count ?? 0) > 0

  const send = async () => {
    if (!valid) return
    if (!window.confirm(scheduling ? `Agendar para ${new Date(sendAt).toLocaleString('pt-BR')}?` : `Enviar agora para ${count} cliente(s)?`)) return
    setSending(true)
    setError('')
    try {
      await notificationsAdminAPI.broadcast({
        type: 'CAMPAIGN',
        title: title.trim(),
        body: body.trim(),
        customerId: audience === 'one' ? customer!.id : undefined,
        productId: target === 'product' ? product!.id : undefined,
        imageUrl: target === 'product' ? image : undefined,
        bannerId: target === 'banner' ? bannerId : undefined,
        inactiveDays: audience === 'segment' && inactiveDays ? Number(inactiveDays) : undefined,
        purchasedCategory: audience === 'segment' ? category || undefined : undefined,
        sendAt: scheduling ? new Date(sendAt).toISOString() : undefined,
      })
      onSent(scheduling)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível enviar.'))
    } finally {
      setSending(false)
    }
  }

  const field = 'h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400'
  const seg = (on: boolean) => `rounded-lg px-2 py-1.5 text-sm ${on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card>
        <div className="space-y-5">
          <label className="block">
            <span className="flex justify-between text-xs font-medium text-gray-700">
              Título <span className={`font-normal ${title.length > 45 ? 'text-amber-600' : 'text-gray-400'}`}>{title.length}/45</span>
            </span>
            <span className="block text-xs text-gray-400">Aparece em negrito no celular. Curto e direto.</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: 🥩 Semana do churrasco" className={`${field} mt-1`} />
          </label>
          <label className="block">
            <span className="flex justify-between text-xs font-medium text-gray-700">
              Mensagem <span className={`font-normal ${body.length > 120 ? 'text-amber-600' : 'text-gray-400'}`}>{body.length}/120</span>
            </span>
            <span className="block text-xs text-gray-400">O detalhe da oferta: o que é, quanto custa, até quando.</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Ex.: Picanha e linguiça com até 30% de desconto até domingo." className="mt-1 w-full resize-none rounded-xl border border-black/[0.08] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400" />
          </label>

          <div>
            <span className="block text-xs font-medium text-gray-700">Ao tocar, abre</span>
            <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
              <button type="button" onClick={() => setTarget('home')} className={seg(target === 'home')}>Página inicial</button>
              <button type="button" onClick={() => setTarget('product')} className={seg(target === 'product')}>Um produto</button>
              <button type="button" onClick={() => setTarget('banner')} className={seg(target === 'banner')}>Um banner</button>
            </div>
            {target === 'product' &&
              (product ? (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-black/[0.08] px-3 py-2">
                  <Thumb src={product.hasPhoto ? `/thumbs/products/${product.ean}.webp` : undefined} />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{product.displayName}</span>
                  <button type="button" onClick={() => setProduct(null)} aria-label="Trocar produto" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <SearchBox value={productQuery} onChange={setProductQuery} placeholder="Buscar produto do site">
                  {productResults.map((p) => (
                    <button key={p.id} type="button" onClick={() => (setProduct(p), setProductQuery(''), setProductResults([]))} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                      <Thumb src={p.hasPhoto ? `/thumbs/products/${p.ean}.webp` : undefined} />
                      <span className="truncate text-sm text-gray-900">{p.displayName}</span>
                    </button>
                  ))}
                </SearchBox>
              ))}
            {target === 'banner' && (
              <select value={bannerId} onChange={(e) => setBannerId(e.target.value)} className={`${field} mt-2`}>
                <option value="">Escolha um banner ativo</option>
                {banners.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title || b.name || 'Sem título'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-700">Para quem</span>
            <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
              <button type="button" onClick={() => setAudience('all')} className={seg(audience === 'all')}>Todos</button>
              <button type="button" onClick={() => setAudience('segment')} className={seg(audience === 'segment')}>Um grupo</button>
              <button type="button" onClick={() => setAudience('one')} className={seg(audience === 'one')}>Um cliente</button>
            </div>
            {audience === 'segment' && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} className={field}>
                  <option value="">Qualquer data de compra</option>
                  <option value="15">Sem comprar há 15 dias</option>
                  <option value="30">Sem comprar há 30 dias</option>
                  <option value="60">Sem comprar há 60 dias</option>
                </select>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                  <option value="">Qualquer departamento</option>
                  {departments.map((d) => (
                    <option key={d.code} value={d.code}>
                      Já comprou em {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {audience === 'one' &&
              (customer ? (
                <div className="mt-2 flex items-center justify-between rounded-xl border border-black/[0.08] px-3 py-2 text-sm">
                  <span className="truncate text-gray-900">
                    {customer.name} <span className="text-gray-400">{customer.whatsapp}</span>
                  </span>
                  <button type="button" onClick={() => setCustomer(null)} aria-label="Trocar cliente" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <SearchBox value={customerQuery} onChange={setCustomerQuery} placeholder="Nome ou WhatsApp do cliente">
                  {customerResults.map((c) => (
                    <button key={c.id} type="button" onClick={() => (setCustomer(c), setCustomerQuery(''), setCustomerResults([]))} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                      {c.name} <span className="text-gray-400">{c.whatsapp}</span>
                    </button>
                  ))}
                </SearchBox>
              ))}
            <p className="mt-1.5 text-xs text-gray-500">
              {count === null ? '…' : `${count} cliente(s).`} Chega no celular de quem ativou os avisos; os demais veem no sino do site.
            </p>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Agendar (opcional)</span>
            <span className="block text-xs text-gray-400">Vazio envia na hora.</span>
            <input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} className={`${field} mt-1 sm:w-64`} />
          </label>

          {error && <ErrorBox text={error} />}
          <button type="button" onClick={send} disabled={!valid || sending} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {scheduling ? 'Agendar' : 'Enviar'}
          </button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Como chega no celular</h3>
          <div className="mt-3 rounded-2xl bg-gray-100 p-3">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5D082A] text-[10px] font-bold text-white">AF</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{title.trim() || 'Título do aviso'}</p>
                  <p className="line-clamp-2 text-xs text-gray-600">{body.trim() || 'Mensagem do aviso'}</p>
                </div>
              </div>
              {image && <img src={resolveApiUrl(image)} alt="" className="mt-2 h-32 w-full rounded-lg object-cover" />}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Historico ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const [filter, setFilter] = useState<'campaigns' | 'orders'>('campaigns')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ hasMore: boolean; items: NotificationDispatch[] } | null>(null)
  const PER = 25
  useEffect(() => {
    setData(null)
    notificationsAdminAPI
      .history({ limit: PER, offset: page * PER, type: filter === 'orders' ? 'ORDER_UPDATE' : undefined })
      .then((r) => setData(r.data))
      .catch(() => setData({ hasMore: false, items: [] }))
  }, [filter, page])

  const items = useMemo(() => data?.items || [], [data])
  return (
    <div className="space-y-3">
      <div className="flex w-max gap-1 rounded-xl bg-gray-100 p-1">
        {(
          [
            ['campaigns', 'Ofertas e campanhas'],
            ['orders', 'Avisos de pedido'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" onClick={() => (setFilter(k), setPage(0))} className={`rounded-lg px-3 py-1.5 text-sm ${filter === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>
      {!data ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/70" />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center text-sm text-gray-400">Nada enviado aqui ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          <div className="hidden grid-cols-[110px_minmax(0,1fr)_110px_repeat(3,80px)_90px] gap-3 border-b border-black/[0.05] px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 md:grid">
            <span>Quando</span>
            <span>Aviso</span>
            <span>Origem</span>
            <span className="text-right">Enviados</span>
            <span className="text-right">Abriram</span>
            <span className="text-right">Pedidos</span>
            <span className="text-right">Valor</span>
          </div>
          <ul className="divide-y divide-black/[0.05]">
            {items.map((d, i) => (
              <li key={`${d.sentAt}-${i}`} className="grid grid-cols-1 gap-x-3 gap-y-1 px-4 py-3 text-sm md:grid-cols-[110px_minmax(0,1fr)_110px_repeat(3,80px)_90px] md:items-center">
                <span className="text-xs tabular-nums text-gray-500">{new Date(d.sentAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="min-w-0">
                  <span className="block truncate text-gray-900">{d.title}</span>
                  <span className="block truncate text-xs text-gray-500">{d.body}</span>
                </span>
                <span className="text-xs text-gray-500">{SOURCE_LABEL[d.source || 'MANUAL'] || d.source}</span>
                <span className="text-xs text-gray-500 md:text-right md:text-sm md:text-gray-900">
                  <span className="md:hidden">Enviados </span>
                  <span className="tabular-nums">{d.recipients}</span>
                </span>
                <span className="text-xs text-gray-500 md:text-right md:text-sm md:text-gray-900">
                  <span className="md:hidden">Abriram </span>
                  <span className="tabular-nums">{d.opened}</span>
                </span>
                <span className="text-xs text-gray-500 md:text-right md:text-sm md:text-gray-900">
                  <span className="md:hidden">Pedidos em 48 h </span>
                  <span className="tabular-nums">{d.orders}</span>
                </span>
                <span className="text-xs tabular-nums text-gray-500 md:text-right md:text-sm md:text-gray-900">{d.revenue ? brl(d.revenue) : '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>"Abriram": tocou no aviso ou leu no sino do site. "Pedidos": comprou em até 48 h depois do aviso.</span>
        <span className="flex gap-1">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-30">
            Anterior
          </button>
          <button type="button" disabled={!data?.hasMore} onClick={() => setPage(page + 1)} className="rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-30">
            Próxima
          </button>
        </span>
      </div>
    </div>
  )
}

// ─── Pecas ───────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">{children}</div>
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
      <AlertCircle size={16} /> {text}
    </p>
  )
}

function Toggle({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-gray-900' : 'bg-gray-200'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )
}

function Thumb({ src }: { src?: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
      {src && !broken ? <img src={resolveApiUrl(src)} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} /> : <ImageOff size={13} className="text-gray-300" />}
    </span>
  )
}

function SearchBox({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  const hasResults = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <div className="relative mt-2">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-black/[0.08] bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400" />
      {hasResults && <div className="absolute left-0 right-0 top-11 z-10 max-h-72 overflow-y-auto rounded-xl border border-black/[0.08] bg-white shadow-lg">{children}</div>}
    </div>
  )
}
