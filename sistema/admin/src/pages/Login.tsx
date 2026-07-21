import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Loader2 } from 'lucide-react'
import { getApiErrorMessage } from '../services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const HORIZONTAL_LOGO_SRC = '/branding/logo-horizontal-bordo.png'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Erro ao fazer login'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#5d082a] to-[#3a0418] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <img
          src={HORIZONTAL_LOGO_SRC}
          alt="Antenor & Filhos"
          className="mx-auto mb-8 h-16 w-auto object-contain"
        />

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="admin-email" className="mb-2 block font-medium">
              Email
            </Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 rounded-lg border-gray-200 px-4 py-2 focus-visible:ring-[#5d082a]"
              placeholder="admin@mercado.com"
            />
          </div>

          <div>
            <Label htmlFor="admin-password" className="mb-2 block font-medium">
              Senha
            </Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 rounded-lg border-gray-200 px-4 py-2 focus-visible:ring-[#5d082a]"
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-lg bg-[#5d082a] py-2 font-medium text-white hover:bg-[#4a0622]"
          >
            {loading && <Loader2 className="animate-spin" size={20} />}
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
