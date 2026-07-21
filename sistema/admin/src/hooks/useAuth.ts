import { useState, useCallback } from 'react'
import { authAPI } from '../services/api'

type AdminData = {
  id: string
  email: string
  name: string
  role?: string
}

export function useAuth() {
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem('adminToken'))

  const login = useCallback(async (email: string, password: string) => {
    const response = await authAPI.login(email, password)
    const admin = response.data?.admin as AdminData | undefined

    if (!admin || admin.role !== 'admin') {
      throw new Error('Acesso negado: usuario sem permissao de administrador')
    }

    localStorage.setItem('adminToken', response.data.access_token)
    localStorage.setItem('adminData', JSON.stringify(admin))
    setIsAuth(true)
    return response.data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminData')
    setIsAuth(false)
  }, [])

  const getAdminData = useCallback(() => {
    const data = localStorage.getItem('adminData')
    if (!data) return null

    try {
      return JSON.parse(data) as AdminData
    } catch {
      return null
    }
  }, [])

  return { isAuth, login, logout, getAdminData }
}
