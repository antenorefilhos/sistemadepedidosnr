import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink, ImageOff, Loader2, RefreshCw, Search, Trash2, UploadCloud, X } from 'lucide-react'
import {
  getApiErrorMessage,
  productsAPI,
  resolveApiUrl,
  type CatalogProduct,
  type CatalogResponse,
  type CatalogTab,
} from '../../services/api'

// Produtos (refeita em 29/09/2026 com o Jonathan). O ERP (AntenorApi) e a fonte
// de preco, estoque e cadastro -- o que se edita aqui e como o produto aparece
// no site: ocultar / sempre a venda, categoria, nome, fotos, etiqueta e video.
// Esses ajustes ficam gravados a parte e o sync respeita (ver
// applySiteVisibility no backend). Sairam a edicao de preco/estoque na lista, o
// ativar/excluir em lote e o "novo produto": o sync desfazia tudo isso.

const TABS: Array<{ key: CatalogTab; label: string; hint: string }> = [
  { key: 'site', label: 'No site', hint: 'O que o cliente encontra agora.' },
  { key: 'noPhoto', label: 'Sem foto', hint: 'No site, mas sem foto: aparece com a imagem padrão.' },
  { key: 'promo', label: 'Em promoção', hint: 'Promoção vigente vinda do ERP.' },
  { key: 'offSite', label: 'Fora do site', hint: 'Ativos no ERP que o cliente não vê. O motivo está em cada produto.' },
  { key: 'adjusted', label: 'Ajustados', hint: 'Produtos com algum ajuste feito aqui (visibilidade, categoria ou nome). O sync respeita.' },
  { key: 'inactive', label: 'Inativos no ERP', hint: 'Fora do mix da loja. Para voltar, reative no cadastro do ERP.' },
  { key: 'all', label: 'Todos', hint: 'Catálogo inteiro vindo do ERP.' },
]

const PAGE_SIZE = 50
const BADGES = ['Mais Vendido', 'Importado', 'Premium', 'Luxo', 'Exclusivo', 'Especialidade']
const SYNC_LABEL: Record<string, string> = { SEMPRE: 'Sempre', ESTOQUE: 'Só com estoque', ESTQOUE: 'Só com estoque', NUNCA: 'Nunca' }

const brl = (v?: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const num = (v: number) => v.toLocaleString('pt-BR')
const qty = (v?: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 3 }))
const slugify = (v: string) =>
  v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

function ago(iso?: string | null) {
  if (!iso) return null
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  if (min < 1440) return `há ${Math.floor(min / 60)} h`
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const isAdjusted = (p: CatalogProduct) => Boolean(p.siteVisibility || p.categoryOverrideId || p.titleMask)
const hasPromo = (p: CatalogProduct) => p.promotionalPrice != null && p.promotionalPrice > 0 && p.promotionalPrice < p.price

function Status({ p }: { p: CatalogProduct }) {
  const dot = { ON: 'bg-emerald-600', OFF: 'bg-amber-500', HIDDEN: 'bg-gray-900', INACTIVE: 'bg-gray-300' }[p.status]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {p.status === 'ON' ? (p.siteVisibility === 'SEMPRE' ? 'No site · sempre à venda' : 'No site') : p.reason}
    </span>
  )
}

function Thumb({ p, size = 40 }: { p: CatalogProduct; size?: number }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50" style={{ width: size, height: size }}>
      {p.hasPhoto && !failed ? (
        <img src={resolveApiUrl(`/thumbs/products/${p.ean}.webp`)} alt="" loading="lazy" className="h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <ImageOff size={size / 2.8} className="text-gray-300" />
      )}
    </span>
  )
}

function Price({ p }: { p: CatalogProduct }) {
  const unit = p.isFractional ? `/${(p.unit || 'kg').toLowerCase()}` : ''
  return hasPromo(p) ? (
    <span className="tabular-nums">
      <span className="text-gray-900">{brl(p.promotionalPrice)}</span>
      <span className="ml-1 text-xs text-gray-400 line-through">{brl(p.price)}</span>
      <span className="text-xs text-gray-400">{unit}</span>
    </span>
  ) : (
    <span className="tabular-nums text-gray-900">
      {brl(p.price)}
      <span className="text-xs text-gray-400">{unit}</span>
    </span>
  )
}

export default function ProductsSection() {
  // Aba e departamento podem vir da tela Departamentos (?tab=&category=).
  const [params] = useSearchParams()
  const [tab, setTab] = useState<CatalogTab>(() => (TABS.some((t) => t.key === params.get('tab')) ? (params.get('tab') as CatalogTab) : 'site'))
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(() => params.get('category') || '')
  const [page, setPage] = useState(1)
  const [res, setRes] = useState<CatalogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<CatalogProduct | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const reqId = useRef(0)

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const r = await productsAPI.catalog({ tab, search: query || undefined, category: category || undefined, page, limit: PAGE_SIZE })
      if (id !== reqId.current) return
      setRes(r.data)
      setSyncing(r.data.sync.job.running)
      setError('')
    } catch (e) {
      if (id === reqId.current) setError(getApiErrorMessage(e, 'Não foi possível carregar os produtos.'))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [tab, query, category, page])

  useEffect(() => {
    load()
  }, [load])

  // Busca enquanto digita, com uma pausa curta.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Sync manual: acompanha o job no servidor ate terminar e recarrega.
  useEffect(() => {
    if (!syncing) return
    const t = setInterval(async () => {
      try {
        const s = await productsAPI.syncStatus()
        if (!s.data.running) {
          setSyncing(false)
          if (s.data.lastError) setError(`O sync falhou: ${s.data.lastError}`)
          load()
        }
      } catch {
        /* tenta de novo no proximo ciclo */
      }
    }, 5000)
    return () => clearInterval(t)
  }, [syncing, load])

  const startSync = async () => {
    setError('')
    try {
      await productsAPI.syncBackground()
      setSyncing(true)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível iniciar o sync.'))
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const r = await productsAPI.catalog({ tab, search: query || undefined, category: category || undefined, page: 1, limit: 20000 })
      const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const money = (v?: number | null) => (v == null ? '' : v.toFixed(2).replace('.', ','))
      const lines = [
        ['Código ERP', 'EAN', 'Nome no site', 'Categoria', 'Preço', 'Promoção', 'Estoque', 'Situação', 'Foto'].map(cell).join(';'),
        ...r.data.data.map((p) =>
          [
            p.erpProductId,
            p.ean,
            p.displayName,
            p.categoryName,
            money(p.price),
            hasPromo(p) ? money(p.promotionalPrice) : '',
            qty(p.stock),
            p.status === 'ON' ? 'No site' : p.reason,
            p.hasPhoto ? 'sim' : 'não',
          ]
            .map(cell)
            .join(';'),
        ),
      ]
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `produtos-${TABS.find((t) => t.key === tab)?.label.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível exportar.'))
    } finally {
      setExporting(false)
    }
  }

  const counts = res?.counts
  const total = res?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const full = res?.sync.lastFull
  const recent = res?.sync.lastRecent

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Sync com o ERP */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
        <div className="min-w-0 flex-1 text-sm text-gray-600">
          {syncing ? (
            <span className="inline-flex items-center gap-2 text-gray-900">
              <Loader2 size={14} className="animate-spin" /> Sincronizando o catálogo com o ERP… leva cerca de 3 minutos.
            </span>
          ) : (
            <>
              <span className="text-gray-900">Catálogo do ERP</span>
              {full && (
                <span>
                  {' '}· atualização completa {ago(full.at)}
                  {full.synced != null && ` (${num(full.synced)} produtos${full.errors ? `, ${full.errors} com erro` : ''})`}
                </span>
              )}
              {recent && <span> · alterações conferidas {ago(recent.at)}</span>}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={startSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-40"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Sincronizar agora
        </button>
      </div>

      {/* Abas */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-2xl border border-black/[0.06] bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key)
                setPage(1)
              }}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm ${tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t.label}
              {counts && <span className={`ml-1.5 tabular-nums ${tab === t.key ? 'text-white/60' : 'text-gray-400'}`}>{num(counts[t.key])}</span>}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500">{TABS.find((t) => t.key === tab)?.hint}</p>

      {/* Busca e filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, código de barras ou código ERP"
            className="h-10 w-full rounded-xl border border-black/[0.06] bg-white pl-9 pr-9 text-sm outline-none focus:border-gray-400"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={15} />
            </button>
          )}
        </label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setPage(1)
          }}
          className="h-10 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-gray-700"
        >
          <option value="">Todas as categorias</option>
          {res?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || total === 0}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Exportar
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {/* Lista */}
      {!res && loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-white/70" />
      ) : res && res.data.length === 0 ? (
        <p className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center text-sm text-gray-400">Nenhum produto aqui.</p>
      ) : (
        res && (
          <div className={`overflow-hidden rounded-2xl border border-black/[0.06] bg-white transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className="hidden grid-cols-[minmax(0,1fr)_170px_130px_90px_190px] gap-4 border-b border-black/[0.05] px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 md:grid">
              <span>Produto</span>
              <span>Categoria no site</span>
              <span className="text-right">Preço</span>
              <span className="text-right">Estoque</span>
              <span>Situação</span>
            </div>
            <ul className="divide-y divide-black/[0.05]">
              {res.data.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(p)}
                    className="grid w-full grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-4 py-2.5 text-left hover:bg-gray-50/70 md:grid-cols-[minmax(0,1fr)_170px_130px_90px_190px]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Thumb p={p} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-gray-900">{p.displayName}</span>
                        <span className="block truncate text-xs text-gray-400">
                          {p.erpProductId ? `ERP ${p.erpProductId} · ` : ''}
                          {p.ean}
                          {isAdjusted(p) && <span className="text-gray-500"> · ajustado</span>}
                        </span>
                        {/* celular: o resto em duas linhas curtas */}
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm md:hidden">
                          <Price p={p} />
                          <span className="text-xs text-gray-500">{p.categoryName || 'sem categoria'}</span>
                        </span>
                        <span className="mt-0.5 block md:hidden">
                          <Status p={p} />
                        </span>
                      </span>
                    </span>
                    <span className="hidden truncate text-sm text-gray-600 md:block">{p.categoryName || <span className="text-gray-400">—</span>}</span>
                    <span className="hidden text-right text-sm md:block">
                      <Price p={p} />
                    </span>
                    <span className="hidden text-right text-sm tabular-nums text-gray-600 md:block">{qty(p.stock)}</span>
                    <span className="hidden md:block">
                      <Status p={p} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-black/[0.05] px-4 py-2.5 text-xs text-gray-500">
              <span className="tabular-nums">
                {num((page - 1) * PAGE_SIZE + 1)}–{num(Math.min(page * PAGE_SIZE, total))} de {num(total)}
              </span>
              <span className="flex gap-1">
                <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </span>
            </div>
          </div>
        )
      )}

      {open && (
        <ProductPanel
          product={open}
          categories={res?.categories || []}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function Field({ label, children, source }: { label: string; children: React.ReactNode; source?: string }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-2 text-xs text-gray-500">
        <span>{label}</span>
        {source && <span className="text-[11px] text-gray-400">{source}</span>}
      </div>
      <div className="mt-0.5 break-words text-sm text-gray-900">{children || <span className="text-gray-400">não informado</span>}</div>
    </div>
  )
}

function Photo({ ean, slot, name }: { ean: string; slot: '1' | '2'; name: string }) {
  const [version, setVersion] = useState(Date.now())
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const file = slot === '2' ? `${ean}_2` : ean

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    setErr('')
    try {
      await productsAPI.uploadImage(ean, f, slot)
      setMissing(false)
      setVersion(Date.now())
    } catch (error) {
      setErr(getApiErrorMessage(error, 'Não foi possível enviar a foto.'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Apagar esta foto?')) return
    setBusy(true)
    setErr('')
    try {
      await productsAPI.deleteImage(ean, slot)
      setMissing(true)
    } catch (error) {
      setErr(getApiErrorMessage(error, 'Não foi possível apagar a foto.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-black/[0.06] bg-gray-50">
        {!missing ? (
          <img src={resolveApiUrl(`/uploads/products/${file}.webp?v=${version}`)} alt={`${name} — foto ${slot}`} className="h-full w-full object-contain p-1" onError={() => setMissing(true)} />
        ) : (
          <ImageOff size={22} className="text-gray-300" />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 size={18} className="animate-spin text-gray-600" />
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1 text-xs">
        <span className="text-gray-500">{slot === '1' ? 'Principal' : 'Segunda foto'}</span>
        <span className="flex gap-1">
          <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-gray-800 hover:bg-gray-100 ${busy ? 'pointer-events-none opacity-40' : ''}`}>
            <UploadCloud size={13} /> {missing ? 'Enviar' : 'Trocar'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} aria-label={`Enviar foto ${slot}`} />
          </label>
          {!missing && (
            <button type="button" onClick={remove} disabled={busy} aria-label={`Apagar foto ${slot}`} className="rounded-lg px-1.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-rose-700">
              <Trash2 size={13} />
            </button>
          )}
        </span>
      </div>
      {err && <p className="mt-1 text-xs text-rose-700">{err}</p>}
    </div>
  )
}

type Visibility = 'ERP' | 'SEMPRE' | 'OCULTO'

function ProductPanel({
  product: p,
  categories,
  onClose,
  onSaved,
}: {
  product: CatalogProduct
  categories: Array<{ id: string; name: string }>
  onClose: () => void
  onSaved: () => void
}) {
  const initial = {
    visibility: (p.siteVisibility || 'ERP') as Visibility,
    categoryId: p.categoryOverrideId || '',
    displayName: p.titleMask || '',
    badges: p.badges || '',
    videoUrl: p.videoUrl || '',
    manualIsFractional: Boolean(p.manualIsFractional),
    manualFractionStep: p.manualFractionStep != null ? String(p.manualFractionStep) : '',
  }
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const erpSync = p.erpSyncOption || p.syncOption
  const erpCategory = p.categoryOverrideId ? null : p.categoryName
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const fractionInvalid = form.manualIsFractional && !(Number(form.manualFractionStep.replace(',', '.')) > 0)

  const visibilityEffect: Record<Visibility, string> = {
    ERP: `Segue o ERP (${SYNC_LABEL[erpSync] ?? erpSync}${erpSync.startsWith('ESTQ') || erpSync === 'ESTOQUE' ? `, estoque ${qty(p.stock)}` : ''}).`,
    SEMPRE: p.erpActive ? 'Fica à venda mesmo sem estoque no ERP. Se faltar, o separador troca ou avisa o cliente.' : 'Inativo no ERP: continua fora até ser reativado lá (o PDV não fatura produto inativo).',
    OCULTO: 'Some do site, da busca e das vitrines na hora, mesmo ativo e com estoque no ERP.',
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const site: { visibility?: Visibility; categoryId?: string | null; displayName?: string | null } = {}
      if (form.visibility !== initial.visibility) site.visibility = form.visibility
      if (form.categoryId !== initial.categoryId) site.categoryId = form.categoryId || null
      if (form.displayName.trim() !== initial.displayName) site.displayName = form.displayName.trim() || null
      if (Object.keys(site).length) await productsAPI.updateSite(p.id, site)

      const rest: Record<string, unknown> = {}
      if (form.badges !== initial.badges) rest.badges = form.badges || null
      if (form.videoUrl.trim() !== initial.videoUrl) rest.videoUrl = form.videoUrl.trim() || null
      if (form.manualIsFractional !== initial.manualIsFractional || form.manualFractionStep !== initial.manualFractionStep) {
        rest.manualIsFractional = form.manualIsFractional || null
        rest.manualFractionStep = form.manualIsFractional ? Number(form.manualFractionStep.replace(',', '.')) : null
      }
      if (Object.keys(rest).length) await productsAPI.update(p.id, rest)
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const tree = [p.classification01, p.classification02, p.classification03, p.classification04]
    .filter(Boolean)
    .map((v) => String(v).replace(/^\d+\s*-\s*/, '').replace(/_/g, ' '))
    .join(' › ')

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-end bg-black/30 sm:items-stretch" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white sm:max-h-none sm:max-w-xl sm:rounded-none"
        role="dialog"
        aria-label={p.displayName}
      >
        <header className="flex items-start gap-3 border-b border-black/[0.06] px-5 py-4">
          <Thumb p={p} size={48} />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-snug text-gray-900">{p.displayName}</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {p.erpProductId ? `ERP ${p.erpProductId} · ` : ''}EAN {p.ean}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3">
              <Status p={p} />
              {p.status === 'ON' && p.erpProductId && (
                <a
                  href={`https://mercado.antenorefilhos.com.br/p/${slugify(p.displayName)}-${p.erpProductId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-700 underline-offset-2 hover:underline"
                >
                  <ExternalLink size={12} /> Ver no site
                </a>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {/* Ajustes do site */}
          <section>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">No site</h4>
            <p className="mt-1 text-xs text-gray-500">Vale só para o site e o sync do ERP respeita.</p>

            <div className="mt-3">
              <span className="text-xs text-gray-500">Visibilidade</span>
              <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
                {(
                  [
                    ['ERP', 'Seguir o ERP'],
                    ['SEMPRE', 'Sempre à venda'],
                    ['OCULTO', 'Ocultar'],
                  ] as Array<[Visibility, string]>
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set({ visibility: v })}
                    className={`rounded-lg px-2 py-1.5 text-sm ${form.visibility === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-500">{visibilityEffect[form.visibility]}</p>
            </div>

            <label className="mt-4 block text-xs text-gray-500">
              Categoria no site
              <select
                value={form.categoryId}
                onChange={(e) => set({ categoryId: e.target.value })}
                className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900"
              >
                <option value="">Seguir o ERP{erpCategory ? ` (${erpCategory})` : ''}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-xs text-gray-500">
              Nome no site
              <input
                value={form.displayName}
                onChange={(e) => set({ displayName: e.target.value })}
                placeholder={p.name}
                className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] px-3 text-sm text-gray-900 placeholder:text-gray-400"
              />
              <span className="mt-1 block text-gray-400">Vazio usa a descrição e-commerce do ERP. Corrigir no ERP vale para todos os canais.</span>
            </label>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs text-gray-500">
                Etiqueta no card
                <select value={form.badges} onChange={(e) => set({ badges: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900">
                  <option value="">Nenhuma</option>
                  {form.badges && !BADGES.includes(form.badges) && <option value={form.badges}>{form.badges}</option>}
                  {BADGES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-gray-500">
                Vídeo (YouTube, Instagram, TikTok)
                <input
                  type="url"
                  value={form.videoUrl}
                  onChange={(e) => set({ videoUrl: e.target.value })}
                  placeholder="https://"
                  className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] px-3 text-sm text-gray-900 placeholder:text-gray-400"
                />
              </label>
            </div>

            {!p.isFractional && (
              <div className="mt-4 rounded-xl border border-black/[0.06] p-3">
                <label className="flex items-center gap-2 text-sm text-gray-900">
                  <input type="checkbox" checked={form.manualIsFractional} onChange={(e) => set({ manualIsFractional: e.target.checked, manualFractionStep: e.target.checked ? form.manualFractionStep : '' })} />
                  Vendido por peso
                </label>
                <p className="mt-1 text-xs text-gray-500">O ERP não informa fracionamento deste produto. Marque para o cliente comprar por peso.</p>
                {form.manualIsFractional && (
                  <label className="mt-2 block text-xs text-gray-500">
                    Quantidade mínima ({(p.unit || 'kg').toLowerCase()})
                    <input
                      inputMode="decimal"
                      value={form.manualFractionStep}
                      onChange={(e) => set({ manualFractionStep: e.target.value })}
                      placeholder="0,1"
                      className="mt-1 h-10 w-32 rounded-xl border border-black/[0.08] px-3 text-sm text-gray-900"
                    />
                  </label>
                )}
              </div>
            )}
          </section>

          <section>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Fotos</h4>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Photo ean={p.ean} slot="1" name={p.displayName} />
              <Photo ean={p.ean} slot="2" name={p.displayName} />
            </div>
            <p className="mt-2 text-xs text-gray-400">JPG, PNG ou WebP até 5 MB. A foto é convertida e redimensionada sozinha.</p>
          </section>

          <section>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Do ERP</h4>
            <p className="mt-1 text-xs text-gray-500">Corrija no cadastro do ERP. Entra aqui no próximo sync.</p>
            <div className="mt-1 divide-y divide-black/[0.05]">
              <Field label="Descrição e-commerce" source="usada no site">{p.name}</Field>
              <Field label="Descrição do cadastro">{p.erpDescription}</Field>
              <Field label="Descrição do caixa" source="PDV">{p.pdvDescription}</Field>
              {p.alternativeDescription && <Field label="Texto de fracionamento">{p.alternativeDescription.replace(/^Fracionamento:\s*/, '')}</Field>}
              <div className="grid grid-cols-2 gap-x-4">
                <Field label="Preço">
                  {brl(p.price)}
                  {p.isFractional ? ` / ${(p.unit || 'kg').toLowerCase()}` : ''}
                </Field>
                <Field label="Promoção">
                  {hasPromo(p)
                    ? `${brl(p.promotionalPrice)}${p.promotionalPriceValidUntil ? ` até ${new Date(p.promotionalPriceValidUntil).toLocaleDateString('pt-BR')}` : ''}`
                    : 'sem promoção'}
                </Field>
                <Field label="Estoque">
                  {qty(p.stock)} {p.unit ? p.unit.toLowerCase() : ''}
                </Field>
                <Field label="Venda na internet">{SYNC_LABEL[erpSync] ?? erpSync}</Field>
                <Field label="Situação no ERP">{p.erpActive ? 'Ativo' : 'Inativo'}</Field>
                <Field label="Fracionamento">{p.isFractional ? `a cada ${qty(p.fractionStep)} ${(p.unit || 'kg').toLowerCase()}` : 'não fracionado'}</Field>
              </div>
              <Field label="Códigos de barras">
                <span className="font-mono text-xs">{[p.ean, ...(p.secondaryEans || [])].join(' · ')}</span>
              </Field>
              <Field label="Categoria e-commerce">{p.ecommerceCategory}</Field>
              <Field label="Árvore do cadastro">{tree}</Field>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-black/[0.06] px-5 py-3">
          {error && <p className="mr-auto text-xs text-rose-700">{error}</p>}
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            {dirty ? 'Cancelar' : 'Fechar'}
          </button>
          <button type="button" disabled={!dirty || saving || fractionInvalid} onClick={save} className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </aside>
    </div>
  )
}
