import { Suspense, lazy, useMemo } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NetworkToast } from './components/NetworkToast'
import './App.css'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Login = lazy(() => import('./pages/Login'))
const Forbidden = lazy(() => import('./pages/Forbidden'))
const NotFound = lazy(() => import('./pages/NotFound'))

function App() {
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NetworkToast />
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Carregando...</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forbidden" element={<Forbidden />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
