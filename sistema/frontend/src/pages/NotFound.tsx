import { Link } from 'react-router-dom'
import { buttonVariants } from '../components/ui/button'
import { surfaceClasses } from '../components/ui/surface'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F8F4EA] via-[#FBFAF7] to-white p-6">
      <div className={surfaceClasses({ tone: 'warm', className: 'max-w-md w-full p-6 text-center' })}>
        <h1 className="text-2xl font-bold text-[#231F20] mb-2">404 - Página não encontrada</h1>
        <p className="text-gray-600 mb-4">A rota acessada não existe.</p>
        <Link to="/" className={buttonVariants({ variant: 'primary', size: 'md' })}>
          Ir para início
        </Link>
      </div>
    </div>
  )
}
