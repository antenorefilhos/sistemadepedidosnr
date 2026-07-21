import { createContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, authAPI, type RegisterPayload } from '../services/api'

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
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterPayload) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData)

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

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await authAPI.login(email, password)
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
