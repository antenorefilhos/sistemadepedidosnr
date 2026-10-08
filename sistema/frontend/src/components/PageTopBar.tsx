import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShoppingCart } from 'lucide-react'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import NotificationBell from './NotificationBell'

/**
 * Cabecalho branco das paginas internas da loja (mesmo desenho do produto e
 * das ofertas): voltar, titulo, acoes da pagina e o carrinho com a contagem.
 */
export function PageTopBar({ title, onBack, backLabel = 'Voltar', actions }: { title: ReactNode; onBack: () => void; backLabel?: string; actions?: ReactNode }) {
  const { count } = useCart()
  const { user } = useAuth()
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8D7B0]/60 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-2 py-2 sm:px-4">
        <button type="button" onClick={onBack} aria-label={backLabel} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
          <ArrowLeft size={22} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-lg font-bold text-[#231F20]">{title}</div>
        {actions}
        <Link
          to="/cart"
          aria-label={count > 0 ? `Carrinho com ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]"
        >
          <ShoppingCart size={22} aria-hidden="true" />
          {count > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#5D082A] px-1 text-[10px] font-bold text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Link>
        {user && <NotificationBell />}
      </div>
    </header>
  )
}
