import { useState } from 'react'
import { LogIn, Loader2 } from 'lucide-react'
import { pickerApi } from '../services/api'
import toast from 'react-hot-toast'

export default function Login({ onLogin }: { onLogin: (name: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      const { data } = await pickerApi.login(email.trim(), password)
      const user = data.admin
      if (!['picker', 'admin'].includes(user.role)) {
        toast.error('Acesso restrito a separadores')
        setLoading(false)
        return
      }
      localStorage.setItem('picker_token', data.access_token)
      localStorage.setItem('picker_user', JSON.stringify(user))
      onLogin(user.name)
    } catch {
      toast.error('Email ou senha invalidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-brand-600 px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Separacao</h1>
          <p className="text-white/60 text-sm mt-1">Antenor & Filhos</p>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="w-full h-12 px-4 rounded-xl bg-white/10 text-white placeholder:text-white/40 border border-white/20 focus:outline-none focus:border-white/50 text-base"
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full h-12 px-4 rounded-xl bg-white/10 text-white placeholder:text-white/40 border border-white/20 focus:outline-none focus:border-white/50 text-base"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-white text-brand-600 font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
