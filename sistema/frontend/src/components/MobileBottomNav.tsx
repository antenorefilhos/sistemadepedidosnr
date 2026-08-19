import { Link, useLocation } from 'react-router-dom'
import { Home as HomeIcon, Search, ShoppingCart, User } from 'lucide-react'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { useFreeShipping } from '../hooks/useFreeShipping'
import { useKnownZoneFreeAbove } from '../hooks/useKnownZoneFreeAbove'

const ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, match: (path: string) => path === '/' },
  { to: '/mercado', label: 'Buscar', icon: Search, match: (path: string) => path.startsWith('/mercado') },
  { to: '/promocoes', label: 'Promos', icon: null, match: (path: string) => path.startsWith('/promocoes') },
]

/** Menu inferior mobile, compartilhado entre todas as telas do storefront. */
export function MobileBottomNav() {
  const location = useLocation()
  const { count, subtotal } = useCart()
  const { user } = useAuth()
  const zoneFreeAbove = useKnownZoneFreeAbove()
  const freeShipping = useFreeShipping(subtotal, zoneFreeAbove)

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 shadow-xl">
        <div className="grid grid-cols-5 h-16">
          {ITEMS.map(({ to, label, icon: Icon, match }) => {
            const active = match(location.pathname)
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active ? 'text-[#5D082A]' : 'text-[#6B7280] hover:text-[#5D082A]'
                }`}
              >
                {Icon ? (
                  // lucide-react desenha a maioria dos ícones como stroke, não shape sólido;
                  // fill quebra o contorno interno (porta da casa, cabo da lupa) — cor basta, igual ShoppingCart/User
                  <Icon size={21} strokeWidth={active ? 2.5 : 2} />
                ) : (
                  <img src="/icons/icon-promo-menu.gif" alt="" width={34} height={34} className="-my-1.5 h-[34px] w-[34px] object-contain" />
                )}
                <span className={`text-label ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </Link>
            )
          })}
          <Link to="/cart" className="flex flex-col items-center justify-center gap-0.5 text-[#6B7280] hover:text-[#5D082A] transition-colors relative cursor-pointer">
            <ShoppingCart size={21} />
            {count > 0 && (
              <span className="absolute top-2 right-4 bg-[#5D082A] text-white text-label font-black rounded-full w-4 h-4 flex items-center justify-center">{count}</span>
            )}
            {freeShipping.enabled && freeShipping.achieved && (
              <span className="absolute top-1.5 left-3 bg-emerald-500 rounded-full w-2.5 h-2.5 border-2 border-white" />
            )}
            <span className="text-label font-medium">Carrinho</span>
          </Link>
          <Link to={user ? '/account' : '/login'} className="flex flex-col items-center justify-center gap-0.5 text-[#6B7280] hover:text-[#5D082A] transition-colors cursor-pointer">
            <User size={21} />
            <span className="text-label font-medium">{user ? 'Conta' : 'Entrar'}</span>
          </Link>
        </div>
      </nav>

      {/* Espaco reservado mobile para o conteudo nao ficar tapado pelo nav fixo */}
      <div className="md:hidden h-16" />
    </>
  )
}
