import { CheckCircle2, Info, MessageCircle, PackageSearch, ShoppingBag } from 'lucide-react'
import { formatPrice } from '../utils/format'
import { PAYMENT_METHOD_LABEL } from '../utils/checkout'
import { CriarSenhaCard } from './CriarSenhaCard'
import type { Order } from '../types'
import type { WhatsAppDispatch } from '../services/api'

/**
 * Tela final do checkout (refeita em 08/10/2026): o que foi pedido, como paga,
 * quanto deu, e o proximo passo -- acompanhar o pedido. Antes so havia
 * "Pedido Confirmado!" e "Continuar comprando"; quem queria ver o pedido nao
 * tinha caminho.
 */
export function OrderConfirmation({
  createdOrder, whatsappDispatch, contaSemSenha, isPickup, onContinueShopping, onTrackOrder,
}: {
  createdOrder: Order | null
  whatsappDispatch: WhatsAppDispatch | null
  contaSemSenha: boolean
  isPickup?: boolean
  onContinueShopping: () => void
  onTrackOrder: () => void
}) {
  const method = String(createdOrder?.paymentMethod || 'CASH').toUpperCase()
  const methodLabel = PAYMENT_METHOD_LABEL[method] || createdOrder?.paymentMethod || 'Dinheiro'
  const changeFor = createdOrder?.notes?.match(/Troco para:\s*([^)\n]*)/)?.[1]?.trim()
  const code = createdOrder?.erpDav ? `DAV ${createdOrder.erpDav}` : createdOrder ? `#${createdOrder.id.slice(-8).toUpperCase()}` : ''

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
      <section className="rounded-3xl border border-[#E8D7B0]/70 bg-white p-6 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={36} />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-[#231F20]">Pedido feito!</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[#5d4f33]">
          {isPickup
            ? 'Já estamos separando. Avisamos no WhatsApp quando estiver pronto para retirar.'
            : 'Já estamos separando. Avisamos no WhatsApp quando sair para entrega.'}
        </p>
        {code && <p className="mt-3 inline-flex rounded-full bg-[#F8F4EA] px-3 py-1 text-sm font-bold text-[#5D082A]">Pedido {code}</p>}
      </section>

      {createdOrder && (
        <section className="rounded-2xl border border-[#E8D7B0]/70 bg-white p-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[#5d4f33]">Pagamento</dt>
              <dd className="font-semibold text-[#231F20]">
                {methodLabel}
                {method === 'CASH' && changeFor ? ` · troco para R$ ${changeFor}` : ''}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#5d4f33]">Total</dt>
              <dd className="text-base font-black tabular-nums text-[#231F20]">{formatPrice(createdOrder.total)}</dd>
            </div>
          </dl>
          <p className="mt-3 flex gap-2 rounded-xl bg-[#F8F4EA] px-3 py-2.5 text-xs leading-relaxed text-[#5d4f33]">
            <Info size={15} className="mt-px shrink-0 text-[#8a6a3a]" />
            Você paga {isPickup ? 'na retirada' : 'na entrega'}. O valor final pode mudar um pouco por causa do peso dos itens ou de alguma troca que você aprovar.
          </p>
        </section>
      )}

      {contaSemSenha && <CriarSenhaCard />}

      <div className="space-y-2.5">
        <button type="button" onClick={onTrackOrder} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5D082A] text-[15px] font-bold text-white">
          <PackageSearch size={18} /> Acompanhar pedido
        </button>
        {whatsappDispatch?.url && (
          <a href={whatsappDispatch.url} target="_blank" rel="noreferrer" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/50 bg-[#25D366]/10 text-[15px] font-bold text-[#0d5c36]">
            <MessageCircle size={18} /> Mandar o pedido no WhatsApp da loja
          </a>
        )}
        <button type="button" onClick={onContinueShopping} className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-[#5D082A]">
          <ShoppingBag size={16} /> Continuar comprando
        </button>
      </div>
    </div>
  )
}
