import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowDown, ArrowUp, Check, Copy, Pencil, Plus, Search as SearchIcon, Trash2, X } from 'lucide-react'
import { WorkspaceDialog } from '../components/WorkspaceDialog'
import { getApiErrorMessage, productsAPI, sponsoredShelvesAdminAPI, type SponsoredShelfAdmin, type SponsoredShelfProduct } from '../services/api'

// Vitrines Patrocinadas (refeita em 30/09/2026). Vitrine de fornecedor na
// pagina inicial (JON-204). O que mudou: a vigencia vale o dia inteiro em
// Brasilia (antes o fim tirava a vitrine as 21h da vespera); a loja esconde
// produto que nao esta a venda e agora a tela diz qual e por que; e cada
// vitrine traz o relatorio que o fornecedor pede -- vezes vista, postos no
// carrinho pela vitrine, pedidos e vendas dos produtos contra o periodo
// anterior -- com um resumo pronto para copiar.

const TZ = 'America/Sao_Paulo'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const dayBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ })
const dayInput = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
const todayInput = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })

type Shelf = SponsoredShelfAdmin
type Status = { tone: 'ok' | 'warn' | 'info' | 'off'; text: string; live: boolean }
const DOT = { ok: 'bg-emerald-600', warn: 'bg-amber-500', info: 'bg-sky-500', off: 'bg-gray-300' }

/** Espelha SponsoredShelvesService.listPublic: ativa, dentro da vigencia e com produto a venda. */
function shelfStatus(s: Shelf, now = Date.now()): Status {
  if (!s.active) return { tone: 'off', text: 'Pausada', live: false }
  if (s.startDate && new Date(s.startDate).getTime() > now) return { tone: 'info', text: `Agendada para ${dayBR(s.startDate)}`, live: false }
  if (s.endDate && new Date(s.endDate).getTime() < now) return { tone: 'off', text: `Encerrada em ${dayBR(s.endDate)}`, live: false }
  if (!s.items.some((i) => !i.hiddenReason)) return { tone: 'warn', text: 'Não aparece: nenhum produto está à venda', live: false }
  return { tone: 'ok', text: s.endDate ? `No ar até ${dayBR(s.endDate)}` : 'No ar, sem data para sair', live: true }
}

const change = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)

function summaryText(s: Shelf) {
  const r = s.report
  const lines = [`Vitrine "${s.title}"${s.sponsorName ? ` (parceria ${s.sponsorName})` : ''} no site Antenor & Filhos`]
  if (r.sales) lines[0] += ` · ${dayBR(r.sales.from)} a ${dayBR(r.sales.to)}`
  lines.push(`• Vista ${num(r.impressions)} vezes na página inicial`)
  lines.push(`• ${r.adds} produto(s) postos no carrinho direto da vitrine; ${r.orders} pedido(s) com esses produtos (${brl(r.revenue)})`)
  if (r.sales) {
    const pct = change(r.sales.current.revenue, r.sales.previous.revenue)
    lines.push(
      `• Vendas dos ${s.items.length} produtos no site no período: ${brl(r.sales.current.revenue)} (${num(r.sales.current.units)} un., ${r.sales.current.orders} pedidos)` +
        `, contra ${brl(r.sales.previous.revenue)} no período anterior${pct != null ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}`,
    )
  }
  return lines.join('\n')
}

export default function SponsoredShelves() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Shelf | 'new' | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data: shelves, isLoading } = useQuery({
    queryKey: ['sponsored-shelves-admin'],
    queryFn: () => sponsoredShelvesAdminAPI.list().then((r) => r.data),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sponsored-shelves-admin'] })

  const toggle = useMutation({
    mutationFn: (s: Shelf) => sponsoredShelvesAdminAPI.update(s.id, { active: !s.active }),
    onSuccess: refresh,
    onError: (e) => setError(getApiErrorMessage(e, 'Não foi possível salvar.')),
  })
  const remove = useMutation({
    mutationFn: (id: string) => sponsoredShelvesAdminAPI.remove(id),
    onSuccess: refresh,
    onError: (e) => setError(getApiErrorMessage(e, 'Não foi possível apagar.')),
  })

  const copy = (s: Shelf) =>
    navigator.clipboard?.writeText(summaryText(s)).then(() => {
      setCopied(s.id)
      window.setTimeout(() => setCopied(null), 2500)
    })

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-500">
          Vitrine de um fornecedor na página inicial, com os produtos que você escolher. Cada uma traz o resultado para mostrar ao fornecedor.
        </p>
        <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-sm text-white hover:bg-gray-800">
          <Plus size={15} /> Nova vitrine
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white/70" />
      ) : !shelves?.length ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-10 text-center text-sm text-gray-500">Nenhuma vitrine patrocinada ainda.</div>
      ) : (
        shelves.map((s) => {
          const st = shelfStatus(s)
          const hidden = s.items.filter((i) => i.hiddenReason)
          const r = s.report
          const pct = r.sales ? change(r.sales.current.revenue, r.sales.previous.revenue) : null
          return (
            <section key={s.id} className="rounded-2xl border border-black/[0.06] bg-white">
              <div className="flex flex-col gap-3 border-b border-black/[0.05] p-4 sm:flex-row sm:items-start">
                <button type="button" onClick={() => setEditing(s)} className="min-w-0 flex-1 text-left">
                  <span className="block text-[11px] uppercase tracking-wide text-gray-400">{s.sponsorName ? `Parceria ${s.sponsorName}` : 'Vitrine patrocinada'}</span>
                  <span className="block text-base font-semibold text-gray-900">{s.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-600">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[st.tone]}`} />
                    {st.text}
                    {s.startDate && ` · desde ${dayBR(s.startDate)}`}
                  </span>
                </button>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.active}
                    aria-label={`${s.title}: ${s.active ? 'ligada' : 'pausada'}`}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(s)}
                    className={`relative mr-1 h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.active ? 'bg-gray-900' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.active ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <IconBtn label={copied === s.id ? 'Resumo copiado' : 'Copiar resumo para o fornecedor'} onClick={() => copy(s)}>
                    {copied === s.id ? <Check size={15} /> : <Copy size={15} />}
                  </IconBtn>
                  <IconBtn label="Editar" onClick={() => setEditing(s)}>
                    <Pencil size={15} />
                  </IconBtn>
                  <IconBtn
                    label="Apagar"
                    danger
                    onClick={() => window.confirm(`Apagar a vitrine "${s.title}"? O relatório dela se perde.`) && remove.mutate(s.id)}
                  >
                    <Trash2 size={15} />
                  </IconBtn>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-px bg-black/[0.04] lg:grid-cols-4">
                <Metric label="Vista na página inicial" value={`${num(r.impressions)} vezes`} hint="contando desde 30/09" />
                <Metric label="No carrinho pela vitrine" value={String(r.adds)} hint="toques em adicionar dentro da vitrine" />
                <Metric label="Viraram pedido" value={r.orders ? `${r.orders} · ${brl(r.revenue)}` : '0'} hint="mesmo aparelho, em até 24 h" />
                <Metric
                  label="Vendas dos produtos no período"
                  value={r.sales ? brl(r.sales.current.revenue) : '—'}
                  hint={
                    r.sales
                      ? `${num(r.sales.current.units)} un. · antes ${brl(r.sales.previous.revenue)}${pct != null ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}`
                      : 'começa a contar no início da vigência'
                  }
                />
              </div>

              <div className="p-4 text-xs text-gray-600">
                {s.items.length} produto(s), {s.items.length - hidden.length} à venda.
                {hidden.length > 0 && (
                  <span className="mt-1 block text-amber-700">
                    Fora da vitrine: {hidden.map((i) => `${i.product.name} (${i.hiddenReason?.toLowerCase()})`).join(' · ')}
                  </span>
                )}
                {r.sales && (
                  <span className="mt-1 block text-gray-400">
                    Período medido: {dayBR(r.sales.from)} a {dayBR(r.sales.to)}
                    {!s.startDate && ' (sem início definido: últimos 30 dias)'}, comparado com os {Math.max(1, Math.round((new Date(r.sales.to).getTime() - new Date(r.sales.from).getTime()) / 86_400_000))} dias antes.
                  </span>
                )}
              </div>
            </section>
          )
        })
      )}

      {editing && (
        <ShelfEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function ShelfEditor({ initial, onClose, onSaved }: { initial: Shelf | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [sponsorName, setSponsorName] = useState(initial?.sponsorName || '')
  const [startDate, setStartDate] = useState(initial?.startDate ? dayInput(initial.startDate) : '')
  const [endDate, setEndDate] = useState(initial?.endDate ? dayInput(initial.endDate) : '')
  const [items, setItems] = useState<Array<{ product: SponsoredShelfProduct; hiddenReason: string | null }>>(initial?.items || [])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SponsoredShelfProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true)
        const res = await productsAPI.getAdmin({ page: 1, limit: 8, search: q })
        const list = ((res.data as { data?: Array<{ id: string; name: string; ean: string; price?: number }> })?.data || [])
        setResults(list.map((p) => ({ id: p.id, name: p.name, ean: p.ean, price: p.price })))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const available = useMemo(() => results.filter((p) => !items.some((i) => i.product.id === p.id)), [results, items])
  const datesOk = !startDate || !endDate || startDate <= endDate
  const endsInPast = Boolean(endDate) && endDate < todayInput()
  const problems = [!title.trim() && 'título', items.length === 0 && 'pelo menos um produto', !datesOk && 'fim depois do início'].filter(Boolean) as string[]

  const move = (index: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })

  const save = async () => {
    if (problems.length) return
    setSaving(true)
    setError('')
    const payload = {
      title: title.trim(),
      sponsorName: sponsorName.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      productIds: items.map((i) => i.product.id),
    }
    try {
      if (initial) await sponsoredShelvesAdminAPI.update(initial.id, payload)
      else await sponsoredShelvesAdminAPI.create({ ...payload, active: true })
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar a vitrine.'))
    } finally {
      setSaving(false)
    }
  }

  const field = 'h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400'

  return (
    <WorkspaceDialog
      label={initial ? `Vitrine ${initial.title}` : 'Nova vitrine patrocinada'}
      size="lg"
      onClose={onClose}
      closeOnEsc={!saving}
      title={<h3 className="text-base font-semibold text-gray-900">{initial ? initial.title : 'Nova vitrine patrocinada'}</h3>}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-gray-500">{error ? <span className="text-rose-700">{error}</span> : problems.length ? `Falta: ${problems.join(', ')}.` : ''}</p>
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving || problems.length > 0} className="rounded-xl bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-40">
            {saving ? 'Salvando…' : initial ? 'Salvar alterações' : 'Criar vitrine'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:gap-10">
        <div className="space-y-5">
          <label className="block">
            <span className="block text-xs font-medium text-gray-700">Título</span>
            <span className="block text-xs text-gray-400">O nome da vitrine na página inicial.</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Semana Nestlé" className={`${field} mt-1`} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-700">Fornecedor (opcional)</span>
            <span className="block text-xs text-gray-400">Aparece como “Parceria …” acima do título.</span>
            <input value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} placeholder="Ex.: Nestlé" className={`${field} mt-1`} />
          </label>
          <div>
            <span className="block text-xs font-medium text-gray-700">Vigência (opcional)</span>
            <span className="block text-xs text-gray-400">Cada dia vale inteiro, no horário de Brasília. Sem data: fica no ar até você pausar.</span>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <label className="block text-xs text-gray-500">
                Começa em
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${field} mt-1`} />
              </label>
              <label className="block text-xs text-gray-500">
                Vai até
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${field} mt-1`} />
              </label>
            </div>
            {endsInPast && <p className="mt-1 text-xs text-amber-700">A data final já passou: a vitrine não vai aparecer.</p>}
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Como aparece na loja</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{sponsorName.trim() ? `Parceria ${sponsorName.trim()}` : 'Vitrine patrocinada'}</p>
            <p className="text-sm font-semibold text-gray-900">{title.trim() || 'Título da vitrine'}</p>
            <p className="mt-1 text-xs text-gray-500">
              Logo depois dos encartes, antes das vitrines do dia. Produto sem estoque, oculto ou de tabacaria não aparece.
            </p>
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-gray-700">Produtos, na ordem da vitrine</span>
          <div className="relative mt-1">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pelo nome ou código de barras" className={`${field} pl-9`} />
          </div>
          {searching && <p className="mt-1 text-xs text-gray-400">Buscando…</p>}
          {available.length > 0 && (
            <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-black/[0.08]">
              {available.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setItems((prev) => [...prev, { product: p, hiddenReason: null }])
                      setQuery('')
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">{p.ean}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ol className="mt-3 space-y-1.5">
            {items.length === 0 ? (
              <li className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">Nenhum produto ainda.</li>
            ) : (
              items.map((i, index) => (
                <li key={i.product.id} className="flex items-center gap-2 rounded-xl border border-black/[0.06] px-3 py-2 text-sm">
                  <span className="w-5 shrink-0 text-xs tabular-nums text-gray-400">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-gray-900">{i.product.name}</span>
                    {i.hiddenReason && <span className="block text-xs text-amber-700">Não aparece: {i.hiddenReason.toLowerCase()}</span>}
                  </span>
                  <IconBtn label="Subir" disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp size={14} />
                  </IconBtn>
                  <IconBtn label="Descer" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown size={14} />
                  </IconBtn>
                  <IconBtn label="Tirar" danger onClick={() => setItems((prev) => prev.filter((x) => x.product.id !== i.product.id))}>
                    <X size={14} />
                  </IconBtn>
                </li>
              ))
            )}
          </ol>
        </div>
      </div>
    </WorkspaceDialog>
  )
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-2 disabled:opacity-30 ${danger ? 'text-gray-400 hover:bg-rose-50 hover:text-rose-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
    >
      {children}
    </button>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
    </div>
  )
}
