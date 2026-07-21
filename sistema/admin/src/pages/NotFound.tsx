import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="max-w-md w-full bg-white shadow rounded-lg p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">404 - Pagina nao encontrada</h1>
        <p className="text-gray-600 mb-4">A rota informada nao existe no painel administrativo.</p>
        <Link to="/" className="inline-block px-4 py-2 rounded bg-[#5d082a] text-white hover:bg-[#4a0622]">
          Ir para inicio
        </Link>
      </div>
    </div>
  )
}
