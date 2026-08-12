import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { authAPI, getApiErrorMessage } from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const HORIZONTAL_LOGO_SRC = '/branding/logo-horizontal-bordo.png'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5d082a] to-[#3a0418] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <img src={HORIZONTAL_LOGO_SRC} alt="Antenor & Filhos" className="mx-auto mb-8 h-16 w-auto object-contain" />
        {children}
      </div>
    </div>
  )
}

/** Sem token na URL: pede o e-mail e dispara o link de redefinicao. */
function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authAPI.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erro ao solicitar redefinicao'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-gray-700">
          Se <strong>{email}</strong> tiver uma conta, enviamos um link de redefinição de senha por e-mail. Confira também a caixa de spam.
        </p>
        <Link to="/login" className="text-sm font-semibold text-[#5d082a] hover:underline">
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">Informe o e-mail da sua conta para receber um link de redefinição de senha.</p>
      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
      <div>
        <Label htmlFor="forgot-email" className="mb-2 block font-medium">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-10 rounded-lg border-gray-200 px-4 py-2 focus-visible:ring-[#5d082a]"
          placeholder="admin@mercado.com"
        />
      </div>
      <Button type="submit" disabled={loading} className="h-10 w-full rounded-lg bg-[#5d082a] py-2 font-medium text-white hover:bg-[#4a0622]">
        {loading && <Loader2 className="animate-spin" size={20} />}
        Enviar link de redefinição
      </Button>
      <Link to="/login" className="block text-center text-sm font-semibold text-[#5d082a] hover:underline">
        Voltar para o login
      </Link>
    </form>
  )
}

/** Com token na URL: define a nova senha. */
function ResetPasswordForm({ token }: { token: string }) {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) {
      setError('A senha precisa ter no mínimo 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      await authAPI.resetPassword(token, newPassword)
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Link inválido ou expirado'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return <p className="text-center text-sm text-emerald-700">Senha redefinida com sucesso! Redirecionando para o login...</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">Escolha sua nova senha.</p>
      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
      <div>
        <Label htmlFor="new-password" className="mb-2 block font-medium">Nova senha</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          className="h-10 rounded-lg border-gray-200 px-4 py-2 focus-visible:ring-[#5d082a]"
          placeholder="••••••••"
        />
      </div>
      <div>
        <Label htmlFor="confirm-password" className="mb-2 block font-medium">Confirmar nova senha</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="h-10 rounded-lg border-gray-200 px-4 py-2 focus-visible:ring-[#5d082a]"
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" disabled={loading} className="h-10 w-full rounded-lg bg-[#5d082a] py-2 font-medium text-white hover:bg-[#4a0622]">
        {loading && <Loader2 className="animate-spin" size={20} />}
        Redefinir senha
      </Button>
    </form>
  )
}

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  return <Shell>{token ? <ResetPasswordForm token={token} /> : <ForgotPasswordForm />}</Shell>
}
