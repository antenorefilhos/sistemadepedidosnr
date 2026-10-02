import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, ChevronDown, Loader2, Pencil, RefreshCw, RotateCcw, Send, SlidersHorizontal, User, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { WorkspaceDialog } from '../../components/WorkspaceDialog'
import {
  encarteNamesAPI,
  getApiErrorMessage,
  notificationQueueAPI,
  resolveApiUrl,
  type EncarteNameRow,
  type QueueItem,
  type QueueResponse,
  type QueueSettings,
} from '../../services/api'
import { SAMPLE_NAME, insertAtCursor, personalize, renderCartTemplate } from '../../utils/personalize'

// Fila de envios (02/10/2026, pedido do Jonathan): tudo que vai sair com hora
// marcada -- aviso de encarte, oferta personalizada e agendado manual -- aparece
// aqui antes de sair, para conferir, editar, cancelar, aprovar ou mandar na hora.
// Por padrao tudo sai sozinho; cada tipo pode ser desligado ou exigir aprovacao.

const TZ = 'America/Sao_Paulo'
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, ...opts })
const hhmm = (iso: string) => fmt(iso, { hour: '2-digit', minute: '2-digit' })
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function dayLabel(key: string, nowIso: string) {
  const today = dayKey(nowIso)
  const tomorrow = dayKey(new Date(new Date(nowIso).getTime() + 86_400_000).toISOString())
  if (key === today) return 'Hoje'
  if (key === tomorrow) return 'Amanhã'
  const label = new Date(`${key}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function relative(iso: string, nowIso: string) {
  const key = dayKey(iso)
  const today = dayKey(nowIso)
  const yesterday = dayKey(new Date(new Date(nowIso).getTime() - 86_400_000).toISOString())
  const day = key === today ? 'hoje' : key === yesterday ? 'ontem' : fmt(iso, { day: '2-digit', month: '2-digit' })
  return `${day} às ${hhmm(iso)}`
}

const ORIGIN: Record<string, string> = {
  ENCARTE_INICIO: 'Encarte · começou',
  ENCARTE_FIM: 'Encarte · últimas horas',
  OFERTA: 'Oferta personalizada',
  CARRINHO: 'Carrinho esquecido',
  MANUAL: 'Enviado no admin',
}
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const minutesLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`)
const STATUS: Record<string, { label: string; dot: string }> = {
  SCHEDULED: { label: 'Agendado', dot: 'bg-emerald-500' },
  PENDING_APPROVAL: { label: 'Aguardando sua aprovação', dot: 'bg-amber-500' },
  SENDING: { label: 'Enviando', dot: 'bg-sky-500' },
  SENT: { label: 'Enviado', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelado', dot: 'bg-gray-400' },
  SKIPPED: { label: 'Não saiu', dot: 'bg-amber-500' },
  FAILED: { label: 'Falhou', dot: 'bg-rose-500' },
}

function audienceText(item: QueueItem) {
  const { total, withPush } = item.audience
  let who = item.audienceLabel || 'Clientes'
  if (who === 'Todos os clientes com conta' && total != null) who = `Todos os ${total} clientes com conta`
  return withPush != null ? `${who} · ${withPush} no celular` : who
}

function destinationText(item: QueueItem) {
  const url = item.url || ''
  if (url.startsWith('/encarte/')) return 'abre a página do encarte'
  if (url === '/promocoes') return 'abre a página de ofertas'
  if (url === '/') return 'abre a página inicial'
  if (!url && item.productId) return 'abre a página do produto'
  if (url) return `abre ${url}`
  return 'abre a página inicial'
}

export default function NotificationQueueTab() {
  const [data, setData] = useState<QueueResponse | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<QueueItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      const r = await notificationQueueAPI.list(refresh)
      setData(r.data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar a fila de envios.'))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(true)
    // Status muda sozinho (agendado -> enviado): atualiza a cada minuto.
    const t = window.setInterval(() => load(false), 60_000)
    return () => window.clearInterval(t)
  }, [load])

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key)
    setNotice(null)
    try {
      await fn()
      setNotice({ tone: 'ok', text: ok })
      await load(false)
    } catch (e) {
      setNotice({ tone: 'error', text: getApiErrorMessage(e, 'Não foi possível concluir.') })
    } finally {
      setBusy(null)
    }
  }

  const actions = {
    approve: (i: QueueItem) => run(i.id, () => notificationQueueAPI.approve(i.id), 'Aprovado. Sai no horário marcado.'),
    cancel: (i: QueueItem) => window.confirm(`Cancelar "${i.title}"? Ele não vai sair.`) && run(i.id, () => notificationQueueAPI.cancel(i.id), 'Cancelado. Dá para restaurar em "Últimos 3 dias".'),
    restore: (i: QueueItem) => run(i.id, () => notificationQueueAPI.restore(i.id), 'Restaurado. Voltou para a fila.'),
    retry: (i: QueueItem) => run(i.id, () => notificationQueueAPI.retry(i.id), 'Enviado de novo.'),
    sendNow: (i: QueueItem) => {
      const n = i.audience.total
      const closed = data && !data.store.open ? ' A loja está fechada agora.' : ''
      if (!window.confirm(`Enviar "${i.title}" agora${n != null ? ` para ${plural(n, 'cliente', 'clientes')}` : ''}?${closed}`)) return
      run(
        i.id,
        async () => {
          const r = await notificationQueueAPI.sendNow(i.id)
          if (!r.data.sent) throw new Error(r.data.note || 'Não saiu.')
        },
        'Enviado.',
      )
    },
  }

  if (!data) {
    return error ? <ErrorBox text={error} /> : <div className="h-64 animate-pulse rounded-2xl bg-white/70" />
  }

  const pending = data.upcoming.filter((i) => i.status === 'PENDING_APPROVAL').length
  const next24 = data.upcoming.filter((i) => new Date(i.effectiveSendAt).getTime() - new Date(data.now).getTime() < 86_400_000).length
  const sent = data.recent.filter((i) => i.status === 'SENT')
  const opened = sent.reduce((a, i) => a + (i.opened ?? 0), 0)
  const delivered = sent.reduce((a, i) => a + (i.sentCount ?? 0), 0)

  return (
    <div className="space-y-4">
      {error && <ErrorBox text={error} />}
      {notice && (
        <p role="status" className={`rounded-2xl p-3 text-sm ring-1 ${notice.tone === 'ok' ? 'bg-white text-gray-800 ring-black/[0.06]' : 'bg-rose-50 text-rose-900 ring-rose-200'}`}>
          {notice.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Loja agora"
          value={data.store.open ? 'Aberta' : 'Fechada'}
          dot={data.store.open ? 'bg-emerald-500' : 'bg-gray-400'}
          hint={data.store.open ? (data.store.closesAt ? `fecha às ${hhmm(data.store.closesAt)}` : '') : data.store.opensAt ? `abre ${relative(data.store.opensAt, data.now)}` : ''}
        />
        <Stat label="Próximas 24 h" value={String(next24)} hint={plural(data.upcoming.length, 'aviso na fila', 'avisos na fila')} />
        <Stat label="Esperando você" value={String(pending)} dot={pending ? 'bg-amber-500' : undefined} hint="aprovação pendente" />
        <Stat label="Saíram · 3 dias" value={String(sent.length)} hint={delivered ? `${plural(delivered, 'cliente', 'clientes')} · ${opened} abriram` : 'nenhum envio'} />
      </div>

      <Sources
        settings={data.settings}
        audience={data.audience}
        cartStats={data.cartStats}
        onCustomizeCart={() => setCartOpen(true)}
        onChange={(patch) => run('settings', () => notificationQueueAPI.settings(patch), 'Configuração salva.')}
        busy={busy === 'settings'}
      />

      <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Vai sair</h3>
          <button type="button" onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
        {data.upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">
            Nada programado. Aviso de encarte entra aqui sozinho quando um encarte chega do ERP; oferta personalizada, até 6 h antes do horário dela.
          </p>
        ) : (
          <Timeline items={data.upcoming} now={data.now} busy={busy} onEdit={setEditing} actions={actions} />
        )}
      </section>

      <Recent items={data.recent} now={data.now} busy={busy} actions={actions} />

      <EncarteNames onSaved={() => load(true)} />

      {cartOpen && (
        <CartReminderDialog
          settings={data.settings}
          stats={data.cartStats}
          onClose={() => setCartOpen(false)}
          onSaved={async () => {
            setCartOpen(false)
            setNotice({ tone: 'ok', text: 'Lembrete de carrinho salvo. Os que ainda não saíram já usam o texto novo.' })
            await load(true)
          }}
        />
      )}

      {editing && (
        <Editor
          item={editing}
          now={data.now}
          storeOpen={data.store.open}
          onClose={() => setEditing(null)}
          onSaved={async (text) => {
            setEditing(null)
            setNotice({ tone: 'ok', text })
            await load(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Quem envia sozinho ───────────────────────────────────────────────────

function Sources({
  settings,
  audience,
  cartStats,
  onCustomizeCart,
  onChange,
  busy,
}: {
  settings: QueueSettings
  audience: QueueResponse['audience']
  cartStats: QueueResponse['cartStats']
  onCustomizeCart: () => void
  onChange: (patch: Partial<Omit<QueueSettings, 'offerSendHours'>>) => void
  busy: boolean
}) {
  const hours = settings.offerSendHours
    .split(',')
    .map((h) => `${h.trim()}h`)
    .join(' e ')
  const rows: Array<{ name: string; when: string; on: boolean; onKey: keyof QueueSettings; approval?: boolean; approvalKey?: keyof QueueSettings; extra?: React.ReactNode }> = [
    { name: 'Avisos de encarte', when: 'na abertura do primeiro dia e 3 h antes do fechamento do último', on: settings.encarteEnabled, onKey: 'encarteEnabled', approval: settings.encarteApproval, approvalKey: 'encarteApproval' },
    { name: 'Ofertas personalizadas', when: `às ${hours}, a melhor oferta para cada cliente`, on: settings.offerEnabled, onKey: 'offerEnabled', approval: settings.offerApproval, approvalKey: 'offerApproval' },
    {
      name: 'Carrinho esquecido',
      when: `${minutesLabel(settings.cartDelayMinutes)} depois que o cliente logado para de mexer no carrinho${settings.cartMinTotal > 0 ? `, a partir de ${brl(settings.cartMinTotal)}` : ''} · no máximo 1 a cada ${plural(settings.cartCooldownDays, 'dia', 'dias')}`,
      on: settings.cartEnabled,
      onKey: 'cartEnabled',
      approval: settings.cartApproval,
      approvalKey: 'cartApproval',
      extra: (
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" onClick={onCustomizeCart} className="inline-flex items-center gap-1 text-xs font-medium text-gray-900 underline-offset-2 hover:underline">
            <SlidersHorizontal size={12} /> Personalizar
          </button>
          <span className="text-xs text-gray-500">
            30 dias: {plural(cartStats.sent, 'lembrete', 'lembretes')} · {cartStats.opened} abriram · {plural(cartStats.recovered, 'pedido', 'pedidos')} em 48 h
            {cartStats.revenue > 0 && ` (${brl(cartStats.revenue)})`}
          </span>
        </span>
      ),
    },
  ]
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">O que sai sozinho</h3>
        <p className="text-xs text-gray-500">
          {audience.customers} clientes com conta · {audience.withPush} recebem no celular · só com a loja aberta
        </p>
      </div>
      <ul className="mt-2 divide-y divide-black/[0.05]">
        {rows.map((r) => (
          <li key={r.name} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-gray-900">{r.name}</span>
              <span className="block text-xs text-gray-500">{r.when}</span>
              {r.extra}
            </span>
            <span className="flex flex-wrap items-center gap-4">
              {r.approvalKey && (
                <label className={`flex items-center gap-2 text-xs ${r.on ? 'text-gray-700' : 'text-gray-400'}`}>
                  <Switch checked={Boolean(r.approval)} disabled={busy || !r.on} onChange={(v) => onChange({ [r.approvalKey as string]: v })} aria-label={`Exigir aprovação: ${r.name}`} />
                  Exigir minha aprovação
                </label>
              )}
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <Switch checked={r.on} disabled={busy} onChange={(v) => onChange({ [r.onKey as string]: v })} aria-label={`Ligar ${r.name}`} />
                {r.on ? 'Ligado' : 'Desligado'}
              </label>
            </span>
          </li>
        ))}
        <li className="py-3 text-xs text-gray-500">
          Enviado no admin (aba Enviar aviso): sai no horário escolhido e também aparece aqui. Em qualquer texto, <code className="rounded bg-gray-100 px-1">{'{nome}'}</code> vira o primeiro nome de cada cliente.
        </li>
      </ul>
    </section>
  )
}

// ─── Linha do tempo ───────────────────────────────────────────────────────

type Actions = Record<'approve' | 'cancel' | 'restore' | 'retry' | 'sendNow', (i: QueueItem) => void>

function Timeline({ items, now, busy, onEdit, actions }: { items: QueueItem[]; now: string; busy: string | null; onEdit: (i: QueueItem) => void; actions: Actions }) {
  const days = useMemo(() => {
    const map = new Map<string, QueueItem[]>()
    for (const i of items) map.set(dayKey(i.effectiveSendAt), [...(map.get(dayKey(i.effectiveSendAt)) || []), i])
    return [...map.entries()]
  }, [items])
  return (
    <div className="mt-3 space-y-5">
      {days.map(([key, list]) => {
        // Ofertas do mesmo horario viram um bloco so (uma oferta por produto).
        const blocks: Array<QueueItem | QueueItem[]> = []
        for (const i of list) {
          const last = blocks[blocks.length - 1]
          if (i.origin === 'OFERTA' && Array.isArray(last) && last[0].meta?.slot === i.meta?.slot) last.push(i)
          else blocks.push(i.origin === 'OFERTA' ? [i] : i)
        }
        return (
          <div key={key}>
            <p className="mb-2 text-xs font-medium text-gray-500">{dayLabel(key, now)}</p>
            <ol className="space-y-2">
              {blocks.map((b) =>
                Array.isArray(b) ? (
                  <OfferBlock key={b[0].id} items={b} busy={busy} onEdit={onEdit} actions={actions} />
                ) : (
                  <ItemCard key={b.id} item={b} busy={busy === b.id} onEdit={onEdit} actions={actions} />
                ),
              )}
            </ol>
          </div>
        )
      })}
    </div>
  )
}

function When({ item }: { item: QueueItem }) {
  const moved = item.respectHours && item.effectiveSendAt !== item.sendAt && new Date(item.effectiveSendAt).getTime() - new Date(item.sendAt).getTime() > 60_000
  return (
    <span className="w-14 shrink-0">
      <span className="block text-lg font-semibold tabular-nums leading-tight text-gray-900">{hhmm(item.effectiveSendAt)}</span>
      {moved && <span className="block text-[11px] leading-tight text-gray-500">na abertura</span>}
    </span>
  )
}

function Badge({ status }: { status: string }) {
  const s = STATUS[status] || { label: status, dot: 'bg-gray-400' }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function ItemCard({ item, busy, onEdit, actions }: { item: QueueItem; busy: boolean; onEdit: (i: QueueItem) => void; actions: Actions }) {
  const m = item.meta || {}
  const fewOffers = item.origin.startsWith('ENCARTE') && typeof m.offers === 'number' && m.offers < 3
  const cartItems = Array.isArray(m.items) ? m.items : null
  return (
    <li className="flex gap-3 rounded-xl border border-black/[0.06] p-3">
      <When item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs font-medium text-gray-900">{ORIGIN[item.origin] || item.origin}</span>
          {m.campaign && <span className="text-xs text-gray-500">{m.campaign}{m.erpName && m.erpName !== m.campaign ? ` (no ERP: ${m.erpName})` : ''}</span>}
          <Badge status={item.status} />
        </div>
        <p className="mt-1.5 text-sm font-semibold text-gray-900 [overflow-wrap:anywhere]">{item.title}</p>
        <p className="text-sm text-gray-700 [overflow-wrap:anywhere]">{item.body}</p>
        <p className="mt-1 text-xs text-gray-500">
          {item.origin === 'CARRINHO'
            ? `${m.customer || 'Cliente'} · ${plural(m.itemCount ?? 0, 'item', 'itens')} · ${brl(m.subtotal ?? 0)} · abre o carrinho`
            : `${audienceText(item)} · ${destinationText(item)}`}
        </p>
        {cartItems && cartItems.length > 0 && (
          <p className="mt-0.5 text-[11px] text-gray-400 [overflow-wrap:anywhere]">
            {cartItems.map((i) => `${i.name} (${Number(i.quantity).toLocaleString('pt-BR')})`).join(' · ')}
          </p>
        )}
        {fewOffers && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-800">
            <AlertCircle size={12} /> Só {plural(m.offers as number, 'oferta de verdade à venda', 'ofertas de verdade à venda')} ({typeof m.items === 'number' ? m.items : '?'} no encarte).
          </p>
        )}
        {(item.edited || item.approved) && (
          <p className="mt-1 text-[11px] text-gray-400">
            {item.edited && `Editado${item.edited.by ? ` por ${item.edited.by}` : ''}`}
            {item.edited && item.approved && ' · '}
            {item.approved && `Aprovado${item.approved.by ? ` por ${item.approved.by}` : ''}`}
          </p>
        )}
        {item.editable && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {item.status === 'PENDING_APPROVAL' && (
              <Action onClick={() => actions.approve(item)} disabled={busy} primary icon={<Check size={13} />}>
                Aprovar
              </Action>
            )}
            <Action onClick={() => onEdit(item)} disabled={busy} icon={<Pencil size={13} />}>
              Editar
            </Action>
            <Action onClick={() => actions.sendNow(item)} disabled={busy} icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}>
              Enviar agora
            </Action>
            <Action onClick={() => actions.cancel(item)} disabled={busy} icon={<X size={13} />} danger>
              Cancelar
            </Action>
          </div>
        )}
      </div>
    </li>
  )
}

function OfferBlock({ items, busy, onEdit, actions }: { items: QueueItem[]; busy: string | null; onEdit: (i: QueueItem) => void; actions: Actions }) {
  const [open, setOpen] = useState(items.length <= 3)
  const people = items.reduce((a, i) => a + (i.audience.total ?? 0), 0)
  return (
    <li className="rounded-xl border border-black/[0.06] p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 text-left">
        <When item={items[0]} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-gray-900">Ofertas personalizadas</span>
          <span className="block text-xs text-gray-500">
            {plural(items.length, 'oferta', 'ofertas')} para {plural(people, 'cliente', 'clientes')} · cada um recebe a que mais combina com ele
          </span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="mt-2 space-y-2">
          {items.map((i) => (
            <ItemCard key={i.id} item={i} busy={busy === i.id} onEdit={onEdit} actions={actions} />
          ))}
        </ol>
      )}
    </li>
  )
}

function Action({ children, onClick, disabled, icon, primary, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; icon?: React.ReactNode; primary?: boolean; danger?: boolean }) {
  const tone = primary ? 'bg-gray-900 text-white' : danger ? 'text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50' : 'text-gray-700 ring-1 ring-black/[0.08] hover:bg-gray-50'
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${tone} disabled:opacity-40`}>
      {icon}
      {children}
    </button>
  )
}

// ─── Ultimos 3 dias ───────────────────────────────────────────────────────

function Recent({ items, now, busy, actions }: { items: QueueItem[]; now: string; busy: string | null; actions: Actions }) {
  const [open, setOpen] = useState(false)
  if (!items.length) return null
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Últimos 3 dias · {items.length}</h3>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-black/[0.05]">
          {items.map((i) => (
            <li key={i.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-gray-900 [overflow-wrap:anywhere]">{i.title}</span>
                <span className="block text-xs text-gray-500">
                  {ORIGIN[i.origin] || i.origin} · {i.sentAt ? `saiu ${relative(i.sentAt, now)}` : `marcado para ${relative(i.sendAt, now)}`}
                  {i.status === 'SENT' && i.sentCount != null && ` · ${plural(i.sentCount, 'cliente', 'clientes')}${i.opened != null ? ` · ${i.opened} abriram` : ''}`}
                  {i.status === 'CANCELLED' && i.cancelled?.by && ` · por ${i.cancelled.by}`}
                  {i.note && i.status !== 'CANCELLED' && ` · ${i.note}`}
                  {i.note && i.status === 'CANCELLED' && !i.cancelled?.by && ` · ${i.note}`}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <Badge status={i.status} />
                {i.canRestore && (
                  <Action onClick={() => actions.restore(i)} disabled={busy === i.id} icon={<RotateCcw size={13} />}>
                    Restaurar
                  </Action>
                )}
                {i.status === 'FAILED' && (
                  <Action onClick={() => actions.retry(i)} disabled={busy === i.id} icon={<RefreshCw size={13} />}>
                    Tentar de novo
                  </Action>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── Nome dos encartes ────────────────────────────────────────────────────

function EncarteNames({ onSaved }: { onSaved: () => void }) {
  const [rows, setRows] = useState<EncarteNameRow[] | null>(null)
  const [edit, setEdit] = useState<EncarteNameRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(() => encarteNamesAPI.list().then((r) => setRows(r.data.erpNames)).catch(() => setRows([])), [])
  useEffect(() => {
    load()
  }, [load])
  if (!rows?.length) return null

  const save = async () => {
    if (!edit) return
    setSaving(true)
    setError('')
    try {
      await encarteNamesAPI.save({ key: edit.key, customerName: edit.customerName, nearExpiry: edit.nearExpiry })
      setEdit(null)
      await load()
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Nome dos encartes para o cliente</h3>
      <p className="mt-1 text-xs text-gray-500">Vale para o site, os banners e os avisos. No ERP o nome continua o mesmo, e a regra vale para toda semana em que o encarte voltar.</p>
      <ul className="mt-2 divide-y divide-black/[0.05]">
        {rows.map((r) =>
          edit?.key === r.key ? (
            <li key={r.key} className="space-y-2 py-3">
              <p className="text-xs text-gray-500">No ERP: {r.erpName || r.key}</p>
              <input
                autoFocus
                value={edit.customerName}
                maxLength={60}
                onChange={(e) => setEdit({ ...edit, customerName: e.target.value })}
                className="h-10 w-full rounded-xl border border-black/[0.08] px-3 text-sm text-gray-900"
                aria-label="Nome para o cliente"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Switch checked={edit.nearExpiry} onChange={(v) => setEdit({ ...edit, nearExpiry: v })} aria-label="Produtos com validade próxima" />
                Produtos com validade próxima (mostra "Preço especial: validade próxima")
              </label>
              {error && <p className="text-xs text-rose-700">{error}</p>}
              <div className="flex gap-2">
                <Action onClick={save} disabled={saving || !edit.customerName.trim()} primary icon={saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}>
                  Salvar
                </Action>
                <Action onClick={() => setEdit(null)} disabled={saving}>
                  Cancelar
                </Action>
              </div>
            </li>
          ) : (
            <li key={r.key} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-gray-900">{r.customerName}</span>
                <span className="block text-xs text-gray-500">
                  No ERP: {r.erpName || r.key}
                  {r.nearExpiry && ' · avisa validade próxima'}
                  {!r.hasRule && ' · nome automático'}
                </span>
              </span>
              <Action onClick={() => setEdit(r)} icon={<Pencil size={13} />}>
                Renomear
              </Action>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}

// ─── Editor ───────────────────────────────────────────────────────────────

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function Editor({ item, now, storeOpen, onClose, onSaved }: { item: QueueItem; now: string; storeOpen: boolean; onClose: () => void; onSaved: (text: string) => void }) {
  const [title, setTitle] = useState(item.title)
  const [body, setBody] = useState(item.body)
  const [url, setUrl] = useState<string>(item.url ?? '')
  const [when, setWhen] = useState(toLocalInput(item.sendAt))
  const [image, setImage] = useState<string | null>(item.imageUrl)
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const m = item.meta || {}

  const destinations = [
    ...(m.erpCampaignId ? [{ value: `/encarte/${m.erpCampaignId}`, label: 'Página do encarte' }] : []),
    { value: '/promocoes', label: 'Página de ofertas' },
    ...(item.productId ? [{ value: '', label: 'Página do produto' }] : []),
    { value: '/', label: 'Página inicial' },
  ]
  const custom = !destinations.some((d) => d.value === url)
  const problems = [!title.trim() && 'título', !body.trim() && 'texto', title.length > 80 && 'título longo demais', body.length > 180 && 'texto longo demais'].filter(Boolean) as string[]

  const save = async (approve: boolean) => {
    setSaving(true)
    setError('')
    try {
      const patch: Record<string, unknown> = {}
      if (title !== item.title) patch.title = title
      if (body !== item.body) patch.body = body
      if ((url || null) !== (item.url || null)) patch.url = url || null
      if (image !== item.imageUrl) patch.imageUrl = image
      if (when !== toLocalInput(item.sendAt)) patch.sendAt = new Date(when).toISOString()
      if (Object.keys(patch).length) await notificationQueueAPI.edit(item.id, patch)
      if (approve) await notificationQueueAPI.approve(item.id)
      onSaved(approve ? 'Salvo e aprovado.' : Object.keys(patch).length ? 'Alterações salvas. O planejador não muda mais esse aviso.' : 'Nada mudou.')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900'
  return (
    <WorkspaceDialog
      label="Editar aviso"
      onClose={onClose}
      title={
        <>
          <h3 className="text-base font-semibold text-gray-900">Editar aviso</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {ORIGIN[item.origin] || item.origin} · {audienceText(item)}
          </p>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-gray-500">{error ? <span className="text-rose-700">{error}</span> : problems.length ? `Ajuste: ${problems.join(', ')}.` : ''}</p>
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            Cancelar
          </button>
          <button type="button" onClick={() => save(false)} disabled={saving || problems.length > 0} className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm disabled:opacity-40 ${item.status === 'PENDING_APPROVAL' ? 'text-gray-900 ring-1 ring-black/10' : 'bg-gray-900 text-white'}`}>
            {saving && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
          {item.status === 'PENDING_APPROVAL' && (
            <button type="button" onClick={() => save(true)} disabled={saving || problems.length > 0} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-40">
              Salvar e aprovar
            </button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:gap-10">
        <div className="space-y-4">
          <label className="block">
            <span className="flex justify-between text-xs text-gray-600">
              Título <span className={title.length > 50 ? 'text-amber-700' : 'text-gray-400'}>{title.length}/80</span>
            </span>
            <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={`${field} mt-1 h-10`} />
            <NameChip onClick={() => setTitle(insertAtCursor(titleRef.current, title, '{nome}'))} />
            {title.length > 50 && <span className="mt-1 block text-[11px] text-amber-800">Na tela bloqueada o título pode ser cortado depois de uns 50 caracteres.</span>}
          </label>
          <label className="block">
            <span className="flex justify-between text-xs text-gray-600">
              Texto <span className={body.length > 120 ? 'text-amber-700' : 'text-gray-400'}>{body.length}/180</span>
            </span>
            <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} maxLength={180} rows={3} className={`${field} mt-1 py-2`} />
            <NameChip onClick={() => setBody(insertAtCursor(bodyRef.current, body, '{nome}'))} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Ao tocar, abre</span>
            <select value={custom ? '__custom' : url} onChange={(e) => setUrl(e.target.value === '__custom' ? '/' : e.target.value)} className={`${field} mt-1 h-10`}>
              {destinations.map((d) => (
                <option key={d.label} value={d.value}>
                  {d.label}
                </option>
              ))}
              <option value="__custom">Outra página da loja…</option>
            </select>
            {custom && <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/mercado?cat=..." className={`${field} mt-2 h-10`} />}
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">Quando sai</span>
            <input
              type="datetime-local"
              value={when}
              min={toLocalInput(now)}
              max={item.expiresAt ? toLocalInput(item.expiresAt) : undefined}
              onChange={(e) => setWhen(e.target.value)}
              className={`${field} mt-1 h-10`}
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              {item.respectHours ? 'Sai só com a loja aberta: marcado com a loja fechada, sai na abertura. ' : ''}
              {item.expiresAt && `Limite: ${fmt(item.expiresAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} (depois disso a oferta já saiu do site).`}
              {!storeOpen && ' A loja está fechada agora.'}
            </span>
          </label>
          {image && (
            <div className="flex items-center gap-3">
              <img src={resolveApiUrl(image)} alt="" className="h-12 w-12 rounded-lg object-contain ring-1 ring-black/[0.06]" />
              <button type="button" onClick={() => setImage(null)} className="text-xs text-gray-600 underline">
                Tirar a imagem
              </button>
            </div>
          )}
          {m.customers && m.customers.length > 0 && (
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer">Quem recebe e por quê ({m.customers.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {m.customers.map((c) => (
                  <li key={c.id}>
                    {c.name || 'Cliente'} · {c.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Como o cliente vê</p>
          <PushPreview title={personalize(title, SAMPLE_NAME)} body={personalize(body, SAMPLE_NAME)} image={image} />
          <BellPreview title={personalize(title, SAMPLE_NAME)} body={personalize(body, SAMPLE_NAME)} />
          {/\{\s*nome\s*\}/i.test(title + body) && (
            <p className="text-[11px] text-gray-500">
              Prévia com "{SAMPLE_NAME}". Cada cliente recebe com o próprio primeiro nome; quem não tem nome cadastrado recebe a frase sem ele: "{personalize(title, null)}".
            </p>
          )}
        </div>
      </div>
    </WorkspaceDialog>
  )
}

function NameChip({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-200">
      <User size={11} /> Inserir nome do cliente
    </button>
  )
}

const DELAYS = [30, 60, 120, 180, 360, 720, 1440]
const COOLDOWNS = [0, 1, 2, 3, 5, 7, 14, 30]

function CartReminderDialog({ settings, stats, onClose, onSaved }: { settings: QueueSettings; stats: QueueResponse['cartStats']; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(settings.cartTitle)
  const [body, setBody] = useState(settings.cartBody)
  const [delay, setDelay] = useState(settings.cartDelayMinutes)
  const [minTotal, setMinTotal] = useState(String(settings.cartMinTotal || ''))
  const [cooldown, setCooldown] = useState(settings.cartCooldownDays)
  const [image, setImage] = useState(settings.cartImage)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [focus, setFocus] = useState<'title' | 'body'>('body')
  const sample = { name: SAMPLE_NAME, product: 'Picanha Bovina Peça kg', itemCount: 4, subtotal: 186.4 }
  const previewTitle = renderCartTemplate(title, sample)
  const previewBody = renderCartTemplate(body, sample)
  const min = Number(String(minTotal).replace(',', '.')) || 0
  const problems = [!title.trim() && 'título', !body.trim() && 'texto', title.length > 80 && 'título longo demais', body.length > 180 && 'texto longo demais'].filter(Boolean) as string[]

  const insert = (token: string) => {
    if (focus === 'title') setTitle(insertAtCursor(titleRef.current, title, token))
    else setBody(insertAtCursor(bodyRef.current, body, token))
  }
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await notificationQueueAPI.settings({ cartTitle: title, cartBody: body, cartDelayMinutes: delay, cartMinTotal: min, cartCooldownDays: cooldown, cartImage: image })
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }
  const field = 'w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900'
  const tokens: Array<[string, string]> = [
    ['{nome}', 'nome do cliente'],
    ['{itens}', 'produto principal e quantos mais'],
    ['{produto}', 'só o produto principal'],
    ['{total}', 'valor do carrinho'],
  ]

  return (
    <WorkspaceDialog
      label="Lembrete de carrinho esquecido"
      onClose={onClose}
      title={
        <>
          <h3 className="text-base font-semibold text-gray-900">Lembrete de carrinho esquecido</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Para cliente logado que montou o carrinho e não fechou o pedido. Sai com a loja aberta e aparece na fila antes de sair.
          </p>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-gray-500">{error ? <span className="text-rose-700">{error}</span> : problems.length ? `Ajuste: ${problems.join(', ')}.` : ''}</p>
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving || problems.length > 0} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-40">
            {saving && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:gap-10">
        <div className="space-y-4">
          <label className="block">
            <span className="flex justify-between text-xs text-gray-600">
              Título <span className={title.length > 50 ? 'text-amber-700' : 'text-gray-400'}>{title.length}/80</span>
            </span>
            <input ref={titleRef} value={title} onFocus={() => setFocus('title')} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={`${field} mt-1 h-10`} />
          </label>
          <label className="block">
            <span className="flex justify-between text-xs text-gray-600">
              Texto <span className={body.length > 120 ? 'text-amber-700' : 'text-gray-400'}>{body.length}/180</span>
            </span>
            <textarea ref={bodyRef} value={body} onFocus={() => setFocus('body')} onChange={(e) => setBody(e.target.value)} maxLength={180} rows={3} className={`${field} mt-1 py-2`} />
          </label>
          <div>
            <p className="text-xs text-gray-600">Inserir no {focus === 'title' ? 'título' : 'texto'}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {tokens.map(([t, label]) => (
                <button key={t} type="button" onClick={() => insert(t)} className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-200" title={label}>
                  {t} <span className="text-gray-400">· {label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-gray-600">Esperar depois que o cliente para</span>
              <select value={delay} onChange={(e) => setDelay(Number(e.target.value))} className={`${field} mt-1 h-10`}>
                {[...new Set([...DELAYS, settings.cartDelayMinutes])].sort((a, b) => a - b).map((m) => (
                  <option key={m} value={m}>
                    {minutesLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">No máximo 1 lembrete a cada</span>
              <select value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} className={`${field} mt-1 h-10`}>
                {[...new Set([...COOLDOWNS, settings.cartCooldownDays])].sort((a, b) => a - b).map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? 'sem limite (1 por carrinho)' : plural(d, 'dia', 'dias')}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Só carrinho a partir de (R$)</span>
              <input inputMode="decimal" value={minTotal} onChange={(e) => setMinTotal(e.target.value)} placeholder="0,00 = qualquer valor" className={`${field} mt-1 h-10`} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
              <Switch checked={image} onChange={setImage} aria-label="Mostrar a foto do produto principal" />
              Foto do produto principal
            </label>
          </div>
          <p className="text-[11px] text-gray-500">
            Não lembra quem já fechou o pedido, quem mexeu no carrinho de novo (o relógio recomeça) nem cliente bloqueado. Cliente sem login não tem como ser lembrado.
          </p>
        </div>
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Como o cliente vê</p>
          <PushPreview title={previewTitle} body={previewBody} image={null} />
          {image && <p className="-mt-2 text-[11px] text-gray-500">No celular vai também a foto do produto de maior valor do carrinho.</p>}
          <BellPreview title={previewTitle} body={previewBody} />
          <p className="text-[11px] text-gray-500">
            Prévia com {SAMPLE_NAME}, 4 itens e {brl(sample.subtotal)}. Sem nome cadastrado: "{renderCartTemplate(title, { ...sample, name: null })}".
          </p>
          <div className="rounded-2xl border border-black/[0.06] p-3 text-xs text-gray-600">
            <p className="font-medium text-gray-900">Últimos 30 dias</p>
            <p className="mt-1">
              {plural(stats.sent, 'lembrete enviado', 'lembretes enviados')} · {stats.opened} abriram · {plural(stats.recovered, 'pedido', 'pedidos')} em até 48 h
              {stats.revenue > 0 && ` · ${brl(stats.revenue)}`}
            </p>
          </div>
        </div>
      </div>
    </WorkspaceDialog>
  )
}

function PushPreview({ title, body, image }: { title: string; body: string; image: string | null }) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-gray-700 to-gray-900 p-4">
      <p className="mb-2 text-center text-[11px] text-white/70">Tela do celular</p>
      <div className="rounded-2xl bg-white/95 p-3 shadow-lg">
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#5D082A] text-[8px] font-bold text-white">A&F</span>
          Antenor & Filhos · agora
        </div>
        <p className="mt-1.5 truncate text-sm font-semibold text-gray-900">{title || 'Título'}</p>
        <p className="line-clamp-2 text-sm text-gray-700">{body || 'Texto do aviso'}</p>
        {image && <img src={resolveApiUrl(image)} alt="" className="mt-2 h-28 w-full rounded-xl bg-white object-contain" />}
      </div>
    </div>
  )
}

function BellPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] p-3">
      <p className="mb-2 text-[11px] text-gray-500">No sininho do site</p>
      <div className="rounded-lg bg-blue-50 px-4 py-3">
        <p className="text-sm font-semibold text-gray-800 [overflow-wrap:anywhere]">{title || 'Título'}</p>
        <p className="mt-1 text-xs text-gray-600 [overflow-wrap:anywhere]">{body || 'Texto do aviso'}</p>
      </div>
    </div>
  )
}

function Stat({ label, value, hint, dot }: { label: string; value: string; hint?: string; dot?: string }) {
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

function ErrorBox({ text }: { text: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
      <AlertCircle size={16} /> {text}
    </p>
  )
}
