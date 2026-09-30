import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ImageOff, Pencil, Trash2 } from 'lucide-react'
import { resolveApiUrl } from '../services/api'
import type { StoreBanner } from '../utils/bannerTemplates'
import type { BannerSlot } from '../utils/bannerRules'
import { bannerStatus, checkDestination, type Check, type HealthContext, type Tone } from '../utils/bannerHealth'

// Banners (refeita em 30/09/2026): agrupados na ordem em que aparecem na loja,
// cada um com a situacao real (no ar, agendado, esperando encarte, nao
// aparece), para onde o clique leva -- conferido contra a loja -- e quanto
// foi visto e clicado.

const GROUPS: Array<{ slot: BannerSlot; title: string; hint: string }> = [
  { slot: 'hero', title: 'Topo da página inicial', hint: 'Carrossel grande logo abaixo do cabeçalho.' },
  { slot: 'intercalado', title: 'Entre as vitrines', hint: 'Em pares, no meio das vitrines da página inicial.' },
  { slot: 'tarja', title: 'Tarja', hint: 'Faixa fina no alto da página inicial. Sai só uma: a primeira no ar.' },
  { slot: 'popup', title: 'Pop-up', hint: 'Abre ao entrar na página inicial. Sai só um: o primeiro no ar.' },
  { slot: 'category', title: 'Páginas de departamento', hint: 'No alto da página do departamento escolhido.' },
]

const DOT: Record<Tone, string> = { ok: 'bg-emerald-600', warn: 'bg-amber-500', info: 'bg-sky-500', off: 'bg-gray-300' }
const pct = (clicks: number, views: number) => (views ? `${((clicks / views) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—')

type Props = {
  items: StoreBanner[]
  ctx: HealthContext | null
  busyId: string | null
  onEdit: (b: StoreBanner) => void
  onToggle: (b: StoreBanner) => void
  onMove: (b: StoreBanner, direction: 'up' | 'down') => void
  onDelete: (b: StoreBanner) => void
}

export function BannerBoard({ items, ctx, busyId, onEdit, onToggle, onMove, onDelete }: Props) {
  const [dest, setDest] = useState<Record<string, Check>>({})

  useEffect(() => {
    if (!ctx) return
    let alive = true
    Promise.all(items.map(async (b) => [b.id, await checkDestination(b, ctx)] as const)).then((pairs) => {
      if (alive) setDest(Object.fromEntries(pairs))
    })
    return () => {
      alive = false
    }
  }, [items, ctx])

  const status = useMemo(() => Object.fromEntries(items.map((b) => [b.id, ctx ? bannerStatus(b, ctx) : null])), [items, ctx])
  const attention = items.filter((b) => b.active && (status[b.id]?.tone === 'warn' || (status[b.id]?.live && dest[b.id]?.tone === 'warn')))
  const live = items.filter((b) => status[b.id]?.live)
  const views = live.reduce((a, b) => a + b.impressionsCount, 0)
  const clicks = live.reduce((a, b) => a + b.clicksCount, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="No ar agora" value={`${live.length} de ${items.length}`} hint="os outros estão desligados, agendados ou esperando encarte" />
        <Stat label="Taxa de clique dos que estão no ar" value={pct(clicks, views)} hint={`${clicks} cliques em ${views.toLocaleString('pt-BR')} exibições, desde que cada um foi criado`} />
        <Stat
          label="Precisa de atenção"
          value={String(attention.length)}
          hint={attention.length ? 'banner no ar levando a página vazia, ou marcado para não aparecer' : 'todos levam a páginas com conteúdo'}
        />
      </div>

      {attention.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-amber-800">Precisa de atenção</h3>
          <ul className="mt-2 space-y-1.5">
            {attention.map((b) => (
              <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-gray-900">{b.title || b.name}</span>
                  <span className="text-gray-600"> · {status[b.id]?.tone === 'warn' ? status[b.id]?.text : dest[b.id]?.text}</span>
                </span>
                <button type="button" onClick={() => onEdit(b)} className="text-xs text-gray-700 underline">
                  Corrigir
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {GROUPS.map((g) => {
        const list = items.filter((b) => b.slot === g.slot).sort((a, b) => a.order - b.order)
        return (
          <section key={g.slot} className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
            <div className="border-b border-black/[0.05] px-4 py-3">
              <h3 className="text-sm font-medium text-gray-900">
                {g.title} <span className="text-xs font-normal text-gray-400">· {list.filter((b) => status[b.id]?.live).length} no ar</span>
              </h3>
              <p className="text-xs text-gray-500">{g.hint}</p>
            </div>
            {list.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">Nenhum banner aqui.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {list.map((b, i) => (
                  <Row
                    key={b.id}
                    b={b}
                    status={status[b.id]}
                    dest={dest[b.id]}
                    first={i === 0}
                    last={i === list.length - 1}
                    busy={busyId === b.id}
                    onEdit={() => onEdit(b)}
                    onToggle={() => onToggle(b)}
                    onMove={(d) => onMove(b, d)}
                    onDelete={() => onDelete(b)}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Row({
  b,
  status,
  dest,
  first,
  last,
  busy,
  onEdit,
  onToggle,
  onMove,
  onDelete,
}: {
  b: StoreBanner
  status: (Check & { live: boolean }) | null
  dest?: Check
  first: boolean
  last: boolean
  busy: boolean
  onEdit: () => void
  onToggle: () => void
  onMove: (d: 'up' | 'down') => void
  onDelete: () => void
}) {
  const img = b.mobileImageUrl || b.desktopImageUrl
  const newCounter = (b.slot === 'tarja' || b.slot === 'popup') && b.impressionsCount === 0
  return (
    <li className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
      <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {img ? <img src={resolveApiUrl(img)} alt="" className={`h-full w-full object-cover ${status?.live ? '' : 'opacity-50 grayscale'}`} /> : <ImageOff size={16} className="m-auto mt-5 text-gray-300" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900">{b.title || b.name}</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[status?.tone || 'off']}`} />
            <span className="truncate">{status?.text || '…'}</span>
          </span>
          <span className={`block truncate text-xs ${dest?.tone === 'warn' ? 'text-amber-700' : 'text-gray-500'}`}>
            Leva para: {dest ? dest.text : 'conferindo…'}
            {b.sponsorName ? ` · patrocínio ${b.sponsorName}` : ''}
          </span>
        </span>
      </button>
      <span className="text-xs tabular-nums text-gray-600 md:w-48 md:text-right">
        {newCounter ? (
          <>{b.clicksCount} cliques · exibições contadas a partir de 30/09</>
        ) : (
          <>
            {b.impressionsCount.toLocaleString('pt-BR')} exibições · {b.clicksCount} cliques · {pct(b.clicksCount, b.impressionsCount)}
          </>
        )}
      </span>
      <span className="flex items-center gap-1">
        <IconBtn label="Subir" disabled={first || busy} onClick={() => onMove('up')}>
          <ArrowUp size={15} />
        </IconBtn>
        <IconBtn label="Descer" disabled={last || busy} onClick={() => onMove('down')}>
          <ArrowDown size={15} />
        </IconBtn>
        <button
          type="button"
          role="switch"
          aria-checked={b.active}
          aria-label={`${b.title || b.name}: ${b.active ? 'ligado' : 'desligado'}`}
          disabled={busy}
          onClick={onToggle}
          className={`relative mx-1 h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50 ${b.active ? 'bg-gray-900' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${b.active ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
        <IconBtn label="Editar" onClick={onEdit}>
          <Pencil size={15} />
        </IconBtn>
        <IconBtn label="Remover" onClick={onDelete} danger>
          <Trash2 size={15} />
        </IconBtn>
      </span>
    </li>
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

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
    </div>
  )
}
