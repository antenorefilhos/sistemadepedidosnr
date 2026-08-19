import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { addressesAPI } from '../services/api'
import { readDeliveryVerification, saveDeliveryVerification, verifyDeliveryForAddress } from '../services/deliveryVerification'

/**
 * Cliente logado sem endereco verificado nesta sessao/aparelho (localStorage
 * vazio) ficava sem zona conhecida pra barra de frete gratis -- so quem
 * tinha acabado de digitar CEP/GPS via -- mesmo tendo endereco salvo no
 * cadastro. Roda uma vez por login e resolve a zona pelo endereco padrao
 * (ou mais recente) do cliente, do mesmo jeito que a etapa de endereco do
 * checkout faria.
 */
export function useAutoDeliveryVerification() {
  const { user } = useAuth()
  const attempted = useRef<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    if (readDeliveryVerification()) return
    if (attempted.current === user.id) return
    attempted.current = user.id

    let cancelled = false
    ;(async () => {
      try {
        const res = await addressesAPI.list(user.id)
        const address = res.data?.[0]
        if (!address || cancelled) return

        const calc = await verifyDeliveryForAddress({
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
        })
        if (cancelled) return
        saveDeliveryVerification({ address, calc, verifiedAt: new Date().toISOString() })
      } catch {
        // sem endereco salvo ou falha na consulta: barra segue desabilitada, sem travar a tela
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])
}
