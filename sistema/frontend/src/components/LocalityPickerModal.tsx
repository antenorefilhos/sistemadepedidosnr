import { ChevronRight, X } from 'lucide-react'
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
}: {
  open: boolean
  options: LocalityOption[]
  selectedCode?: string | null
  onSelect: (option: LocalityOption) => void
  onClose: () => void
}) {
  if (!open || options.length === 0) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 md:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="locality-modal-title"
        className={surfaceClasses({
          tone: 'warm',
          className:
            'w-full md:max-w-md rounded-t-2xl md:rounded-lg p-4 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain',
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

        <div className="space-y-2">
          {options.map((option) => (
            <button
              key={`${option.code}--${option.name}`}
              type="button"
              aria-pressed={selectedCode === option.code}
              onClick={() => onSelect(option)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3.5 text-left text-sm font-semibold text-[#231F20] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D2BB8A]/50 ${
                selectedCode === option.code
                  ? 'border-[#5D082A] bg-[#FFF7FA]'
                  : 'border-[#E8D7B0] bg-white hover:border-[#5D082A] hover:bg-[#FFF7FA]'
              }`}
            >
              <span className="min-w-0">{option.name}</span>
              <ChevronRight size={16} className="shrink-0 text-[#D2BB8A]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
