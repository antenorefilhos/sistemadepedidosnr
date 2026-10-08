import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { loginErrorMessage } from '../utils/authMessages'
import { LoadingButton } from '../components/LoadingButton'
import { AuthBenefits, AuthHelp, AuthShell } from '../components/AuthShell'
import { buttonVariants } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { PasswordInput } from '../components/ui/password-input'

// Login refeito em 07/10/2026 (revisao de UI/UX do storefront, celular
// primeiro): rotulo visivel nos campos (so placeholder sumia ao digitar),
// teclado sem maiuscula automatica, erro em portugues com a saida para quem
// comprou sem senha, "Comprar sem cadastro" quando o cliente veio do
// checkout, e o "Criar conta" leva o destino junto (antes o cadastro sempre
// caia na Home, mesmo vindo do checkout).

const guestCheckoutEnabled = (import.meta.env.VITE_GUEST_CHECKOUT_ENABLED ?? 'true') !== 'false'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<{ text: string; suggestReset: boolean } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()

  const redirect = searchParams.get('redirect') || undefined
  const fromCheckout = Boolean(redirect?.startsWith('/finalizar-compra') || redirect?.startsWith('/checkout'))
  const notice = (location.state as { notice?: string } | null)?.notice
  const withRedirect = (path: string) => (redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      // Volta para onde o cliente estava (AuthContext.destinoSeguro barra destino externo).
      await login(identifier.trim(), password, redirect)
    } catch (err: unknown) {
      setError(loginErrorMessage(err))
      passwordRef.current?.select()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="rounded-3xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.06)] ring-1 ring-[#E8D7B0]/70 sm:p-8">
        <h1 className="text-2xl font-bold leading-tight text-[#231F20]">{fromCheckout ? 'Entre para fechar o pedido' : 'Entre na sua conta'}</h1>
        <p className="mt-1.5 text-sm text-[#5d4f33]">
          {fromCheckout ? 'Seus dados e endereços já vêm preenchidos.' : 'Para acompanhar pedidos, comprar de novo e receber as ofertas.'}
        </p>

        {notice && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800" role="status">
            <CheckCircle2 size={18} className="mt-px shrink-0" aria-hidden="true" /> {notice}
          </p>
        )}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
              <p className="font-semibold">{error.text}</p>
              {error.suggestReset && (
                <p className="mt-1 text-red-700">
                  Comprou aqui sem criar senha?{' '}
                  <Link to="/esqueci-minha-senha" state={{ identifier }} className="font-bold underline underline-offset-2">
                    Crie a sua
                  </Link>
                  .
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="login-identifier" className="mb-1.5 block text-sm font-semibold text-[#231F20]">
              E-mail, CPF ou celular
            </label>
            <Input
              id="login-identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              required
              className="h-12 rounded-xl bg-white px-4 text-base"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label htmlFor="password" className="text-sm font-semibold text-[#231F20]">
                Senha
              </label>
              <Link to="/esqueci-minha-senha" state={{ identifier }} className="text-sm font-semibold text-[#5D082A] hover:underline">
                Esqueci a senha
              </Link>
            </div>
            <PasswordInput
              ref={passwordRef}
              id="password"
              name="password"
              autoComplete="current-password"
              enterKeyHint="go"
              required
              className="h-12 rounded-xl bg-white px-4 text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <LoadingButton type="submit" isLoading={isLoading} loadingText="Entrando..." className="h-12 w-full rounded-xl text-[15px]">
            Entrar
          </LoadingButton>
        </form>

        {fromCheckout && guestCheckoutEnabled && (
          <button
            type="button"
            onClick={() => navigate(redirect || '/finalizar-compra')}
            className={buttonVariants({ variant: 'ghost', className: 'mt-2 h-11 w-full rounded-xl text-[15px]' })}
          >
            Comprar sem cadastro
          </button>
        )}

        <div className="mt-6 border-t border-[#E8D7B0]/60 pt-5">
          <p className="text-center text-sm text-[#5d4f33]">Ainda não tem conta?</p>
          <Link to={withRedirect('/cadastro')} className={buttonVariants({ variant: 'outline', className: 'mt-2 h-12 w-full rounded-xl text-[15px]' })}>
            Criar conta grátis
          </Link>
        </div>
      </div>

      <AuthBenefits className="mt-6 px-1 text-[#5d4f33] lg:hidden" />
      <div className="mt-6">
        <AuthHelp />
      </div>
    </AuthShell>
  )
}
