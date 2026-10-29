import { useEffect } from 'react'
import { Wine } from 'lucide-react'
import { useAgeVerification } from '../contexts/AgeVerificationContext'
import { Button } from './ui/button'
import { surfaceClasses } from './ui/surface'

// AEF-062 (29/10/2026): aparece quando o cliente mexe em produto de bebida
// alcoolica ou tabacaria (preco escondido, "Adicionar" chama requestVerification
// antes de agir). Confirmar libera o site inteiro pelo resto da sessao; cancelar
// so fecha -- o cliente continua navegando no resto da loja normalmente.
export function AgeVerificationModal() {
  const { isOpen, confirm, cancel } = useAgeVerification()

  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, cancel])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 md:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-verification-title"
        className={surfaceClasses({
          tone: 'warm',
          className: 'w-full max-w-sm rounded-t-2xl p-5 shadow-2xl md:rounded-lg',
        })}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#5D082A] text-white">
            <Wine size={22} />
          </span>
          <h3 id="age-verification-title" className="text-lg font-black leading-tight tracking-tight text-[#231F20]">
            Você tem 18 anos ou mais?
          </h3>
          <p className="text-sm text-[#5d4f33]">
            Este item é bebida alcoólica ou produto de tabacaria. A venda é proibida para menores de 18 anos (ECA, art. 81).
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" onClick={confirm} size="lg" className="w-full text-base" autoFocus>
            Sim, tenho 18 anos ou mais
          </Button>
          <Button type="button" onClick={cancel} variant="ghost" className="w-full text-[#5d4f33] hover:bg-[#F8F4EA]">
            Não, voltar
          </Button>
        </div>
      </div>
    </div>
  )
}
