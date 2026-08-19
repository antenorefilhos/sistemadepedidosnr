import { useEffect, useState } from 'react'
import { readDeliveryVerification, subscribeDeliveryVerification } from '../services/deliveryVerification'

/**
 * Endereco confirmado nesta etapa (ou salvo de compra anterior no mesmo
 * aparelho / resolvido por useAutoDeliveryVerification pro cliente logado)
 * ja diz a zona -- usa o freeAbove dela em vez do global assim que existir.
 */
export function useKnownZoneFreeAbove() {
  const readZoneFreeAbove = () => {
    const verification = readDeliveryVerification()
    return verification && !verification.calc.outOfArea ? verification.calc.freeAbove : undefined
  }
  const [zoneFreeAbove, setZoneFreeAbove] = useState<number | null | undefined>(readZoneFreeAbove)

  useEffect(() => subscribeDeliveryVerification(() => setZoneFreeAbove(readZoneFreeAbove())), [])

  return zoneFreeAbove
}
