import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Download, ExternalLink, Search } from 'lucide-react'
import { productsAPI, getApiErrorMessage, type ProductTurnoverReport, type ProductTurnoverRow } from '../../services/api'

// Giro de produto (16/10/2026): o que já vendeu, quanto e há quanto tempo não
// vende -- decisão de o que empurrar ou tirar do mix. So conta pedido valido e
// item realmente separado (ver getTurnoverReport no backend). Mesmo estilo da
// tela Clientes (segmentos trocados por ordenacao, numeros calculados no
// servidor, exportar em CSV).

type Sort = 'revenue' | 'units' | 'leastUnits' | 'stale' | 'name'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const DAY = 86_400_000
function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
  if (d <= 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  if (d < 365) return `há ${Math.floor(d / 30)} ${Math.floor(d / 30) === 1 ? 'mês' : 'meses'}`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function ProductTurnoverSection({ onOpenProduct }: { onOpenProduct: (query: string) => void }) {
  const [report, setReport] = useState<ProductTurnoverReport | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('revenue')
  const [onlyOffSite, setOnlyOffSite] = useState(false)

  const load = useCallback(async () => {
    try {
      setReport((await productsAPI.turnoverReport()).data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar o giro de produto.'))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const list = useMemo(() => {
    const q = fold(search.trim())
    const rows = (report?.data || [])
      .filter((p) => !q || fold(p.name).includes(q) || p.ean === search.trim() || String(p.erpProductId) === search.trim())
      .filter((p) => !onlyOffSite || !p.onSite)
    return [...rows].sort((a, b) =>
      sort === 'units'
        ? b.unitsSold - a.unitsSold
        : sort === 'leastUnits'
          ? a.unitsSold - b.unitsSold
          : sort === 'stale'
            ? new Date(a.lastSoldAt).getTime() - new Date(b.lastSoldAt).getTime()
            : sort === 'name'
              ? a.name.localeCompare(b.name, 'pt-BR')
              : b.revenue - a.revenue,
    )
  }, [report, search, sort, onlyOffSite])

  const totals = useMemo(() => {
    const revenue = list.reduce((a, p) => a + p.revenue, 0)
    const units = list.reduce((a, p) => a + p.unitsSold, 0)
    return { revenue, units }
  }, [list])

  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      ['Produto', 'EAN', 'Código ERP', 'Categoria', 'Unidades vendidas', 'Pedidos', 'Receita', 'Última venda', 'No site'].map(cell).join(';'),
      ...list.map((p) =>
        [p.name, p.ean, p.erpProductId, p.category, num(p.unitsSold), p.ordersCount, p.revenue.toFixed(2).replace('.', ','), new Date(p.lastSoldAt).toLocaleDateString('pt-BR'), p.onSite ? 'sim' : 'não']
          .map(cell)
          .join(';'),
      ),
    ]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    a.download = `giro-de-produto-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {report && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-sm text-gray-600">
          <span>
            <span className="tabular-nums text-gray-900">{report.soldProductsCount}</span> produtos já venderam{' '}
            <span className="text-gray-400">de {report.sellableCatalogCount} no site</span>
          </span>
          <span>
            <span className="tabular-nums text-gray-900">{num(totals.units)}</span> unidades no filtro atual
          </span>
          <span>
            receita no filtro atual <span className="tabular-nums text-gray-900">{brl(totals.revenue)}</span>
          </span>
        </div>
      )}
      <p className="text-xs text-gray-500">Só conta pedido que não foi cancelado e item realmente separado. Ajuda a decidir o que empurrar ou tirar do mix -- não é o estoque do ERP.</p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, EAN ou código ERP" className="h-10 w-full rounded-xl border border-black/[0.06] bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-400" />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-gray-700">
          <option value="revenue">Mais receita</option>
          <option value="units">Mais vendido</option>
          <option value="leastUnits">Menos vendido</option>
          <option value="stale">Não vende há mais tempo</option>
          <option value="name">Nome</option>
        </select>
        <button
          type="button"
          onClick={() => setOnlyOffSite((v) => !v)}
          aria-pressed={onlyOffSite}
          className={`h-10 rounded-xl border px-3 text-sm ${onlyOffSite ? 'border-gray-900 bg-gray-900 text-white' : 'border-black/[0.06] bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          Só fora do site
        </button>
        <button type="button" onClick={exportCsv} disabled={!list.length} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
          <Download size={14} /> Exportar
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {!report ? (
        !error && <div className="h-64 animate-pulse rounded-2xl bg-white/70" />
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center text-sm text-gray-400">Nenhum produto aqui.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          <div className="hidden grid-cols-[minmax(0,1fr)_90px_90px_110px_110px_90px] gap-4 border-b border-black/[0.05] px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 md:grid">
            <span>Produto</span>
            <span className="text-right">Unidades</span>
            <span className="text-right">Pedidos</span>
            <span className="text-right">Receita</span>
            <span>Última venda</span>
            <span className="text-center">No site</span>
          </div>
          <ul className="divide-y divide-black/[0.05]">
            {list.map((p) => (
              <ProductRow key={p.productId} p={p} onOpenProduct={onOpenProduct} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ProductRow({ p, onOpenProduct }: { p: ProductTurnoverRow; onOpenProduct: (query: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenProduct(p.ean || String(p.erpProductId ?? p.name))}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-gray-50/70 md:grid-cols-[minmax(0,1fr)_90px_90px_110px_110px_90px]"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 truncate text-sm text-gray-900">
            {p.name}
            <ExternalLink size={12} className="shrink-0 text-gray-300" />
          </span>
          <span className="block truncate text-xs text-gray-500">{p.category || 'Sem categoria'}</span>
        </span>
        <span className="text-right text-sm tabular-nums text-gray-900 md:block">
          {num(p.unitsSold)}
          <span className="text-xs text-gray-400 md:hidden"> un.</span>
        </span>
        <span className="hidden text-right text-sm tabular-nums text-gray-900 md:block">{p.ordersCount}</span>
        <span className="col-span-2 text-xs text-gray-500 md:col-span-1 md:text-right md:text-sm md:text-gray-900">
          <span className="tabular-nums">{brl(p.revenue)}</span>
          <span className="md:hidden"> · {ago(p.lastSoldAt)}</span>
        </span>
        <span className="hidden text-sm text-gray-600 md:block">{ago(p.lastSoldAt)}</span>
        <span className="hidden justify-center md:flex">
          <span className={`h-1.5 w-1.5 rounded-full ${p.onSite ? 'bg-emerald-600' : 'bg-gray-300'}`} aria-label={p.onSite ? 'No site' : 'Fora do site'} />
        </span>
      </button>
    </li>
  )
}
