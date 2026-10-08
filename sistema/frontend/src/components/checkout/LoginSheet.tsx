import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, UserCheck, X } from 'lucide-react'
import { authAPI } from '../../services/api'
import { loginErrorMessage } from '../../utils/authMessages'
import { Input } from '../ui/input'
import { PasswordInput } from '../ui/password-input'
import type { User } from '../../contexts/AuthContext'

/**
 * Entrar sem sair do checkout (08/10/2026). Abre sozinho quando os dados
 * digitados ja sao de uma conta com senha -- antes o cliente so descobria no
 * "Finalizar", com o aviso la no topo da pagina. O carrinho e o endereco
 * ficam onde estao; depois de entrar, o pedido segue.
 */
export function LoginSheet({
  open,
  reason,
  identifier: initialIdentifier,
  onClose,
  onLoggedIn,
}: {
  open: boolean
  /** exists: os dados ja sao de uma conta; manual: o cliente tocou em "Entrar". */
  reason: 'exists' | 'manual'
  identifier: string
  onClose: () => void
  onLoggedIn: (accessToken: string, user: User) => void
}) {
  const [identifier, setIdentifier] = useState(initialIdentifier)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<{ text: string; suggestReset: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setIdentifier(initialIdentifier)
    setPassword('')
    setError(null)
    const timer = window.setTimeout(() => (initialIdentifier ? passwordRef.current?.focus() : undefined), 150)
    return () => window.clearTimeout(timer)
  }, [open, initialIdentifier])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { data } = await authAPI.login(identifier.trim(), password)
      onLoggedIn(data.access_token, data.user)
    } catch (err) {
      setError(loginErrorMessage(err))
      passwordRef.current?.select()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-sheet-title"
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F8F4EA] text-[#5D082A]">
            <UserCheck size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="login-sheet-title" className="text-lg font-bold leading-tight text-[#231F20]">
              {reason === 'exists' ? 'Você já tem conta com a gente' : 'Entre na sua conta'}
            </h2>
            <p className="mt-1 text-sm text-[#5d4f33]">
              {reason === 'exists'
                ? 'Esses dados já estão cadastrados. Entre com sua senha e o pedido continua daqui, sem perder nada.'
                : 'Seus dados e endereços entram sozinhos. O carrinho continua o mesmo.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">
              <p className="font-semibold">{error.text}</p>
              {error.suggestReset && (
                <p className="mt-1 text-red-700">
                  Não lembra?{' '}
                  <Link to="/esqueci-minha-senha" state={{ identifier }} className="font-bold underline underline-offset-2">
                    Crie uma senha nova
                  </Link>
                  . Seu carrinho fica guardado.
                </p>
              )}
            </div>
          )}
          <div>
            <label htmlFor="sheet-identifier" className="mb-1.5 block text-sm font-semibold text-[#231F20]">
              E-mail, CPF ou celular
            </label>
            <Input
              id="sheet-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              className="h-12 rounded-xl bg-white px-4 text-base"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label htmlFor="sheet-password" className="text-sm font-semibold text-[#231F20]">
                Senha
              </label>
              <Link to="/esqueci-minha-senha" state={{ identifier }} className="text-sm font-semibold text-[#5D082A] hover:underline">
                Esqueci a senha
              </Link>
            </div>
            <PasswordInput
              ref={passwordRef}
              id="sheet-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              enterKeyHint="go"
              required
              className="h-12 rounded-xl bg-white px-4 text-base"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5D082A] text-[15px] font-bold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : 'Entrar e continuar o pedido'}
          </button>
          {reason === 'exists' && (
            <button type="button" onClick={onClose} className="h-11 w-full rounded-xl text-sm font-semibold text-[#5D082A] hover:bg-[#F8F4EA]">
              Usar outros dados
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
