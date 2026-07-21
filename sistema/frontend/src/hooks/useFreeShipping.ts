import { useMemo } from 'react'
import { useBrand } from './useBrand'

export interface FreeShippingInfo {
  enabled: boolean
  threshold: number
  remaining: number
  achieved: boolean
  pct: number // 0–100
}

export function useFreeShipping(subtotal: number): FreeShippingInfo {
  const brand = useBrand()

  return useMemo(() => {
    const threshold = brand.freeShippingThreshold
    if (!threshold || threshold <= 0) {
      return { enabled: false, threshold: 0, remaining: 0, achieved: false, pct: 0 }
    }
    const remaining = Math.max(0, threshold - subtotal)
    const achieved = subtotal >= threshold
    const pct = Math.min(100, Math.round((subtotal / threshold) * 100))
    return { enabled: true, threshold, remaining, achieved, pct }
  }, [brand.freeShippingThreshold, subtotal])
}
