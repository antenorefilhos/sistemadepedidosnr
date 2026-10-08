import { useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowLeft, ChevronDown, ShoppingBag, X } from 'lucide-react'
import { formatPrice, formatProductTitle } from '../../utils/format'
import { formatProductQuantity, getProductLineTotal } from '../../utils/productPricing'
import type { CartItem } from '../../contexts/CartContext'

// Checkout refeito em 08/10/2026 (revisao de UI/UX do storefront, celular
// primeiro): cabecalho com as etapas, resumo do pedido que abre e fecha, e a
// barra fixa embaixo com o total, o botao e o aviso -- que agora aparece onde
// o cliente esta, nao so no topo da pagina.

const STEPS = [
  { id: 'address', label: 'Entrega' },
  { id: 'payment', label: 'Pagamento' },
  { id: 'confirmation', label: 'Confirmado' },
]

export function CheckoutHeader({ step, onBack }: { step: string; onBack: () => void }) {
  const active = Math.max(0, STEPS.findIndex((s) => s.id === step))
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8D7B0]/60 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-1.5 px-2 py-2 sm:px-4">
        {step !== 'confirmation' ? (
          <button type="button" onClick={onBack} aria-label="Voltar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
            <ArrowLeft size={22} />
          </button>
        ) : (
          <span className="w-11 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight text-[#231F20]">{step === 'confirmation' ? 'Pedido feito' : 'Finalizar pedido'}</p>
          <p className="text-xs text-[#8a6a3a]">
            {step === 'confirmation' ? 'Tudo certo' : `Etapa ${active + 1} de 2 · ${STEPS[active].label}`}
          </p>
        </div>
        <span className="w-11 shrink-0" />
      </div>
      <ol className="mx-auto flex max-w-2xl gap-1.5 px-4 pb-2" aria-label="Etapas do pedido">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex-1">
            <span className={`block h-1 rounded-full ${i <= active ? 'bg-[#5D082A]' : 'bg-[#E8D7B0]/70'}`} />
            <span className={`mt-1 block text-[10px] font-semibold ${i <= active ? 'text-[#5D082A]' : 'text-gray-400'}`}>{s.label}</span>
          </li>
        ))}
      </ol>
    </header>
  )
}

/** Itens do pedido, recolhido por padrao: "12 itens · R$ 98,14 · Ver itens". */
export function OrderItemsSummary({ cart, subtotal, defaultOpen = false }: { cart: CartItem[]; subtotal: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const count = cart.reduce((sum, item) => sum + (item.product?.isFractional ? 1 : item.quantity), 0)
  return (
    <section className="rounded-2xl border border-[#E8D7B0]/70 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8F4EA] text-[#5D082A]">
          <ShoppingBag size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[#231F20]">
            {count} {count === 1 ? 'item' : 'itens'} · {formatPrice(subtotal)}
          </span>
          <span className="block text-xs text-[#8a6a3a]">{open ? 'Esconder itens' : 'Ver itens do pedido'}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="divide-y divide-[#E8D7B0]/50 border-t border-[#E8D7B0]/50 px-4">
          {cart.map((item) => (
            <li key={item.productId} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="line-clamp-2 text-[#231F20]">{formatProductTitle(item.product?.name || '')}</span>
                <span className="text-xs text-gray-500">
                  {item.product ? formatProductQuantity(item.product, item.quantity) : item.quantity}
                  {item.allowSubstitution === false && <span className="ml-1.5 font-semibold text-amber-700">· não trocar</span>}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-[#231F20]">
                {formatPrice(item.product ? getProductLineTotal(item.product, item.quantity) : 0)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Barra fixa do pe: total, botao principal e o aviso de erro logo acima dele.
 * O aviso fica onde o polegar ja esta -- antes ia para o topo da pagina e o
 * cliente apertava "Finalizar" sem saber por que nada acontecia.
 */
export function CheckoutActionBar({
  error, onDismissError, totalLabel, total, children,
}: {
  error: string | null
  onDismissError: () => void
  totalLabel: string
  total: number
  children: ReactNode
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8D7B0] bg-white/95 shadow-[0_-8px_30px_rgba(35,31,32,0.12)] backdrop-blur">
      <div className="mx-auto max-w-2xl px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 sm:px-4">
        {error && (
          <div role="alert" aria-live="assertive" className="mb-2.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 animate-in fade-in slide-in-from-bottom-2">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-700" />
            <span className="min-w-0 flex-1 font-medium">{error}</span>
            <button type="button" onClick={onDismissError} aria-label="Fechar aviso" className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-amber-700 hover:bg-amber-100">
              <X size={15} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0 pl-1">
            <p className="text-[11px] text-[#5d4f33]">{totalLabel}</p>
            <p className="text-lg font-black leading-tight tabular-nums text-[#231F20]">{formatPrice(total)}</p>
          </div>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
