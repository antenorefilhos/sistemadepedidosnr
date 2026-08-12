import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { CartProvider } from './contexts/CartContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <CartProvider>
          <App />
        </CartProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
)

// Core Web Vitals — coleta métricas reais; exibidas no console em dev
if (import.meta.env.DEV) {
  import('web-vitals').then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
    onCLS(console.info)
    onFCP(console.info)
    onLCP(console.info)
    onTTFB(console.info)
    onINP(console.info)
  })
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // updateViaCache: 'none' + update() explicito -- o header no-store do
    // nginx no service-worker.js nao basta: Safari/iOS (e as vezes Chrome
    // Android) tem bug conhecido de ignorar no-store so pra checagem de SW,
    // servindo a versao antiga do arquivo indefinidamente ate o cache do
    // navegador expirar por conta propria. Sem isso, mudanca nenhuma no
    // storefront chegava em quem ja tinha visitado antes (so em aba anonima).
    navigator.serviceWorker
      .register('/service-worker.js', { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch(() => {
        // Sem bloqueio funcional: notificações in-app continuam funcionando
      })
  })
}