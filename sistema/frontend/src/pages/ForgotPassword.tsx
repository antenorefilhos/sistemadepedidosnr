import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { authAPI } from '../services/api'
import { getApiErrorMessage } from '../utils/apiError'
import { LoadingButton } from '../components/LoadingButton'
import { AuthHelp, AuthShell } from '../components/AuthShell'
import { buttonVariants } from '../components/ui/button'
import { Input } from '../components/ui/input'

// Esqueci a senha (07/10/2026): pelo mesmo dado do login (e-mail, CPF ou
// celular) -- quem comprou como convidado lembra do WhatsApp, nao do e-mail --
// e e tambem o caminho de quem nunca criou senha. O link vai para o e-mail do
// cadastro; sem e-mail, a saida e falar com a loja.

export default function ForgotPassword() {
  const location = useLocation()
  const [identifier, setIdentifier] = useState((location.state as { identifier?: string } | null)?.identifier || '')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await authAPI.forgotPassword(identifier.trim())
      setSent(true)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Não foi possível enviar o link agora. Tente de novo.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell backTo="/entrar">
      <div className="rounded-3xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.06)] ring-1 ring-[#E8D7B0]/70 sm:p-8">
        {sent ? (
          <div className="text-center" role="status">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <MailCheck size={28} aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-2xl font-bold text-[#231F20]">Confira seu e-mail</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#5d4f33]">
              Se encontrarmos sua conta, o link para criar a senha nova chega em alguns minutos no e-mail do cadastro. Olhe também o spam. O link vale por 1 hora.
            </p>
            <Link to="/entrar" className={buttonVariants({ variant: 'primary', className: 'mt-6 h-12 w-full rounded-xl text-[15px]' })}>
              Voltar para entrar
            </Link>
            <button type="button" onClick={() => setSent(false)} className="mt-2 h-11 w-full rounded-xl text-sm font-bold text-[#5D082A] hover:bg-[#F8F4EA]">
              Não chegou? Enviar de novo
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold leading-tight text-[#231F20]">Criar uma senha nova</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[#5d4f33]">
              Esqueceu a senha ou comprou aqui sem criar uma? Informe seus dados e enviamos um link para o e-mail do cadastro.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              {error && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-800" role="alert">
                  {error}
                </p>
              )}
              <div>
                <label htmlFor="forgot-identifier" className="mb-1.5 block text-sm font-semibold text-[#231F20]">
                  E-mail, CPF ou celular
                </label>
                <Input
                  id="forgot-identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  required
                  className="h-12 rounded-xl bg-white px-4 text-base"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
              <LoadingButton type="submit" isLoading={isLoading} loadingText="Enviando..." className="h-12 w-full rounded-xl text-[15px]">
                Enviar link
              </LoadingButton>
            </form>

            <Link to="/entrar" className="mt-3 flex h-11 items-center justify-center rounded-xl text-sm font-bold text-[#5D082A] hover:bg-[#F8F4EA]">
              Lembrei a senha
            </Link>
          </>
        )}
      </div>
      <div className="mt-6">
        <AuthHelp text="Sem e-mail no cadastro? Fale com a loja" />
      </div>
    </AuthShell>
  )
}
