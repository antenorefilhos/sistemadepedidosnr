import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Aba "Regras" de DeliveryZones -- extraida (JON-65, Auditoria 360) por so
 * depender de props/callbacks, sem estado ou efeito proprio. */
export function DeliveryZonesRulesTab({
  freeShippingThreshold, onFreeShippingThresholdChange, onNumberFocus,
  onSave, savePending, thresholdDirty, onUndo,
}: {
  freeShippingThreshold: number | null;
  onFreeShippingThresholdChange: (value: number | null) => void;
  onNumberFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  onSave: () => void;
  savePending: boolean;
  thresholdDirty: boolean;
  onUndo: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm max-w-2xl">
      <p className="text-sm font-semibold text-gray-700 mb-2">Frete gratis global (regra do carrinho)</p>
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={freeShippingThreshold ?? ''}
          onChange={(e) => onFreeShippingThresholdChange(e.target.value ? Number(e.target.value) : null)}
          onFocus={onNumberFocus}
          className="w-56"
          placeholder="Ex: 150,00"
        />
        <Button type="button" onClick={onSave} disabled={savePending || !thresholdDirty}>
          {savePending ? 'Salvando...' : 'Salvar valor minimo'}
        </Button>
        {thresholdDirty && !savePending && (
          <Button type="button" variant="ghost" size="sm" onClick={onUndo}>
            Desfazer
          </Button>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Deixe em branco para desativar. Essa regra convive com as regras por zona (CEP/poligono).
      </p>
    </div>
  )
}
