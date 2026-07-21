import { useEffect, useState, useCallback } from 'react'
import { getDeliveryOperationStatus, getDeliveryOperationStatusWithConfig, type DeliveryOperationStatus } from '../utils/deliveryOperation'
import { useBrand } from './useBrand'

export function useDeliveryOperation(): DeliveryOperationStatus {
  const brand = useBrand()

  const compute = useCallback((): DeliveryOperationStatus => {
    if (brand.businessHours) {
      try {
        const weekly = JSON.parse(brand.businessHours)
        return getDeliveryOperationStatusWithConfig({
          weekly,
          openMessage: brand.openMessage ?? undefined,
          closedMessage: brand.closedMessage ?? undefined,
          countdownLabel: brand.countdownLabel ?? undefined,
        })
      } catch {
        // JSON inválido → fallback ao config estático
      }
    }
    return getDeliveryOperationStatus()
  }, [brand.businessHours, brand.openMessage, brand.closedMessage, brand.countdownLabel])

  const [status, setStatus] = useState<DeliveryOperationStatus>(compute)

  useEffect(() => {
    setStatus(compute())
    const timer = window.setInterval(() => setStatus(compute()), 1000)
    return () => window.clearInterval(timer)
  }, [compute])

  return status
}
