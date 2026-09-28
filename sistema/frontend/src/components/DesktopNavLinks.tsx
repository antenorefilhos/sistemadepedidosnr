import { Link, useLocation } from 'react-router-dom'

// No mobile a navegacao e o MobileBottomNav; no desktop nao havia menu nenhum
// (sem acesso a Promocoes, pedido do Jonathan em 28/09/2026).
const LINKS = [
  { to: '/mercado', label: 'Mercado' },
  { to: '/promocoes', label: 'Promoções' },
  { to: '/adega', label: 'Adega' },
  { to: '/receitas', label: 'Receitas' },
]

export function DesktopNavLinks({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { pathname } = useLocation()
  const base = tone === 'dark' ? 'text-white/85 hover:text-[#D2BB8A]' : 'text-[#5D082A]/80 hover:text-[#5D082A]'
  const active = tone === 'dark' ? 'text-[#D2BB8A]' : 'text-[#5D082A] underline underline-offset-4'
  return (
    <nav aria-label="Seções da loja" className="hidden md:flex items-center gap-6 text-sm font-semibold">
      {LINKS.map((link) => (
        <Link key={link.to} to={link.to} className={`transition-colors ${pathname.startsWith(link.to) ? active : base}`}>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
