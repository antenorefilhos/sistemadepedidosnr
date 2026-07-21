import { Link } from 'react-router-dom'
import { buttonVariants } from '../components/ui/button'
import { surfaceClasses } from '../components/ui/surface'

export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F8F4EA] via-[#FBFAF7] to-white p-6">
      <div className={surfaceClasses({ tone: 'warm', className: 'max-w-md w-full p-6 text-center' })}>
        <h1 className="text-2xl font-bold text-[#5D082A] mb-2">403 - Acesso negado</h1>
        <p className="text-gray-600 mb-4">Você não possui permissão para acessar esta área.</p>
        <Link to="/" className={buttonVariants({ variant: 'primary', size: 'md' })}>
          Voltar para início
        </Link>
      </div>
    </div>
  )
}
