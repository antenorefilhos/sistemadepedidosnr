import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { authAPI } from '../services/api'
import { getApiErrorMessage } from '../utils/apiError'
import { LoadingButton } from '../components/LoadingButton'
import { buttonVariants } from '../components/ui/button'
import { PasswordInput } from '../components/ui/password-input'
import { surfaceClasses } from '../components/ui/surface'

const HORIZONTAL_LOGO_SRC = '/branding/logo-horizontal-bordo.png'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Link invalido ou incompleto. Peca uma nova redefinicao.')
      return
    }
    if (newPassword.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas nao coincidem.')
      return
    }

    setIsLoading(true)
    try {
      await authAPI.resetPassword(token, newPassword)
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Nao foi possivel redefinir a senha.'))
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
            Redefinir senha
          </h2>
          <p className="mt-3 text-center text-sm text-gray-500">
            Escolha uma nova senha para a sua conta.
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
              <label htmlFor="new-password" className="sr-only">
                Nova senha
              </label>
              <PasswordInput
                id="new-password"
                name="newPassword"
                autoComplete="new-password"
                required
                className="h-12 bg-white/70 px-4"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="sr-only">
                Confirmar nova senha
              </label>
              <PasswordInput
                id="confirm-password"
                name="confirmPassword"
                autoComplete="new-password"
                required
                className="h-12 bg-white/70 px-4"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <LoadingButton
            type="submit"
            isLoading={isLoading}
            loadingText="Salvando..."
            className="w-full py-3 px-4 text-sm rounded-lg shadow-lg hover:shadow-[#5D082A]/20"
          >
            Redefinir senha
          </LoadingButton>
        </form>
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
