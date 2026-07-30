import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import OrderList from './pages/OrderList'
import OrderPicking from './pages/OrderPicking'

type Screen = { page: 'login' } | { page: 'orders' } | { page: 'picking'; orderId: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ page: 'login' })
  const [userName, setUserName] = useState('')

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
