export type FractionalSource = {
  isFractional?: boolean | null
  fractionStep?: number | null
  manualIsFractional?: boolean | null
  manualFractionStep?: number | null
}

export type EffectiveFractional = {
  isFractional: boolean
  fractionStep: number | null
  fractionalSource: 'erp' | 'manual' | null
}

/**
 * O ERP (Solidcom) e a fonte master de isFractional/fractionStep. O override
 * manual (manualIsFractional/manualFractionStep, editavel no admin) so entra
 * em jogo quando o ERP nao informa fracionamento -- nunca sobrescreve o dado
 * do ERP. Serve de fallback e de continuidade caso o ERP mude no futuro.
 */
export function resolveEffectiveFractional(product: FractionalSource): EffectiveFractional {
  if (product.isFractional && product.fractionStep && product.fractionStep > 0) {
    return { isFractional: true, fractionStep: product.fractionStep, fractionalSource: 'erp' }
  }
  if (product.manualIsFractional && product.manualFractionStep && product.manualFractionStep > 0) {
    return { isFractional: true, fractionStep: product.manualFractionStep, fractionalSource: 'manual' }
  }
  return { isFractional: false, fractionStep: null, fractionalSource: null }
}
