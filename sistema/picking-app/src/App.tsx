import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import OrderList from './pages/OrderList'
import OrderPicking from './pages/OrderPicking'
import { usePushEquipe } from '@antenor/push-client'
import api from './services/api'

type Screen = { page: 'login' } | { page: 'orders' } | { page: 'picking'; orderId: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ page: 'login' })
  const [userName, setUserName] = useState('')
  const { desinscrever } = usePushEquipe({ api, vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY })

  useEffect(() => {
    const token = localStorage.getItem('picker_token')
    const user = localStorage.getItem('picker_user')
    if (token && user) {
      try {
        const parsed = JSON.parse(user)
        setUserName(parsed.name || '')
        setScreen({ page: 'orders' })
      } catch {
        localStorage.removeItem('picker_token')
        localStorage.removeItem('picker_user')
      }
    }
  }, [])

  const handleLogin = (name: string) => {
    setUserName(name)
    setScreen({ page: 'orders' })
  }

  const handleLogout = () => {
    // JON-148 (Auditoria 360): dispara ANTES de apagar o token -- a rota de
    // remocao exige a sessao atual.
    void desinscrever()
    localStorage.removeItem('picker_token')
    localStorage.removeItem('picker_user')
    setUserName('')
    setScreen({ page: 'login' })
  }

  return (
    <div className="h-full flex flex-col">
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      {screen.page === 'login' && <Login onLogin={handleLogin} />}
      {screen.page === 'orders' && (
        <OrderList
          userName={userName}
          onSelectOrder={(id) => setScreen({ page: 'picking', orderId: id })}
          onLogout={handleLogout}
        />
      )}
      {screen.page === 'picking' && (
        <OrderPicking
          orderId={screen.orderId}
          onBack={() => setScreen({ page: 'orders' })}
        />
      )}
    </div>
  )
}
