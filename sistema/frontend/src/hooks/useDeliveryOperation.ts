import { useEffect, useMemo, useState } from 'react'
import { getDeliveryOperationStatusWithConfig, getFulfillmentWeekday, parseHoursConfig, type DeliveryOperationStatus, type HoursConfig } from '../utils/deliveryOperation'
import { useBrand } from './useBrand'

/** Horario de entrega configurado no admin (semana + datas especiais). */
export function useHoursConfig(): HoursConfig {
  const { businessHours, specialDates } = useBrand()
  return useMemo(() => parseHoursConfig(businessHours, specialDates), [businessHours, specialDates])
}

/** Dia da semana que vale para os dias de venda do produto: o da entrega de um pedido feito agora. */
export function useSaleWeekday(): number {
  return getFulfillmentWeekday(useHoursConfig())
}

export function useDeliveryOperation(): DeliveryOperationStatus {
  const config = useHoursConfig()
  const [status, setStatus] = useState(() => getDeliveryOperationStatusWithConfig(config))

  useEffect(() => {
    const update = () => {
      const next = getDeliveryOperationStatusWithConfig(config)
      setStatus((prev) => (prev.message === next.message && prev.note === next.note ? prev : next))
    }
    update()
    // A mensagem tem precisao de minuto: atualizar a cada segundo re-renderizava a Home inteira a toa.
    const timer = window.setInterval(update, 30_000)
    return () => window.clearInterval(timer)
  }, [config])

  return status
}
