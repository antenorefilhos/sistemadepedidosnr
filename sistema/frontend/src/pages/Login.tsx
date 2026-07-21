import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { getApiErrorMessage } from '../utils/apiError'
import { LoadingButton } from '../components/LoadingButton'
import { Button, buttonVariants } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { surfaceClasses } from '../components/ui/surface'

const HORIZONTAL_LOGO_SRC = '/branding/logo-horizontal-bordo.png'

export default function Login() {
  const [email, setEmail] = useState('')
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
      await login(email, password)
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
              <label htmlFor="email-address" className="sr-only">
                Email
              </label>
              <Input
                id="email-address"
                name="email"
                type="email"
                required
                className="h-12 bg-white/70 px-4"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <Input
                id="password"
                name="password"
                type="password"
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

          <div className="text-center text-sm">
            <p className="text-gray-500">
              Ainda não tem cadastro?{' '}
              <Button
                type="button"
                onClick={() => navigate('/register')}
                variant="ghost"
                size="sm"
                className="h-auto px-1 py-0 align-baseline"
              >
                Criar conta grátis
              </Button>
            </p>
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
