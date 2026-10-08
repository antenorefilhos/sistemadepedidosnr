import { useEffect, useState } from 'react'
import { Check, Clock, MessageCircle, RotateCcw, Trash2, X } from 'lucide-react'
import type { Order, SubstitutionSuggestion } from '../services/api'
import { brl } from '../utils/orderAdjustment'
import { qtd } from '../utils/quantity'
import { ProductPhoto } from './ProductPhoto'
import { weightShort } from '../utils/weight'

// Troca sugerida pelo separador (08/10/2026, etapa 1): o separador sugere o
// produto que tem na gondola, manda tudo de uma vez pelo WhatsApp da loja e
// registra o que o cliente respondeu. O prazo de resposta e de 15 minutos;
// depois dele, segue sem as trocas.

export const REPLY_MINUTES = 15

export function suggestionsOf(order: Order) {
  const all = (order.substitutionSuggestions || []).filter((s) => s.status !== 'CANCELLED')
  const unsent = all.filter((s) => s.status === 'PENDING' && !s.sentAt)
  const waiting = all.filter((s) => s.status === 'PENDING' && s.sentAt)
  const lastSent = waiting.reduce((max, s) => Math.max(max, new Date(s.sentAt!).getTime()), 0)
  return { all, unsent, waiting, lastSent }
}

/** Minutos que faltam do prazo (0 = venceu). */
export function minutesLeft(lastSent: number, now = Date.now()) {
  if (!lastSent) return 0
  const left = lastSent + REPLY_MINUTES * 60000 - now
  // Relogio do celular pode estar adiantado/atrasado: nunca mostra mais que o prazo.
  return left > 0 ? Math.min(REPLY_MINUTES, Math.ceil(left / 60000)) : 0
}

export function useMinuteTicker() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 20000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  DRAFT: { text: 'Ainda não enviada', className: 'bg-gray-100 text-gray-700' },
  WAITING: { text: 'Aguardando o cliente', className: 'bg-amber-100 text-amber-800' },
  ACCEPTED: { text: 'Cliente aceitou', className: 'bg-green-100 text-green-800' },
  REJECTED: { text: 'Cliente recusou', className: 'bg-red-100 text-red-700' },
  EXPIRED: { text: 'Sem resposta no prazo', className: 'bg-gray-100 text-gray-600' },
}

/** A sugestao dentro do card do item em falta. */
export function SuggestionRow({
  suggestion, disabled, onChange, onCancel, onDecide,
}: {
  suggestion: SubstitutionSuggestion
  disabled: boolean
  onChange: () => void
  onCancel: () => void
  onDecide: (accept: boolean) => void
}) {
  const key = suggestion.status === 'PENDING' ? (suggestion.sentAt ? 'WAITING' : 'DRAFT') : suggestion.status
  const label = STATUS_LABEL[key] || STATUS_LABEL.DRAFT
  const subtotal = Math.round(suggestion.unitPrice * suggestion.quantity * 100) / 100
  return (
    <div className="mt-2 ml-14 rounded-lg border border-gray-200 bg-white p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Troca sugerida</p>
      <div className="mt-1 flex items-center gap-2.5">
        <ProductPhoto ean={suggestion.product?.ean} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{suggestion.product?.name || 'Produto'}</p>
          <p className="text-xs text-gray-500 tabular-nums">
            {suggestion.product?.isFractional ? weightShort(suggestion.quantity) : `${qtd(suggestion.quantity)} ${suggestion.quantity === 1 ? 'unidade' : 'unidades'}`} · {brl(subtotal)}
          </p>
        </div>
      </div>
      <span className={`mt-1.5 inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold ${label.className}`}>{label.text}</span>
      {!disabled && key === 'DRAFT' && (
        <div className="mt-2 flex gap-2">
          <button onClick={onChange} className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700 active:bg-blue-100">
            <RotateCcw size={12} /> Trocar sugestão
          </button>
          <button onClick={onCancel} className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600 active:bg-red-100">
            <Trash2 size={12} /> Apagar
          </button>
        </div>
      )}
      {!disabled && key === 'WAITING' && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => onDecide(true)} className="flex h-10 items-center justify-center gap-1 rounded-lg bg-green-600 text-sm font-semibold text-white active:scale-[0.98]">
            <Check size={15} /> Aceitou
          </button>
          <button onClick={() => onDecide(false)} className="flex h-10 items-center justify-center gap-1 rounded-lg border border-red-200 bg-white text-sm font-semibold text-red-600 active:bg-red-50">
            <X size={15} /> Recusou
          </button>
        </div>
      )}
    </div>
  )
}

/** Quadro do fim da lista: trocas a enviar, esperar a resposta, seguir sem elas. */
export function SubstitutionPanel({
  order, busy, now, onSend, onDecideAll, onExpire,
}: {
  order: Order
  busy: boolean
  now: number
  onSend: () => void
  onDecideAll: (accept: boolean) => void
  onExpire: () => void
}) {
  const { unsent, waiting, lastSent } = suggestionsOf(order)
  if (!unsent.length && !waiting.length) return null
  const left = minutesLeft(lastSent, now)
  const sentAgo = lastSent ? Math.max(0, Math.floor((now - lastSent) / 60000)) : 0

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
      {unsent.length > 0 && (
        <>
          <p className="font-semibold">
            {unsent.length === 1 ? '1 troca para enviar ao cliente' : `${unsent.length} trocas para enviar ao cliente`}
          </p>
          {/* O botao de enviar fica so na barra de baixo (08/10/2026): um caminho, no fim da separacao. */}
          <p className="mt-0.5 text-xs text-green-800">Quando terminar de separar, toque em <strong>Enviar trocas ao cliente</strong>, lá embaixo. A mensagem já sai pronta, com os preços e o total.</p>
        </>
      )}
      {waiting.length > 0 && (
        <div className={unsent.length ? 'mt-3 border-t border-green-200 pt-3' : ''}>
          <p className="flex items-center gap-1.5 font-semibold">
            <Clock size={15} /> Aguardando o cliente · enviado há {sentAgo} min
          </p>
          <p className="mt-0.5 text-xs text-green-800">
            {left > 0
              ? `Prazo de resposta: faltam ${left} min. Quando ele responder, toque na resposta.`
              : 'Passou o prazo de 15 min sem resposta: siga sem as trocas.'}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => onDecideAll(true)} disabled={busy} className="flex h-10 items-center justify-center gap-1 rounded-lg bg-green-600 text-sm font-semibold text-white disabled:opacity-60">
              <Check size={15} /> Aceitou {waiting.length > 1 ? 'todas' : ''}
            </button>
            <button onClick={() => onDecideAll(false)} disabled={busy} className="flex h-10 items-center justify-center gap-1 rounded-lg border border-red-200 bg-white text-sm font-semibold text-red-600 disabled:opacity-60">
              <X size={15} /> Recusou {waiting.length > 1 ? 'todas' : ''}
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            {!unsent.length && (
              <button onClick={onSend} disabled={busy} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2.5 py-2 text-xs font-medium text-green-800 ring-1 ring-green-200">
                <MessageCircle size={13} /> Abrir a mensagem de novo
              </button>
            )}
            {left === 0 && (
              <button onClick={onExpire} disabled={busy} className="flex flex-1 items-center justify-center rounded-lg bg-gray-900 px-2.5 py-2 text-xs font-semibold text-white">
                Seguir sem as trocas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
