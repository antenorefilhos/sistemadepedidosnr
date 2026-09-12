import { useEffect } from 'react'
import { SearchX, X } from 'lucide-react'
import { Button } from './ui/button'
import { surfaceClasses } from './ui/surface'

export interface LocalityOption {
  name: string
  code: string
}

/**
 * Escolha da localidade/condominio quando um CEP cobre mais de um ponto de
 * entrega (ex.: 25750-222 vai de Chafariz a um condominio 2km mais longe).
 *
 * E modal, e nao um bloco na pagina, porque no celular a lista caia abaixo da
 * dobra: o cliente via o aviso de "escolha sua localidade", nao percebia que
 * havia opcoes logo abaixo, e ficava travado sem saber por que o botao de
 * avancar nao funcionava. Sem escolher, o backend nao libera a etapa
 * (`requiresLocalitySelection`), entao essa lista nao e um detalhe -- e o
 * caminho unico.
 *
 * Extraido do DeliveryVerificationModal, onde ja existia, para o checkout usar
 * a mesma coisa: eram duas telas com a mesma decisao e comportamentos
 * diferentes.
 */
export function LocalityPickerModal({
  open,
  options,
  selectedCode,
  onSelect,
  onClose,
  onNone,
}: {
  open: boolean
  options: LocalityOption[]
  selectedCode?: string | null
  onSelect: (option: LocalityOption) => void
  onClose: () => void
  /**
   * GPS perto da divisa de duas localidades erra com frequencia (ex.: cliente
   * mora exatamente no limite dos CEPs de "Chafariz" e do condominio vizinho).
   * Sem uma saida explicita, o cliente tentava clicar numa opcao errada por
   * eliminacao. "Nenhuma dessas" fecha o modal e devolve pro campo de CEP em
   * branco, pra digitar o correto do zero em vez de adivinhar entre as
   * sugestoes.
   */
  onNone?: () => void
}) {
  // Trava o scroll do body enquanto o modal esta aberto -- sem isso, arrastar
  // dentro da lista de opcoes (celular) vazava o gesto pro fundo da pagina
  // por baixo do overlay. Self-contido (nao depende do modal pai ja travar),
  // porque o Checkout usa este modal fora de qualquer outro que trave scroll.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open || options.length === 0) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overscroll-none bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="locality-modal-title"
        className={surfaceClasses({
          tone: 'warm',
          className: 'w-full max-w-md rounded-2xl p-4 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain',
        })}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 id="locality-modal-title" className="text-lg font-black leading-tight tracking-tight text-[#231F20]">
            Selecione sua localidade ou condomínio
          </h3>
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="-mr-1 -mt-1 shrink-0"
            aria-label="Fechar seleção de localidade"
          >
            <X size={18} />
          </Button>
        </div>

        <p className="mb-4 text-xs text-[#5d4f33]">O CEP informado atende diferentes pontos da região.</p>

        <div className="grid grid-cols-2 gap-2">
          {options.map((option) => (
            <button
              key={`${option.code}--${option.name}`}
              type="button"
              aria-pressed={selectedCode === option.code}
              onClick={() => onSelect(option)}
              className={`flex min-h-[4.5rem] items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-semibold leading-snug break-words text-[#231F20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D2BB8A]/50 ${
                selectedCode === option.code
                  ? 'border-[#5D082A] bg-[#FFF7FA]'
                  : 'border-[#E8D7B0] bg-white hover:border-[#5D082A] hover:bg-[#FFF7FA]'
              }`}
            >
              {option.name}
            </button>
          ))}
        </div>

        {onNone && (
          <Button
            type="button"
            onClick={onNone}
            className="mt-5 w-full gap-2 bg-[#5D082A] py-3 text-sm font-bold text-white shadow-md hover:bg-[#4a0621]"
          >
            <SearchX size={16} />
            Nenhuma dessas — digitar meu CEP
          </Button>
        )}
      </div>
    </div>
  )
}
