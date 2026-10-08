import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BellRing, MessageCircle, RotateCcw, Truck } from 'lucide-react'
import { useBrand } from '../hooks/useBrand'

// Telas de entrada (entrar, criar conta, esqueci e nova senha), refeitas em
// 07/10/2026 na revisao de UI/UX do storefront: cabecalho branco com voltar,
// como o resto da loja (antes o "Voltar a loja" ficava solto embaixo do card,
// e no cadastro, em cima), formulario de largura de celular e, no computador,
// o painel com o que a conta da ao cliente.

export const AUTH_BENEFITS = [
  { icon: Truck, text: 'Acompanhe o pedido da separação até a sua porta' },
  { icon: RotateCcw, text: 'Compre de novo um pedido anterior com um toque' },
  { icon: BellRing, text: 'Receba no celular as ofertas da semana' },
]

export function AuthBenefits({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  return (
    <ul className={`space-y-3 ${className}`}>
      {AUTH_BENEFITS.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-3 text-sm">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${dark ? 'bg-white/10 text-[#D2BB8A]' : 'bg-[#F8F4EA] text-[#5D082A]'}`}>
            <Icon size={17} aria-hidden="true" />
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}

/** "Precisa de ajuda? Fale com a loja" -- o WhatsApp da tela Marca. */
export function AuthHelp({ text = 'Precisa de ajuda? Fale com a loja' }: { text?: string }) {
  const brand = useBrand()
  const digits = (brand.contactWhatsapp || '').replace(/\D/g, '')
  if (!digits) return null
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noreferrer"
      className="mx-auto flex min-h-11 w-fit items-center gap-2 px-2 text-sm font-semibold text-[#0d5c36] hover:underline"
    >
      <MessageCircle size={17} aria-hidden="true" /> {text}
    </a>
  )
}

export function AuthShell({ children, backTo = '/' }: { children: ReactNode; backTo?: string }) {
  const navigate = useNavigate()
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(backTo)
  }

  return (
    <div className="min-h-screen bg-[#FBFAF7]">
      <header className="sticky top-0 z-40 border-b border-[#E8D7B0]/60 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-1.5 px-2 py-2 sm:px-4">
          <button type="button" onClick={goBack} aria-label="Voltar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
            <ArrowLeft size={22} />
          </button>
          <Link to="/" aria-label="Antenor & Filhos, ir para o início" className="mx-auto">
            <img src="/branding/logo-horizontal-bordo.png" alt="Antenor & Filhos" className="h-8 w-auto object-contain" />
          </Link>
          <span className="w-11 shrink-0" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-12 pt-6 lg:grid lg:grid-cols-[1fr_440px] lg:items-start lg:gap-12 lg:pt-14">
        <aside className="hidden rounded-3xl bg-gradient-to-br from-[#5D082A] via-[#741035] to-[#3d0519] p-10 text-white lg:block">
          <img src="/branding/logo-horizontal-branco.png" alt="" className="h-10 w-auto object-contain" />
          <p className="mt-10 text-xs font-bold uppercase tracking-wider text-[#D2BB8A]">Desde 1979</p>
          <p className="mt-2 text-3xl font-bold leading-tight">O mercado da família, agora no seu celular.</p>
          <AuthBenefits dark className="mt-8 text-white/90" />
        </aside>
        <div className="mx-auto w-full max-w-md lg:max-w-none">{children}</div>
      </main>
    </div>
  )
}
