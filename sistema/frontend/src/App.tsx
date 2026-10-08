import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import { useAutoDeliveryVerification } from './hooks/useAutoDeliveryVerification'
import { useNotificationOpened } from './hooks/useNotificationOpened'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NetworkToast } from './components/NetworkToast'
import { PageTransition } from './components/PageTransition'
import { DeliveryVerificationModal } from './components/DeliveryVerificationModal'
import { DeliveryVerificationModalProvider } from './contexts/DeliveryVerificationModalContext'
import { Loader2 } from 'lucide-react'
import './App.css'

// Lazy Loading Pages
const Home = lazy(() => import('./pages/Home'))
const Cart = lazy(() => import('./pages/Cart'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Account = lazy(() => import('./pages/Account'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const WinePage = lazy(() => import('./pages/WinePage'))
const SearchPage = lazy(() => import('./pages/Search'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Forbidden = lazy(() => import('./pages/Forbidden'))
const NotFound = lazy(() => import('./pages/NotFound'))
const RecipeList = lazy(() => import('./pages/RecipeList'))
const RecipeDetail = lazy(() => import('./pages/RecipeDetail'))
const Promocoes = lazy(() => import('./pages/Promocoes'))
const Encarte = lazy(() => import('./pages/Encarte'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'))

// Enderecos em portugues (08/10/2026): /account, /cart, /checkout, /login,
// /register e /forbidden viraram /minha-conta, /carrinho, /finalizar-compra,
// /entrar, /cadastro e /acesso-negado. Os antigos continuam abrindo -- avisos,
// mensagens, banners e favoritos ja enviados -- e levam junto a query
// (?redirect=, ?coupon=, ?aba=) e o state.
function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${to}${location.search}${location.hash}`} state={location.state} replace />
}

function LegacySearchRedirect() {
  const location = useLocation()
  return <Navigate to={`/mercado${location.search}`} replace />
}

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-white">
    <Loader2 className="animate-spin text-[#5D082A]" size={40} />
  </div>
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Não retry em 4xx client errors
        if (error.response?.status >= 400 && error.response?.status < 500) {
          return false
        }
        // Retry max 1x em 5xx ou network errors, com backoff mais curto
        return failureCount < 1
      },
      retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 3000),
      staleTime: 1000 * 60 * 5, // 5 min padrão
      cacheTime: 1000 * 60 * 10, // cache por 10 min
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Não retry em 4xx: sao erros definitivos de negocio (ex.: sessao de
        // checkout marcada FAILED apos rejeicao), reenviar so troca o erro
        // real por "Sessao nao esta ativa" 1s depois.
        if (error.response?.status >= 400 && error.response?.status < 500) {
          return false
        }
        return failureCount < 1
      },
      retryDelay: (attemptIndex) => Math.min(1000 * (2 ** attemptIndex), 3000),
    },
  },
})

interface ProtectedRouteProps {
  children: React.ReactNode
  isAuthenticated: boolean
  isLoading: boolean
}

function ProtectedRoute({ children, isAuthenticated, isLoading }: ProtectedRouteProps) {
  const location = useLocation()
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  // Volta para a pagina pedida depois do login (antes caia na Home: quem tocava
  // em "Conta" ou abria o link do pedido tinha que achar o caminho de novo).
  return isAuthenticated ? <>{children}</> : <Navigate to={`/entrar?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth()
  const guestCheckoutEnabled = (import.meta.env.VITE_GUEST_CHECKOUT_ENABLED ?? 'true') !== 'false'
  const location = useLocation()
  useAutoDeliveryVerification()
  useNotificationOpened()

  return (
    <Suspense fallback={<PageLoader />}>
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/entrar" element={<PageTransition><Login /></PageTransition>} />
          <Route path="/cadastro" element={<PageTransition><Register /></PageTransition>} />
          <Route path="/login" element={<LegacyRedirect to="/entrar" />} />
          <Route path="/register" element={<LegacyRedirect to="/cadastro" />} />
          <Route path="/esqueci-minha-senha" element={<PageTransition><ForgotPassword /></PageTransition>} />
          <Route path="/redefinir-senha" element={<PageTransition><ResetPassword /></PageTransition>} />
          <Route path="/acesso-negado" element={<PageTransition><Forbidden /></PageTransition>} />
          <Route path="/forbidden" element={<LegacyRedirect to="/acesso-negado" />} />
          <Route path="/vinhos" element={<PageTransition><WinePage /></PageTransition>} />
          <Route path="/adega" element={<PageTransition><WinePage /></PageTransition>} />
          <Route path="/adega-antenor" element={<PageTransition><WinePage /></PageTransition>} />
          <Route path="/mercado" element={<PageTransition><SearchPage /></PageTransition>} />
          <Route path="/busca" element={<LegacySearchRedirect />} />
          <Route path="/p/:slug" element={<PageTransition><ProductDetail /></PageTransition>} />
          <Route path="/produto/:id" element={<PageTransition><ProductDetail /></PageTransition>} />
          <Route path="/receitas" element={<PageTransition><RecipeList /></PageTransition>} />
          <Route path="/receitas/:slug" element={<PageTransition><RecipeDetail /></PageTransition>} />
          <Route path="/promocoes" element={<PageTransition><Promocoes /></PageTransition>} />
          <Route path="/encarte/:erpCampaignId" element={<PageTransition><Encarte /></PageTransition>} />
          <Route path="/privacidade" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
          <Route path="/termos" element={<PageTransition><TermsOfUse /></PageTransition>} />

          <Route path="/" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/carrinho" element={<PageTransition><Cart /></PageTransition>} />
          <Route path="/cart" element={<LegacyRedirect to="/carrinho" />} />
          <Route path="/checkout" element={<LegacyRedirect to="/finalizar-compra" />} />
          <Route
            path="/finalizar-compra"
            element={
              guestCheckoutEnabled ? (
                <PageTransition><Checkout /></PageTransition>
              ) : (
                <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
                  <PageTransition><Checkout /></PageTransition>
                </ProtectedRoute>
              )
            }
          />
          <Route path="/account" element={<LegacyRedirect to="/minha-conta" />} />
          <Route
            path="/minha-conta"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
                <PageTransition><Account /></PageTransition>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DeliveryVerificationModalProvider>
            <NetworkToast />
            <Toaster
              position="bottom-center"
              gutter={8}
              toastOptions={{
                duration: 2600,
                style: {
                  background: '#5D082A',
                  color: '#FBF7F0',
                  border: '1px solid #D2BB8A',
                  fontSize: '0.875rem', // degrau `body` da rampa do DESIGN.md
                  fontWeight: 600,
                  maxWidth: '92vw',
                },
                success: {
                  iconTheme: { primary: '#D2BB8A', secondary: '#5D082A' },
                },
              }}
            />
            <DeliveryVerificationModal />
            <AppRoutes />
          </DeliveryVerificationModalProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App