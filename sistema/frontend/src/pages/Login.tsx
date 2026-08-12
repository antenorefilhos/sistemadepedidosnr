import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiErrorMessage } from '../utils/apiError'
import { LoadingButton } from '../components/LoadingButton'
import { Button, buttonVariants } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { PasswordInput } from '../components/ui/password-input'
import { surfaceClasses } from '../components/ui/surface'

const HORIZONTAL_LOGO_SRC = '/branding/logo-horizontal-bordo.png'

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(identifier, password)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Falha ao fazer login'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F0] py-12 px-4 sm:px-6 lg:px-8">
      <div className={surfaceClasses({ tone: 'warm', className: 'glass max-w-md w-full space-y-8 p-10 border-[#D2BB8A]/20' })}>
        <div>
          <img
            src={HORIZONTAL_LOGO_SRC}
            alt="Antenor & Filhos"
            className="mx-auto h-14 w-auto object-contain"
          />
          <h2 className="mt-6 text-center text-3xl font-bold text-[#231F20] luxury-text">
            Entre e continue sua compra
          </h2>
          <p className="mt-2 text-center text-xs tracking-widest uppercase text-[#5D082A] font-bold">
            Antenor & Filhos
          </p>
          <p className="mt-3 text-center text-sm text-gray-500">
            Acesse sua conta para ver pedidos, carrinho e ofertas da loja.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-red-50 p-4 border border-red-100" role="alert">
              <p className="text-sm font-medium text-red-800 whitespace-pre-line text-center">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="login-identifier" className="sr-only">
                E-mail, CPF ou celular
              </label>
              <Input
                id="login-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                className="h-12 bg-white/70 px-4"
                placeholder="E-mail, CPF ou celular"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                className="h-12 bg-white/70 px-4"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <LoadingButton
              type="submit"
              isLoading={isLoading}
              loadingText="Entrando..."
              className="w-full py-3 px-4 text-sm rounded-lg shadow-lg hover:shadow-[#5D082A]/20"
            >
              Entrar agora
            </LoadingButton>
          </div>

          <div className="relative flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-[#D2BB8A]/30" />
            <span className="text-xs text-gray-400">ou</span>
            <div className="h-px flex-1 bg-[#D2BB8A]/30" />
          </div>

          <div>
            <Button
              type="button"
              onClick={() => navigate('/register')}
              variant="outline"
              className="w-full py-3 px-4 text-sm rounded-lg border-[#5D082A] text-[#5D082A] hover:bg-[#5D082A]/5"
            >
              Criar conta grátis
            </Button>
          </div>
        </form>

      </div>
      <Link
        to="/"
        className={buttonVariants({ variant: 'outline', size: 'md', className: 'mt-4 bg-white/80 backdrop-blur-sm' })}
        aria-label="Voltar para a loja"
      >
        <ArrowLeft size={15} />
        Voltar à loja
      </Link>
    </div>
  )
}
