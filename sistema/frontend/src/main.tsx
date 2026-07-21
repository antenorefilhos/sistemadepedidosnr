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
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Sem bloqueio funcional: notificações in-app continuam funcionando
    })
  })
}