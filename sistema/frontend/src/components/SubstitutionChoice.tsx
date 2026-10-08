import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Clock, Loader2, Package, Repeat, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { ordersAPI } from '../services/api'
import { getApiErrorMessage } from '../utils/apiError'
import { formatPrice, formatProductTitle } from '../utils/format'
import { pendingSuggestions, replyDeadline, suggestionQuantityLabel, suggestionSubtotal, totalsWithSuggestions } from '../utils/substitution'
import type { Order } from '../types'

const thumb = (ean?: string | null) => (ean ? `/thumbs/products/${ean}.webp?v=3` : '')

function Photo({ ean, className }: { ean?: string | null; className: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#EFE6D2] bg-white ${className}`}>
      {ean && !failed ? <img src={thumb(ean)} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" onError={() => setFailed(true)} /> : <Package size={16} className="text-gray-400" />}
    </span>
  )
}

/**
 * Troca sugerida na separacao (08/10/2026, etapa 2): o cliente aceita ou recusa
 * aqui, sem depender do WhatsApp. Grava na mesma troca em que o separador
 * registra a resposta do WhatsApp -- quem responder primeiro vale.
 */
export function SubstitutionChoice({ order }: { order: Order }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const pending = pendingSuggestions(order)
  if (!pending.length) return null

  const deadline = replyDeadline(pending)
  const late = deadline ? deadline.getTime() < Date.now() : false
  const totals = totalsWithSuggestions(order, pending)
  const nameOf = (orderItemId: string) => formatProductTitle(order.items.find((i) => i.id === orderItemId)?.product?.name || 'Produto')
  const suggested = new Set(pending.map((s) => s.orderItemId))
  const missingWithout = order.items.filter((i) => i.status === 'MISSING' && !suggested.has(i.id)
    && !(order.substitutionSuggestions || []).some((s) => s.orderItemId === i.id && s.status === 'ACCEPTED'))

  const decide = async (key: string, decisions: Array<{ id: string; accept: boolean }>) => {
    setBusy(key)
    try {
      const { data } = await ordersAPI.decideSubstitutions(order.id, decisions)
      toast.success(data.accepted && !data.rejected
        ? (data.accepted === 1 ? 'Troca aceita. A loja já foi avisada.' : 'Trocas aceitas. A loja já foi avisada.')
        : !data.accepted
          ? 'Certo, seguimos sem a troca. A loja já foi avisada.'
          : 'Resposta enviada. A loja já foi avisada.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível enviar sua resposta. Tente de novo.'))
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['orders'] })
      setBusy(null)
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-3.5" role="region" aria-label="Escolha as trocas">
      <p className="flex items-center gap-1.5 text-base font-bold text-[#231F20]">
        <Repeat size={18} className="text-[#5D082A]" /> {pending.length === 1 ? 'Faltou um item. Quer a troca?' : 'Faltaram itens. Quer as trocas?'}
      </p>
      <p className="mt-0.5 flex items-center gap-1 text-xs text-[#5d4f33]">
        <Clock size={13} className="shrink-0" />
        {deadline && !late
          ? `Responda até ${deadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Sem resposta, seguimos sem a troca.`
          : 'O prazo passou: responda logo, a loja pode seguir sem a troca a qualquer momento.'}
      </p>

      <ul className="mt-3 space-y-2.5">
        {pending.map((s) => {
          const qty = suggestionQuantityLabel(s)
          return (
            <li key={s.id} className="rounded-xl bg-[#FBF7F0] p-3">
              <p className="text-xs text-gray-500">
                No lugar de <span className="font-medium text-gray-600 line-through decoration-gray-400">{nameOf(s.orderItemId)}</span>
              </p>
              <div className="mt-2 flex items-center gap-3">
                <Photo ean={s.product?.ean} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-[#231F20]">{formatProductTitle(s.product?.name || 'Produto')}</p>
                  <p className="text-sm tabular-nums text-[#231F20]">
                    <strong>{formatPrice(suggestionSubtotal(s))}</strong>
                    {qty && <span className="ml-1 text-xs text-gray-500">({qty})</span>}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => decide(`${s.id}:no`, [{ id: s.id, accept: false }])}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#E8D7B0] bg-white text-sm font-semibold text-[#5d4f33] active:bg-[#F8F2E6] disabled:opacity-50"
                >
                  {busy === `${s.id}:no` ? <Loader2 size={16} className="animate-spin" /> : <><X size={16} /> Não quero</>}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => decide(`${s.id}:yes`, [{ id: s.id, accept: true }])}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#5D082A] text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
                >
                  {busy === `${s.id}:yes` ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Quero a troca</>}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {missingWithout.length > 0 && (
        <p className="mt-2.5 text-xs text-gray-500">
          Também faltou, sem troca: {missingWithout.map((i) => formatProductTitle(i.product?.name || 'Produto')).join(', ')}.
        </p>
      )}

      <dl className="mt-3 space-y-1 rounded-xl border border-[#EFE6D2] p-3 text-sm">
        <div className="flex justify-between font-semibold text-[#231F20]"><dt>{pending.length === 1 ? 'Com a troca' : 'Com as trocas'}</dt><dd className="tabular-nums">{formatPrice(totals.with)}</dd></div>
        <div className="flex justify-between text-gray-600"><dt>{pending.length === 1 ? 'Sem a troca' : 'Sem as trocas'}</dt><dd className="tabular-nums">{formatPrice(totals.without)}</dd></div>
      </dl>

      {pending.length > 1 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => decide('all:no', pending.map((s) => ({ id: s.id, accept: false })))}
            className="flex h-11 items-center justify-center rounded-xl text-sm font-semibold text-[#5d4f33] underline-offset-2 hover:underline disabled:opacity-50"
          >
            {busy === 'all:no' ? <Loader2 size={16} className="animate-spin" /> : 'Recusar todas'}
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => decide('all:yes', pending.map((s) => ({ id: s.id, accept: true })))}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-[#5D082A] bg-white text-sm font-bold text-[#5D082A] disabled:opacity-50"
          >
            {busy === 'all:yes' ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Aceitar todas</>}
          </button>
        </div>
      )}
    </div>
  )
}
