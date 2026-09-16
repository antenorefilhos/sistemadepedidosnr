import { createContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, authAPI, notificationsAPI, type RegisterPayload } from '../services/api'

export interface User {
  id: string
  name: string
  email?: string
  cpf?: string
  whatsapp?: string
}

export interface AuthContextData {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string, destino?: string) => Promise<void>
  register: (data: RegisterPayload) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData)

/**
 * So aceita caminho interno como destino pos-login.
 *
 * O destino vem da query string (`/login?redirect=...`), que qualquer um pode
 * montar num link. Sem esta checagem, `?redirect=https://site-falso` levaria o
 * cliente recem-autenticado pra fora do site logo apos digitar a senha --
 * open redirect, o vetor classico de phishing. `//host` tambem e externo,
 * apesar de comecar com barra.
 */
export function destinoSeguro(destino?: string) {
  if (!destino || !destino.startsWith('/') || destino.startsWith('//')) return '/'
  return destino
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setToken(storedToken)
        setUser(parsedUser)
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
      } catch (error) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string, destino?: string) => {
    setIsLoading(true)
    try {
      const response = await authAPI.login(email, password)
      const { access_token, user: userData } = response.data

      setToken(access_token)
      setUser(userData)
      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

      navigate(destinoSeguro(destino))
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  const register = useCallback(async (data: RegisterPayload) => {
    setIsLoading(true)
    try {
      const response = await authAPI.register(data)
      const { access_token, user: userData } = response.data

      setToken(access_token)
      setUser(userData)
      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

      navigate('/')
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  const logout = useCallback(() => {
    // JON-148 (Auditoria 360): logout so limpava token/dados locais -- a
    // inscricao de push continuava viva no navegador E no servidor. Em
    // aparelho compartilhado, a proxima pessoa a entrar via o push da conta
    // anterior. Best-effort, disparado ANTES de apagar o header de auth
    // (a rota exige o token desta sessao) -- nao bloqueia a navegacao se a
    // rede falhar.
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then(async (subscription) => {
          if (!subscription) return
          await notificationsAPI.unsubscribeFromPush(subscription.endpoint).catch(() => null)
          await subscription.unsubscribe().catch(() => null)
        })
        .catch(() => null)
    }

    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
    navigate('/login')
  }, [navigate])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
