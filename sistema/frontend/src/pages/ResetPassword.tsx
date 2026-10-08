import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'
import { getApiErrorMessage } from '../utils/apiError'
import { LoadingButton } from '../components/LoadingButton'
import { AuthHelp, AuthShell } from '../components/AuthShell'
import { buttonVariants } from '../components/ui/button'
import { PasswordInput } from '../components/ui/password-input'

// Nova senha pelo link do e-mail (07/10/2026: mesmo layout das telas de
// entrada, rotulos visiveis e, ao salvar, o login avisa que deu certo).

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
    if (newPassword.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As duas senhas não são iguais.')
      return
    }

    setIsLoading(true)
    try {
      await authAPI.resetPassword(token, newPassword)
      navigate('/login', { replace: true, state: { notice: 'Senha criada. Agora é só entrar com ela.' } })
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Não foi possível salvar a senha. Tente de novo.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell backTo="/login">
      <div className="rounded-3xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.06)] ring-1 ring-[#E8D7B0]/70 sm:p-8">
        {!token ? (
          <>
            <h1 className="text-2xl font-bold leading-tight text-[#231F20]">Link incompleto</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[#5d4f33]">
              Abra o link direto do e-mail, sem cortar o endereço. Se ele já venceu (vale por 1 hora), peça outro.
            </p>
            <Link to="/esqueci-minha-senha" className={buttonVariants({ variant: 'primary', className: 'mt-5 h-12 w-full rounded-xl text-[15px]' })}>
              Pedir outro link
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold leading-tight text-[#231F20]">Crie sua senha nova</h1>
            <p className="mt-1.5 text-sm text-[#5d4f33]">Pelo menos 6 caracteres. Depois é só entrar com ela.</p>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
                  <p className="font-semibold">{error}</p>
                  {/venc|expir|inv[aá]lid|usado/i.test(error) && (
                    <Link to="/esqueci-minha-senha" className="mt-1 inline-block font-bold underline underline-offset-2">
                      Pedir outro link
                    </Link>
                  )}
                </div>
              )}
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-[#231F20]">
                  Senha nova
                </label>
                <PasswordInput
                  id="new-password"
                  name="newPassword"
                  autoComplete="new-password"
                  enterKeyHint="next"
                  required
                  minLength={6}
                  className="h-12 rounded-xl bg-white px-4 text-base"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-[#231F20]">
                  Repita a senha
                </label>
                <PasswordInput
                  id="confirm-password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  enterKeyHint="done"
                  required
                  className="h-12 rounded-xl bg-white px-4 text-base"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <LoadingButton type="submit" isLoading={isLoading} loadingText="Salvando..." className="h-12 w-full rounded-xl text-[15px]">
                Salvar senha
              </LoadingButton>
            </form>
          </>
        )}
      </div>
      <div className="mt-6">
        <AuthHelp />
      </div>
    </AuthShell>
  )
}
