import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Service worker so pra Web Push (ver public/service-worker.js).
// updateViaCache 'none' + update() explicito: sem isso, navegador que ja
// visitou serve a versao velha do SW indefinidamente e correcao nenhuma
// chega em quem mais precisa -- o funcionario que usa o app todo dia.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { updateViaCache: 'none' })
      .then((registro) => registro.update())
      .catch(() => {
        // Sem push o app continua funcionando -- so nao avisa sozinho.
      })
  })
}
