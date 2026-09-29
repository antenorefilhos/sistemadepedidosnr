import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowDown, ArrowUp, Check, GripVertical, Pencil, X } from 'lucide-react'
import { cmsAPI, getApiErrorMessage, type CatalogTab, type DepartmentOverview } from '../../services/api'

// Departamentos (refeita em 29/09/2026 com o Jonathan). O site conhece 19
// departamentos fixos; o que o produto e vem do ERP (arvore v3) ou do ajuste
// "Categoria no site" na tela Produtos. Aqui: o que o cliente ve de cada
// departamento, vendas de 30 dias, e os controles que tem efeito real --
// mostrar/ocultar, ordem e nome no site. Sairam renomear a chave, criar,
// excluir, banner, limite, subcategorias e a fila de pendencias (3.639, sendo
// 3.341 de produtos que ja tinham categoria).

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = (v: number) => v.toLocaleString('pt-BR')

type Props = { onOpenProducts: (categoryId: string, tab: CatalogTab) => void }

export default function DepartmentsSection({ onOpenProducts }: Props) {
  const [rows, setRows] = useState<DepartmentOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await cmsAPI.categories.adminOverview()
      setRows(r.data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar os departamentos.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggle = async (d: DepartmentOverview) => {
    if (
      d.active &&
      !window.confirm(
        `Ocultar "${d.shortName || d.name}"?\n\nSai da barra de categorias, das vitrines e das recomendações. Quem pesquisar pelo produto continua encontrando e comprando.`,
      )
    )
      return
    setBusy(d.id)
    setError('')
    try {
      await cmsAPI.categories.update(d.id, { active: !d.active })
      setRows((prev) => prev.map((r) => (r.id === d.id ? { ...r, active: !d.active } : r)))
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível mudar a visibilidade.'))
    } finally {
      setBusy(null)
    }
  }

  const saveName = async () => {
    if (!editing) return
    const value = editing.value.trim()
    setBusy(editing.id)
    setError('')
    try {
      await cmsAPI.categories.update(editing.id, { shortName: value || null })
      setRows((prev) => prev.map((r) => (r.id === editing.id ? { ...r, shortName: value || null } : r)))
      setEditing(null)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar o nome.'))
    } finally {
      setBusy(null)
    }
  }

  // Grava a nova ordem (0..n) so de quem mudou de posicao.
  const reorder = async (next: DepartmentOverview[]) => {
    const previous = rows
    const withPriority = next.map((r, i) => ({ ...r, priority: i + 1 }))
    const changed = withPriority.filter((r) => previous.find((p) => p.id === r.id)?.priority !== r.priority)
    if (!changed.length) return
    setRows(withPriority)
    setError('')
    try {
      await Promise.all(changed.map((r) => cmsAPI.categories.update(r.id, { priority: r.priority })))
    } catch (e) {
      setRows(previous)
      setError(getApiErrorMessage(e, 'Não foi possível salvar a ordem.'))
    }
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    reorder(next)
  }

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const from = rows.findIndex((r) => r.id === dragId)
    const to = rows.findIndex((r) => r.id === targetId)
    const next = [...rows]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    reorder(next)
  }

  const visible = rows.filter((r) => r.active)
  const totals = rows.reduce(
    (acc, r) => ({ onSite: acc.onSite + (r.active ? r.onSite : 0), revenue: acc.revenue + r.revenue }),
    { onSite: 0, revenue: 0 },
  )
  const maxOnSite = Math.max(1, ...rows.map((r) => r.onSite))
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue))

  const Count = ({ d, tab, value, label }: { d: DepartmentOverview; tab: CatalogTab; value: number; label: string }) =>
    value > 0 ? (
      <button type="button" onClick={() => onOpenProducts(d.id, tab)} className="tabular-nums text-gray-900 underline-offset-2 hover:underline" title={`Ver ${label.toLowerCase()} em Produtos`}>
        {num(value)}
      </button>
    ) : (
      <span className="tabular-nums text-gray-300">0</span>
    )

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-sm text-gray-600">
        <span>
          <span className="tabular-nums text-gray-900">{visible.length}</span> de {rows.length} departamentos visíveis
        </span>
        <span>
          <span className="tabular-nums text-gray-900">{num(totals.onSite)}</span> produtos no site
        </span>
        <span>
          <span className="tabular-nums text-gray-900">{brl(totals.revenue)}</span> vendidos em 30 dias
        </span>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {loading ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white/70" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          <div className="hidden grid-cols-[28px_minmax(0,1fr)_150px_repeat(3,70px)_150px_110px] items-center gap-3 border-b border-black/[0.05] px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 lg:grid">
            <span />
            <span>Departamento · na ordem do site</span>
            <span>No site</span>
            <span className="text-right">Fora</span>
            <span className="text-right">Sem foto</span>
            <span className="text-right">Promo</span>
            <span>Vendas 30 dias</span>
            <span className="text-right">No site?</span>
          </div>
          <ul className="divide-y divide-black/[0.05]">
            {rows.map((d, i) => (
              <li
                key={d.id}
                draggable={!editing}
                onDragStart={() => setDragId(d.id)}
                onDragEnd={() => {
                  setDragId(null)
                  setOverId(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverId(d.id)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  drop(d.id)
                  setDragId(null)
                  setOverId(null)
                }}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 lg:grid-cols-[28px_minmax(0,1fr)_150px_repeat(3,70px)_150px_110px] ${
                  overId === d.id && dragId !== d.id ? 'bg-gray-50' : ''
                } ${d.active ? '' : 'text-gray-400'}`}
              >
                <span className="hidden cursor-grab text-gray-300 lg:block" aria-hidden>
                  <GripVertical size={16} />
                </span>

                {/* Nome */}
                <div className="min-w-0">
                  {editing?.id === d.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={editing.value}
                        onChange={(e) => setEditing({ id: d.id, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveName()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        placeholder={d.name}
                        maxLength={28}
                        className="h-9 w-full max-w-[220px] rounded-lg border border-black/[0.1] px-2 text-sm text-gray-900"
                      />
                      <button type="button" onClick={saveName} disabled={busy === d.id} aria-label="Salvar nome" className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-100">
                        <Check size={16} />
                      </button>
                      <button type="button" onClick={() => setEditing(null)} aria-label="Cancelar" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setEditing({ id: d.id, value: d.shortName || '' })} className="group block max-w-full text-left" title="Mudar o nome que aparece no site">
                      <span className={`flex items-center gap-1.5 text-sm ${d.active ? 'text-gray-900' : ''}`}>
                        <span className="truncate">{d.shortName || d.name}</span>
                        <Pencil size={12} className="shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                      <span className="block truncate text-xs text-gray-400">{d.shortName && d.shortName !== d.name ? d.name : ' '}</span>
                    </button>
                  )}
                </div>

                {/* celular: visibilidade e ordem ao lado do nome */}
                <div className="flex items-center gap-1 lg:hidden">
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-25">
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" aria-label="Descer" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-25">
                    <ArrowDown size={16} />
                  </button>
                  <Switch on={d.active} disabled={busy === d.id} onClick={() => toggle(d)} label={d.shortName || d.name} />
                </div>

                {/* No site com barra */}
                <div className="col-span-2 lg:col-span-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm lg:block">
                    <span className="text-xs text-gray-500 lg:hidden">No site</span>
                    <Count d={d} tab="site" value={d.onSite} label="No site" />
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-gray-100">
                    <div className="h-1 rounded-full bg-[#5D082A]/70" style={{ width: `${(d.onSite / maxOnSite) * 100}%` }} />
                  </div>
                </div>

                {/* celular: numeros em linha */}
                <div className="col-span-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 lg:contents">
                  <span className="lg:text-right lg:text-sm">
                    <span className="lg:hidden">Fora </span>
                    <Count d={d} tab="offSite" value={d.offSite} label="Fora do site" />
                  </span>
                  <span className="lg:text-right lg:text-sm">
                    <span className="lg:hidden">Sem foto </span>
                    <Count d={d} tab="noPhoto" value={d.noPhoto} label="Sem foto" />
                  </span>
                  <span className="lg:text-right lg:text-sm">
                    <span className="lg:hidden">Promo </span>
                    <Count d={d} tab="promo" value={d.promo} label="Em promoção" />
                  </span>
                  <span className="lg:text-sm">
                    <span className="lg:hidden">30 dias </span>
                    {d.revenue > 0 ? (
                      <span className="inline-flex flex-col">
                        <span className="tabular-nums text-gray-900">
                          {brl(d.revenue)} <span className="text-xs text-gray-400">· {d.orders} ped.</span>
                        </span>
                        <span className="mt-1 hidden h-1 w-28 rounded-full bg-gray-100 lg:block">
                          <span className="block h-1 rounded-full bg-gray-400" style={{ width: `${(d.revenue / maxRevenue) * 100}%` }} />
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-300">sem vendas</span>
                    )}
                  </span>
                </div>

                <div className="hidden items-center justify-end gap-1 lg:flex">
                  <Switch on={d.active} disabled={busy === d.id} onClick={() => toggle(d)} label={d.shortName || d.name} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1 text-xs text-gray-400">
        <p>Arraste para mudar a ordem da barra de categorias (no celular, use as setas). Clique no nome para mudar como ele aparece no site.</p>
        <p>
          O departamento de cada produto vem do cadastro no ERP. Para mudar um produto de lugar, use Produtos → Categoria no site. Vendas contam pedidos não
          cancelados dos últimos 30 dias, pelo valor dos itens.
        </p>
      </div>
    </div>
  )
}

function Switch({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label}: ${on ? 'visível no site' : 'oculto'}`}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-gray-900' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )
}
