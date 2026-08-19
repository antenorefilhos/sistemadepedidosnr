import { useMemo } from 'react'
import { useBrand } from './useBrand'

export interface FreeShippingInfo {
  enabled: boolean
  threshold: number
  remaining: number
  achieved: boolean
  pct: number // 0–100
}

/**
 * `zoneFreeAbove` deixa a zona de entrega sobrepor o valor minimo global
 * (regra de negocio: zona configurada vence o global, sempre). Passar:
 * - `undefined` (default): zona ainda nao conhecida (endereco nao validado
 *   ainda) -- usa o global como estimativa.
 * - `null`: zona ja conhecida e ela nao tem frete gratis por valor -- barra
 *   fica desabilitada mesmo se houver um global configurado, senao promete
 *   um frete gratis que aquela zona nao concede.
 * - numero: valor minimo da propria zona, usado no lugar do global.
 */
export function useFreeShipping(subtotal: number, zoneFreeAbove?: number | null): FreeShippingInfo {
  const brand = useBrand()

  return useMemo(() => {
    const threshold = zoneFreeAbove !== undefined ? zoneFreeAbove : brand.freeShippingThreshold
    if (!threshold || threshold <= 0) {
      return { enabled: false, threshold: 0, remaining: 0, achieved: false, pct: 0 }
    }
    const remaining = Math.max(0, threshold - subtotal)
    const achieved = subtotal >= threshold
    const pct = Math.min(100, Math.round((subtotal / threshold) * 100))
    return { enabled: true, threshold, remaining, achieved, pct }
  }, [brand.freeShippingThreshold, zoneFreeAbove, subtotal])
}
