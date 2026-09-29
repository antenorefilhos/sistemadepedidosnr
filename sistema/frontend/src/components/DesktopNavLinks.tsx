import { Link, useLocation } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes'

// Links do desktop logo depois da busca (Jonathan, 28/09/2026). Promo fica na
// barra de categorias (igual ao app) e a Adega ja tem atalho la.
const LINKS = [
  { to: '/mercado', label: 'Todos os produtos' },
  { to: '/receitas', label: 'Receitas' },
]

export function DesktopNavLinks({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { pathname } = useLocation()
  // "Receitas" so aparece com pelo menos uma receita publicada (29/09/2026:
  // o link levava a uma pagina vazia).
  const { data: recipes } = useRecipes(undefined, 1, 1)
  const links = LINKS.filter((link) => link.to !== '/receitas' || (recipes?.total ?? 0) > 0)
  const base = tone === 'dark' ? 'text-white/90 hover:text-[#D2BB8A]' : 'text-[#5D082A]/80 hover:text-[#5D082A]'
  const active = tone === 'dark' ? 'text-[#D2BB8A]' : 'text-[#5D082A] underline underline-offset-4'
  return (
    <nav aria-label="Seções da loja" className="hidden md:flex shrink-0 items-center gap-5 text-sm font-semibold">
      {links.map((link) => (
        <Link key={link.to} to={link.to} className={`whitespace-nowrap transition-colors ${pathname.startsWith(link.to) ? active : base}`}>
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
