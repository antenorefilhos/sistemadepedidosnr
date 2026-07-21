import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('adminToken')
  const adminRaw = localStorage.getItem('adminData')

  let isAdmin = false
  if (adminRaw) {
    try {
      const admin = JSON.parse(adminRaw)
      isAdmin = admin?.role === 'admin'
    } catch {
      isAdmin = false
    }
  }
  
  if (!token || !isAdmin) {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminData')
    return <Navigate to="/login" />
  }

  return <>{children}</>
}
