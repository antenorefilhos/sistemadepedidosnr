import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import RouteList from './pages/RouteList'
import RouteDetail from './pages/RouteDetail'

type Screen = { page: 'login' } | { page: 'routes' } | { page: 'route'; routeId: string }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ page: 'login' })
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('driver_token')
    const user = localStorage.getItem('driver_user')
    if (token && user) {
      try {
        const parsed = JSON.parse(user)
        setUserName(parsed.name || '')
        setScreen({ page: 'routes' })
      } catch {
        localStorage.removeItem('driver_token')
        localStorage.removeItem('driver_user')
      }
    }
  }, [])

  const handleLogin = (name: string) => {
    setUserName(name)
    setScreen({ page: 'routes' })
  }

  const handleLogout = () => {
    localStorage.removeItem('driver_token')
    localStorage.removeItem('driver_user')
    setUserName('')
    setScreen({ page: 'login' })
  }

  return (
    <div className="h-full flex flex-col">
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      {screen.page === 'login' && <Login onLogin={handleLogin} />}
      {screen.page === 'routes' && (
        <RouteList
          userName={userName}
          onSelectRoute={(id) => setScreen({ page: 'route', routeId: id })}
          onLogout={handleLogout}
        />
      )}
      {screen.page === 'route' && (
        <RouteDetail
          routeId={screen.routeId}
          onBack={() => setScreen({ page: 'routes' })}
        />
      )}
    </div>
  )
}
