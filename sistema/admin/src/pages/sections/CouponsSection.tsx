import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2, Plus, Ticket } from 'lucide-react'
import { WorkspaceDialog } from '../../components/WorkspaceDialog'
import { couponsAdminAPI, getApiErrorMessage, notificationsAdminAPI, type CouponPromotion } from '../../services/api'

// Cupons (refeita em 29/09/2026 com o Jonathan). Defeitos corrigidos:
// - "Vale ate" ia como meia-noite UTC = 21h da VESPERA em Brasilia: a lista
//   mostrava um dia antes (parecia que a alteracao nao pegava) e o cupom vencia
//   de verdade 3 h antes do dia escolhido. Agora vale ate 23:59 do dia, em Brasilia.
// - "Primeira compra" passa a existir de verdade (antes so no nome do cupom).
// - Pedido cancelado devolve o cupom (servidor).
// Tela: situacao real de cada cupom (ativo, agendado, vencido, esgotado,
// pausado), quanto de desconto ja deu e em quantos pedidos.

type Kind = 'PERCENT_OFF' | 'FIXED_OFF' | 'FREE_SHIPPING'
type Effect = { type?: Kind; percent?: number; amount?: number; maxDiscount?: number }
type Condition = { minSubtotal?: number; firstOrderOnly?: boolean }
const TZ = 'America/Sao_Paulo'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ })
const dateTimeBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
/** 'YYYY-MM-DD' no horario de Brasilia. */
const isoDateBRT = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
/** 'YYYY-MM-DDTHH:mm' no horario de Brasilia (para o campo datetime-local). */
const isoDateTimeBRT = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}
/** Fim do dia escolhido em Brasilia (o cupom vale o dia inteiro). */
const endOfDayBRT = (date: string) => new Date(`${date}T23:59:59-03:00`).toISOString()
const fromLocalBRT = (dt: string) => new Date(`${dt}:00-03:00`).toISOString()

function describe(effect: Effect, condition: Condition) {
  const parts: string[] = []
  if (effect.type === 'FREE_SHIPPING') parts.push('Frete grátis')
  else if (effect.type === 'PERCENT_OFF') parts.push(`${effect.percent ?? 0}% de desconto${effect.maxDiscount ? ` (máx. ${brl(effect.maxDiscount)})` : ''}`)
  else parts.push(`${brl(effect.amount ?? 0)} de desconto`)
  if (condition.minSubtotal) parts.push(`a partir de ${brl(condition.minSubtotal)}`)
  if (condition.firstOrderOnly) parts.push('só na primeira compra')
  return parts.join(' · ')
}

function situation(p: CouponPromotion): { label: string; dot: string; order: number } {
  const coupon = p.coupons[0]
  const now = Date.now()
  if (p.status !== 'ACTIVE' || (coupon && coupon.status !== 'ACTIVE')) return { label: 'Pausado', dot: 'bg-gray-300', order: 3 }
  if (new Date(p.endsAt).getTime() < now) return { label: 'Vencido', dot: 'bg-gray-300', order: 4 }
  if (new Date(p.startsAt).getTime() > now) return { label: `Começa ${dateTimeBR(p.startsAt)}`, dot: 'bg-amber-500', order: 1 }
  if (coupon?.maxUses != null && (p.stats?.uses ?? 0) >= coupon.maxUses) return { label: 'Esgotado', dot: 'bg-amber-500', order: 2 }
  return { label: 'Ativo', dot: 'bg-emerald-600', order: 0 }
}

export default function CouponsSection() {
  const [list, setList] = useState<CouponPromotion[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<CouponPromotion | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setList((await couponsAdminAPI.list()).data)
      setError('')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível carregar os cupons.'))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id)
    setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível concluir.'))
    } finally {
      setBusy(null)
    }
  }

  const sorted = [...(list || [])].sort((a, b) => situation(a).order - situation(b).order || new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
  const active = sorted.filter((p) => situation(p).label === 'Ativo').length
  const totalUses = sorted.reduce((a, p) => a + (p.stats?.uses ?? 0), 0)
  const totalDiscount = sorted.reduce((a, p) => a + (p.stats?.discount ?? 0), 0)

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
        <p className="text-sm text-gray-600">
          <span className="tabular-nums text-gray-900">{active}</span> ativo(s) · usados em <span className="tabular-nums text-gray-900">{totalUses}</span> pedido(s) ·{' '}
          <span className="tabular-nums text-gray-900">{brl(totalDiscount)}</span> em descontos
        </p>
        <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-sm text-white hover:bg-gray-800">
          <Plus size={15} /> Novo cupom
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {!list ? (
        !error && <div className="h-48 animate-pulse rounded-2xl bg-white/70" />
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-10 text-center">
          <Ticket size={28} className="mx-auto text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">Nenhum cupom ainda.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_100px_120px_150px_170px] gap-4 border-b border-black/[0.05] px-4 py-2 text-[11px] uppercase tracking-wide text-gray-400 md:grid">
            <span>Cupom</span>
            <span className="text-right">Usos</span>
            <span className="text-right">Desconto dado</span>
            <span>Situação</span>
            <span />
          </div>
          <ul className="divide-y divide-black/[0.05]">
            {sorted.map((p) => {
              const coupon = p.coupons[0]
              const sit = situation(p)
              const effect = (p.rules[0]?.effect || {}) as Effect
              const condition = (p.rules[0]?.condition || {}) as Condition
              const uses = p.stats?.uses ?? 0
              const paused = sit.label === 'Pausado'
              return (
                <li key={p.id} className="grid grid-cols-1 gap-x-4 gap-y-1.5 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_100px_120px_150px_170px] md:items-center">
                  <button type="button" onClick={() => setEditing(p)} className="min-w-0 text-left">
                    <span className="block font-mono text-sm font-semibold text-gray-900">{coupon?.code}</span>
                    <span className="block truncate text-xs text-gray-500">{describe(effect, condition)}</span>
                    <span className="block truncate text-xs text-gray-400">
                      {p.name} · até {dateBR(p.endsAt)}
                      {coupon?.maxUsesPerCustomer ? ` · ${coupon.maxUsesPerCustomer}× por cliente` : ''}
                    </span>
                  </button>
                  <span className="text-xs text-gray-500 md:text-right md:text-sm md:text-gray-900">
                    <span className="md:hidden">Usos </span>
                    <span className="tabular-nums">
                      {uses}
                      {coupon?.maxUses ? ` / ${coupon.maxUses}` : ''}
                    </span>
                  </span>
                  <span className="text-xs text-gray-500 md:text-right md:text-sm md:text-gray-900">
                    <span className="md:hidden">Desconto dado </span>
                    <span className="tabular-nums">{brl(p.stats?.discount ?? 0)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sit.dot}`} />
                    {sit.label}
                  </span>
                  <span className="flex items-center gap-1 md:justify-end">
                    <button type="button" onClick={() => setEditing(p)} className="rounded-lg px-2 py-1 text-xs text-gray-700 hover:bg-gray-100">
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => act(p.id, () => couponsAdminAPI.update(p.id, { status: paused ? 'ACTIVE' : 'INACTIVE', couponStatus: paused ? 'ACTIVE' : 'INACTIVE' }))}
                      className="rounded-lg px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                    >
                      {paused ? 'Reativar' : 'Pausar'}
                    </button>
                    {uses === 0 && (
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => window.confirm(`Apagar o cupom ${coupon?.code}? Não dá para desfazer.`) && act(p.id, () => couponsAdminAPI.remove(p.id))}
                        className="rounded-lg px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                      >
                        Apagar
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <p className="text-xs text-gray-400">Cupom já usado em pedido não pode ser apagado (fica no histórico): pause em vez disso. Pedido cancelado devolve o uso do cupom.</p>

      {editing && (
        <CouponEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function CouponEditor({ initial, onClose, onSaved }: { initial: CouponPromotion | null; onClose: () => void; onSaved: () => void }) {
  const coupon = initial?.coupons[0]
  const eff = (initial?.rules[0]?.effect || {}) as Effect
  const cond = (initial?.rules[0]?.condition || {}) as Condition
  const startsInFuture = initial ? new Date(initial.startsAt).getTime() > Date.now() : false
  const [code, setCode] = useState(coupon?.code || '')
  const [kind, setKind] = useState<Kind>(eff.type || 'PERCENT_OFF')
  const [value, setValue] = useState(eff.type === 'FREE_SHIPPING' ? '' : String(eff.percent ?? eff.amount ?? ''))
  const [maxDiscount, setMaxDiscount] = useState(eff.maxDiscount != null ? String(eff.maxDiscount) : '')
  const [minSubtotal, setMinSubtotal] = useState(cond.minSubtotal != null ? String(cond.minSubtotal) : '')
  const [firstOrderOnly, setFirstOrderOnly] = useState(Boolean(cond.firstOrderOnly))
  const [maxUses, setMaxUses] = useState(coupon?.maxUses != null ? String(coupon.maxUses) : '')
  const [perCustomer, setPerCustomer] = useState(coupon?.maxUsesPerCustomer != null ? String(coupon.maxUsesPerCustomer) : '')
  const [schedule, setSchedule] = useState(startsInFuture)
  const [startsAt, setStartsAt] = useState(initial && startsInFuture ? isoDateTimeBRT(initial.startsAt) : '')
  const [endsAt, setEndsAt] = useState(initial ? isoDateBRT(initial.endsAt) : new Date(Date.now() + 30 * 86_400_000).toLocaleDateString('en-CA', { timeZone: TZ }))
  const [name, setName] = useState(initial?.name || '')
  const [notify, setNotify] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const numValue = Number(value.replace(',', '.'))
  const problems = [
    !/^[A-Z0-9]{3,20}$/.test(code) && 'código com 3 a 20 letras ou números, sem espaço',
    kind !== 'FREE_SHIPPING' && !(numValue > 0) && 'valor do desconto',
    kind === 'PERCENT_OFF' && numValue > 100 && 'porcentagem até 100%',
    !endsAt && 'data final',
    schedule && !startsAt && 'data de início',
    schedule && startsAt && endsAt && new Date(fromLocalBRT(startsAt)) >= new Date(endOfDayBRT(endsAt)) && 'data final depois do início',
    !schedule && endsAt && new Date(endOfDayBRT(endsAt)).getTime() < Date.now() && 'data final no futuro',
  ].filter(Boolean) as string[]

  const effect: Effect & { type: Kind } =
    kind === 'FREE_SHIPPING'
      ? { type: 'FREE_SHIPPING' }
      : { type: kind, ...(kind === 'PERCENT_OFF' ? { percent: numValue } : { amount: numValue }), ...(kind === 'PERCENT_OFF' && maxDiscount ? { maxDiscount: Number(maxDiscount.replace(',', '.')) } : {}) }
  const condition: Condition = { ...(minSubtotal ? { minSubtotal: Number(minSubtotal.replace(',', '.')) } : {}), ...(firstOrderOnly ? { firstOrderOnly: true } : {}) }

  const save = async () => {
    if (problems.length) return
    setSaving(true)
    setError('')
    const startIso = schedule && startsAt ? fromLocalBRT(startsAt) : initial && !startsInFuture ? initial.startsAt : new Date().toISOString()
    const payload = {
      name: name.trim() || `Cupom ${code}`,
      couponCode: code,
      effect,
      condition,
      startsAt: startIso,
      endsAt: endOfDayBRT(endsAt),
    }
    try {
      if (initial) {
        await couponsAdminAPI.update(initial.id, { ...payload, maxUses: maxUses ? Number(maxUses) : null, maxUsesPerCustomer: perCustomer ? Number(perCustomer) : null })
      } else {
        await couponsAdminAPI.create({ ...payload, maxUses: maxUses ? Number(maxUses) : undefined, maxUsesPerCustomer: perCustomer ? Number(perCustomer) : undefined, status: 'ACTIVE' })
        if (notify) {
          const desc = kind === 'FREE_SHIPPING' ? 'frete grátis' : kind === 'PERCENT_OFF' ? `${numValue}% de desconto` : `${brl(numValue)} de desconto`
          await notificationsAdminAPI.broadcast({
            type: 'CAMPAIGN',
            title: '🎁 Cupom novo para você',
            body: `Use ${code} e ganhe ${desc}${condition.minSubtotal ? ` a partir de ${brl(condition.minSubtotal)}` : ''}. Válido até ${dateBR(endOfDayBRT(endsAt))}.`,
            sendAt: schedule && new Date(startIso).getTime() > Date.now() ? startIso : undefined,
          })
        }
      }
      onSaved()
    } catch (e) {
      setError(getApiErrorMessage(e, 'Não foi possível salvar o cupom.'))
    } finally {
      setSaving(false)
    }
  }

  const field = 'h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400'
  const seg = (on: boolean) => `rounded-lg px-2 py-1.5 text-sm ${on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`

  return (
    <WorkspaceDialog
      label={initial ? `Cupom ${coupon?.code}` : 'Novo cupom'}
      size="lg"
      onClose={onClose}
      title={
        <>
          <h3 className="text-base font-semibold text-gray-900">{initial ? `Cupom ${coupon?.code}` : 'Novo cupom'}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{initial ? `Criado em ${dateBR(initial.startsAt)} · usado ${initial.stats?.uses ?? 0} vez(es)` : 'O cliente digita o código no carrinho ou no checkout.'}</p>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-gray-500">{error ? <span className="text-rose-700">{error}</span> : problems.length ? `Falta: ${problems.join(', ')}.` : ''}</p>
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving || problems.length > 0} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-40">
            {saving && <Loader2 size={14} className="animate-spin" />} {initial ? 'Salvar alterações' : 'Criar cupom'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 px-4 py-5 sm:px-6 lg:grid-cols-2 lg:gap-10">
        <div className="space-y-5">
          <label className="block">
            <span className="block text-xs font-medium text-gray-700">Código</span>
            <span className="block text-xs text-gray-400">O que o cliente digita. Fácil de lembrar, sem espaço.</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="Ex.: BEMVINDO10" className={`${field} mt-1 font-mono text-base uppercase`} />
          </label>

          <div>
            <span className="block text-xs font-medium text-gray-700">Desconto</span>
            <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
              <button type="button" onClick={() => setKind('PERCENT_OFF')} className={seg(kind === 'PERCENT_OFF')}>Porcentagem</button>
              <button type="button" onClick={() => setKind('FIXED_OFF')} className={seg(kind === 'FIXED_OFF')}>Valor (R$)</button>
              <button type="button" onClick={() => setKind('FREE_SHIPPING')} className={seg(kind === 'FREE_SHIPPING')}>Frete grátis</button>
            </div>
            {kind !== 'FREE_SHIPPING' && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500">
                  {kind === 'PERCENT_OFF' ? 'Quantos %' : 'Quantos reais'}
                  <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === 'PERCENT_OFF' ? '10' : '20,00'} className={`${field} mt-1`} />
                </label>
                {kind === 'PERCENT_OFF' && (
                  <label className="block text-xs text-gray-500">
                    Desconto máximo (R$, opcional)
                    <input inputMode="decimal" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="sem teto" className={`${field} mt-1`} />
                  </label>
                )}
              </div>
            )}
            {kind === 'FREE_SHIPPING' && <p className="mt-1.5 text-xs text-gray-500">Zera a taxa de entrega. Na retirada na loja não muda nada.</p>}
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-gray-700">Valor mínimo do carrinho (opcional)</span>
            <span className="block text-xs text-gray-400">Abaixo disso o cupom não vale e o cliente vê quanto falta.</span>
            <input inputMode="decimal" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} placeholder="sem mínimo" className={`${field} mt-1 sm:w-48`} />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-black/[0.08] p-3">
            <input type="checkbox" className="mt-0.5" checked={firstOrderOnly} onChange={(e) => setFirstOrderOnly(e.target.checked)} />
            <span>
              <span className="block text-sm text-gray-900">Só na primeira compra</span>
              <span className="block text-xs text-gray-500">Quem já tem pedido não consegue usar. Bom para cupom de boas-vindas.</span>
            </span>
          </label>
        </div>

        <div className="space-y-5">
          <div>
            <span className="block text-xs font-medium text-gray-700">Limites (opcional)</span>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <label className="block text-xs text-gray-500">
                Total de usos
                <input inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ''))} placeholder="sem limite" className={`${field} mt-1`} />
              </label>
              <label className="block text-xs text-gray-500">
                Por cliente
                <input inputMode="numeric" value={perCustomer} onChange={(e) => setPerCustomer(e.target.value.replace(/\D/g, ''))} placeholder="sem limite" className={`${field} mt-1`} />
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-400">"Total" para promoção de poucas vagas ("100 primeiros"). Pedido cancelado devolve o uso.</p>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-700">Validade</span>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
              <button type="button" onClick={() => setSchedule(false)} className={seg(!schedule)}>{initial && !startsInFuture ? 'Já está valendo' : 'Vale a partir de agora'}</button>
              <button type="button" onClick={() => setSchedule(true)} className={seg(schedule)}>Começar depois</button>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {schedule && (
                <label className="block text-xs text-gray-500">
                  Começa em (horário de Brasília)
                  <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={`${field} mt-1`} />
                </label>
              )}
              <label className="block text-xs text-gray-500">
                Vale até (o dia inteiro)
                <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={`${field} mt-1`} />
              </label>
            </div>
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-gray-700">Nome interno (opcional)</span>
            <span className="block text-xs text-gray-400">Só para você identificar. O cliente não vê.</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Boas-vindas Instagram" className={`${field} mt-1`} />
          </label>

          {!initial && (
            <label className="flex items-start gap-3 rounded-xl border border-black/[0.08] p-3">
              <input type="checkbox" className="mt-0.5" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              <span>
                <span className="block text-sm text-gray-900">Avisar os clientes no celular</span>
                <span className="block text-xs text-gray-500">{schedule ? 'O aviso sai quando o cupom começar a valer.' : 'O aviso sai assim que criar.'}</span>
              </span>
            </label>
          )}

          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Como o cliente entende</p>
            <p className="mt-1 text-sm text-gray-900">
              <span className="font-mono font-semibold">{code || 'CÓDIGO'}</span>: {describe(effect, condition)}.
              {perCustomer === '1' ? ' Uma vez por cliente.' : ''} Válido {schedule && startsAt ? `de ${dateTimeBR(fromLocalBRT(startsAt))} ` : ''}até {endsAt ? dateBR(endOfDayBRT(endsAt)) : '…'}.
            </p>
          </div>
        </div>
      </div>
    </WorkspaceDialog>
  )
}
