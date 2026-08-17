import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { authAPI } from '../services/api'
import { getApiErrorMessage } from '../utils/apiError'
import { LoadingButton } from '../components/LoadingButton'
import { buttonVariants } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { surfaceClasses } from '../components/ui/surface'

const HORIZONTAL_LOGO_SRC = '/branding/logo-horizontal-bordo.png'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await authAPI.forgotPassword(email.trim())
      setSent(true)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Nao foi possivel enviar o link de redefinicao.'))
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
          <h2 className="mt-6 text-center text-2xl font-bold text-[#231F20] luxury-text">
            Esqueci minha senha
          </h2>
          <p className="mt-3 text-center text-sm text-gray-500">
            Informe o e-mail da sua conta. Se ele existir, enviamos um link para redefinir a senha.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg bg-green-50 p-4 border border-green-100 text-center" role="status">
            <p className="text-sm font-medium text-green-800">
              Se o e-mail existir, um link de redefinição foi enviado. Confira sua caixa de entrada.
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 p-4 border border-red-100" role="alert">
                <p className="text-sm font-medium text-red-800 whitespace-pre-line text-center">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="forgot-email" className="sr-only">
                E-mail
              </label>
              <Input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="h-12 bg-white/70 px-4"
                placeholder="Seu e-mail cadastrado"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <LoadingButton
              type="submit"
              isLoading={isLoading}
              loadingText="Enviando..."
              className="w-full py-3 px-4 text-sm rounded-lg shadow-lg hover:shadow-[#5D082A]/20"
            >
              Enviar link de redefinição
            </LoadingButton>
          </form>
        )}
      </div>
      <Link
        to="/login"
        className={buttonVariants({ variant: 'outline', size: 'md', className: 'mt-4 bg-white/80 backdrop-blur-sm' })}
        aria-label="Voltar para o login"
      >
        <ArrowLeft size={15} />
        Voltar ao login
      </Link>
    </div>
  )
}
