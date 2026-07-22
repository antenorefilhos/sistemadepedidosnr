import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchAddressByCep,
  requestCurrentPosition,
  reverseGeocodeByMapbox,
} from '../services/deliveryVerification'

export type AddressFields = {
  zipCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
}

export type LocationStatus = 'idle' | 'gps-success' | 'gps-fallback'

type UseAddressAutofillInput<T extends AddressFields> = {
  formData: T
  setFormData: React.Dispatch<React.SetStateAction<T>>
  /** Quando true, tenta preencher por GPS uma unica vez. */
  autoGpsEnabled: boolean
}

/**
 * Preenchimento automatico de endereco no checkout.
 *
 * Duas fontes, na ordem: GPS (uma tentativa automatica ao entrar na etapa de
 * endereco, mais tentativas manuais) e consulta por CEP no blur do campo.
 * Nenhuma das duas sobrescreve valor ja digitado pelo cliente — cada campo so
 * e preenchido quando a fonte devolve algo.
 */
export function useAddressAutofill<T extends AddressFields>({
  formData,
  setFormData,
  autoGpsEnabled,
}: UseAddressAutofillInput<T>) {
  const [cepLoading, setCepLoading] = useState(false)
  const [cepAutoFilled, setCepAutoFilled] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const gpsAttemptedRef = useRef(false)

  const handleCepBlur = useCallback(
    async (cep: string) => {
      if (cep.replace(/\D/g, '').length !== 8) return

      setCepLoading(true)
      setCepAutoFilled(false)
      try {
        const found = await fetchAddressByCep(cep, {
          street: formData.street,
          number: formData.number,
          complement: formData.complement || null,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
        })

        if (found.street || found.neighborhood) {
          setCepAutoFilled(true)
          setTimeout(() => setCepAutoFilled(false), 3000)
        }

        setFormData((prev) => ({
          ...prev,
          zipCode: found.zipCode || prev.zipCode,
          street: found.street || prev.street,
          neighborhood: found.neighborhood || prev.neighborhood,
          city: found.city || prev.city,
          state: found.state || prev.state,
        }))
      } catch {
        // CEP invalido ou servico fora do ar: mantem o que o cliente digitou.
      } finally {
        setCepLoading(false)
      }
    },
    [
      formData.city,
      formData.complement,
      formData.neighborhood,
      formData.number,
      formData.state,
      formData.street,
      formData.zipCode,
      setFormData,
    ],
  )

  const attemptAddressByGps = useCallback(async () => {
    try {
      setGeoLoading(true)
      const position = await requestCurrentPosition()
      const normalized = await reverseGeocodeByMapbox(position.lat, position.lng)

      setFormData((prev) => ({
        ...prev,
        zipCode: normalized.zipCode || prev.zipCode,
        street: normalized.street || prev.street,
        number: normalized.number || prev.number,
        neighborhood: normalized.neighborhood || prev.neighborhood,
        city: normalized.city || prev.city,
        state: normalized.state || prev.state,
      }))
      setLocationStatus('gps-success')
    } catch {
      setLocationStatus('gps-fallback')
    } finally {
      setGeoLoading(false)
    }
  }, [setFormData])

  const handleUseMyLocation = useCallback(async () => {
    gpsAttemptedRef.current = true
    await attemptAddressByGps()
  }, [attemptAddressByGps])

  // Uma unica tentativa automatica por sessao de checkout.
  useEffect(() => {
    if (!autoGpsEnabled) return
    if (gpsAttemptedRef.current) return

    gpsAttemptedRef.current = true
    attemptAddressByGps()
  }, [autoGpsEnabled, attemptAddressByGps])

  return {
    cepLoading,
    cepAutoFilled,
    geoLoading,
    locationStatus,
    handleCepBlur,
    handleUseMyLocation,
  }
}
