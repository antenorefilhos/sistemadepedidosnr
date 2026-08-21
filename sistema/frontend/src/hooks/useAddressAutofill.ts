import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchAddressByCep,
  GPS_ACCURACY_THRESHOLD_M,
  requestCurrentPosition,
  reverseGeocode,
} from '../services/deliveryVerification'
import { isMobileDevice } from '../utils/device'

export type AddressFields = {
  zipCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  /**
   * Posicao do aparelho, preenchida so pelo GPS. E o que permite a zona por
   * poligono acertar quem mora em rua de divisa. Qualquer alteracao posterior
   * do endereco a invalida.
   */
  lat?: number | null
  lng?: number | null
}

export type LocationStatus = 'idle' | 'gps-success' | 'gps-imprecise' | 'gps-fallback'

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
  // GPS so no aparelho que o cliente carrega consigo -- desktop resolve por
  // Wi-Fi/IP e erra por quilometros mesmo "com sucesso" (ver
  // GPS_ACCURACY_THRESHOLD_M). No desktop o cliente digita CEP direto.
  const isGpsAvailable = isMobileDevice()

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
          // Endereco veio do CEP, nao do aparelho: qualquer posicao anterior
          // deixa de corresponder e nao pode decidir a zona.
          lat: null,
          lng: null,
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
    if (!isGpsAvailable) {
      setLocationStatus('gps-fallback')
      return
    }
    try {
      setGeoLoading(true)
      const position = await requestCurrentPosition()
      const normalized = await reverseGeocode(position.lat, position.lng)
      // Desktop resolve geolocalizacao por Wi-Fi/IP e pode errar por
      // quilometros mesmo "com sucesso" -- so confia na coordenada bruta pra
      // decidir zona quando a precisao reportada e digna de GPS de celular.
      // Fora disso deixa lat/lng nulos: verifyDeliveryForAddress cai no
      // geocode do endereco completo pelo Mapbox, que testado bate certo.
      const isPreciseEnough =
        position.accuracy == null || position.accuracy <= GPS_ACCURACY_THRESHOLD_M

      setFormData((prev) => ({
        ...prev,
        zipCode: normalized.zipCode || prev.zipCode,
        street: normalized.street || prev.street,
        // Numero nunca vem de GPS/reverse-geocode, nem quando a base do IBGE
        // devolve um numero predial real -- preserva o que o cliente ja
        // digitou (ou deixa vazio) de proposito, pra ele sempre confirmar o
        // numero dele mesmo em vez de aceitar um "proximo" errado calado.
        number: prev.number,
        neighborhood: normalized.neighborhood || prev.neighborhood,
        city: normalized.city || prev.city,
        state: normalized.state || prev.state,
        lat: isPreciseEnough ? position.lat : null,
        lng: isPreciseEnough ? position.lng : null,
      }))
      setLocationStatus(isPreciseEnough ? 'gps-success' : 'gps-imprecise')
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
    if (!autoGpsEnabled || !isGpsAvailable) return
    if (gpsAttemptedRef.current) return

    gpsAttemptedRef.current = true
    attemptAddressByGps()
  }, [autoGpsEnabled, attemptAddressByGps])

  return {
    cepLoading,
    cepAutoFilled,
    geoLoading,
    locationStatus,
    isGpsAvailable,
    handleCepBlur,
    handleUseMyLocation,
  }
}
