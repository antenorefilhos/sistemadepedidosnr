import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDeliveryVerificationModal } from '../contexts/DeliveryVerificationModalContext'
import { useDeliveryAddress } from '../hooks/useDeliveryAddress'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { surfaceClasses } from './ui/surface'
import { cn } from '../lib/cn'
import {
  fetchAddressByCep,
  formatZipCode,
  GPS_ACCURACY_THRESHOLD_M,
  readDeliveryVerification,
  requestCurrentPosition,
  reverseGeocodeByMapbox,
  saveDeliveryVerification,
  verifyDeliveryForAddress,
  type DeliveryCalcSnapshot,
} from '../services/deliveryVerification'
import { dropStaleCoords, type DeliveryAddressSnapshot } from '../utils/deliveryAddress'

const EMPTY_ADDRESS: DeliveryAddressSnapshot = {
  street: '',
  number: '',
  complement: null,
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
}

export function DeliveryVerificationModal() {
  const navigate = useNavigate()
  const { isOpen, closeModal } = useDeliveryVerificationModal()
  const { deliveryAddressLabel } = useDeliveryAddress()

  const cached = useMemo(() => readDeliveryVerification(), [])
  const [geoLoading, setGeoLoading] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [showCepFallback, setShowCepFallback] = useState(false)
  const [gpsDetected, setGpsDetected] = useState<DeliveryAddressSnapshot | null>(null)
  const [address, setAddress] = useState<DeliveryAddressSnapshot>(cached?.address || EMPTY_ADDRESS)

  /**
   * Edicao manual do endereco. Se o cliente mexer em rua, numero, bairro ou CEP
   * depois de detectar o GPS, a posicao antiga deixa de valer — manter cobraria
   * o frete do lugar errado, calado. `setAddress` direto so e usado ao aceitar
   * o endereco do GPS, onde as coordenadas devem ser preservadas.
   */
  const updateAddress = useCallback(
    (patch: (prev: DeliveryAddressSnapshot) => DeliveryAddressSnapshot) =>
      setAddress((prev) => dropStaleCoords(patch(prev), prev)),
    [],
  )
  const [calc, setCalc] = useState<DeliveryCalcSnapshot | null>(cached?.calc || null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const feedbackRef = useRef<HTMLDivElement | null>(null)

  // Aviso explicito: sem isto, o cliente clica em "Verificar entrega" la
  // embaixo do formulario e o motivo do erro fica escondido acima da dobra,
  // fora da area visivel -- sobe a tela ate o aviso pra ele nao precisar caçar.
  useEffect(() => {
    if (errorMessage || calc) {
      feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [errorMessage, calc])

  const handleCloseModal = useCallback(() => {
    setGeoLoading(false)
    setCepLoading(false)
    setVerifyLoading(false)
    closeModal()
  }, [closeModal])

  const isGeolocationAvailable = typeof navigator !== 'undefined' &&
    'geolocation' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')

  const attemptGps = useCallback(async () => {
    if (!isGeolocationAvailable) {
      setGpsDetected(null)
      setShowCepFallback(true)
      setErrorMessage('GPS nao disponivel em conexoes HTTP. Digite seu CEP ou endereco abaixo.')
      return
    }
    setGeoLoading(true)
    setErrorMessage(null)
    try {
      const coords = await requestCurrentPosition()
      const detected = await reverseGeocodeByMapbox(coords.lat, coords.lng)
      // Desktop resolve por Wi-Fi/IP e pode errar por quilometros mesmo
      // "com sucesso" -- so guarda a coordenada bruta pra decidir zona quando
      // a precisao e digna de GPS de celular. Fora disso, handleVerify cai no
      // geocode do endereco completo (mais preciso nesse caso).
      const isPreciseEnough = coords.accuracy == null || coords.accuracy <= GPS_ACCURACY_THRESHOLD_M
      setGpsDetected({
        ...detected,
        lat: isPreciseEnough ? coords.lat : null,
        lng: isPreciseEnough ? coords.lng : null,
      })
      setShowCepFallback(false)
    } catch (err: any) {
      setGpsDetected(null)
      setShowCepFallback(true)
      if (err?.code === 1) {
        setErrorMessage('Permissao de localizacao negada. Digite seu CEP ou endereco abaixo.')
      } else {
        setErrorMessage('Nao foi possivel obter sua localizacao. Digite seu CEP ou endereco abaixo.')
      }
    } finally {
      setGeoLoading(false)
    }
  }, [isGeolocationAvailable])

  const handleCepBlur = useCallback(async () => {
    if (address.zipCode.replace(/\D/g, '').length !== 8) return

    setCepLoading(true)
    setErrorMessage(null)
    try {
      const resolved = await fetchAddressByCep(address.zipCode, address)
      updateAddress((prev) => ({
        ...prev,
        zipCode: resolved.zipCode,
        street: resolved.street || prev.street,
        neighborhood: resolved.neighborhood || prev.neighborhood,
        city: resolved.city || prev.city,
        state: resolved.state || prev.state,
      }))
    } catch {
      setErrorMessage('Nao foi possivel consultar o CEP agora.')
    } finally {
      setCepLoading(false)
    }
  }, [address])

  const handleVerify = useCallback(async (nextAddress?: DeliveryAddressSnapshot) => {
    const target = nextAddress || address
    if (!target.street || !target.number || !target.neighborhood || !target.city || !target.state) {
      setErrorMessage('Preencha o endereco completo para verificar a entrega.')
      return
    }

    setVerifyLoading(true)
    setErrorMessage(null)
    try {
      const result = await verifyDeliveryForAddress(target)
      setCalc(result)
      saveDeliveryVerification({
        address: target,
        calc: result,
        verifiedAt: new Date().toISOString(),
      })
    } catch {
      setErrorMessage('Nao foi possivel validar a area de entrega agora.')
    } finally {
      setVerifyLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (!isOpen) return
    setGpsDetected(null)
    if (!isGeolocationAvailable) {
      setShowCepFallback(true)
      return
    }
    attemptGps()
  }, [isOpen, attemptGps, isGeolocationAvailable])

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center justify-center"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-verification-title"
            className={surfaceClasses({
              tone: 'warm',
              className: 'w-full md:max-w-lg rounded-t-2xl md:rounded-lg p-4 md:p-6 shadow-2xl max-h-[92vh] overflow-auto',
            })}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="delivery-verification-title" className="text-lg font-bold text-[#231F20]">Verificacao de entrega</h3>
              <Button type="button" onClick={handleCloseModal} variant="ghost" size="icon" aria-label="Fechar verificacao de entrega">
                <X size={18} />
              </Button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Funciona sem login e sem carrinho. O endereco validado fica salvo para reaproveitar depois.
            </p>

            {deliveryAddressLabel && (
              <div className={surfaceClasses({ className: 'mb-3 bg-[#FBFAF7] px-3 py-2 text-xs text-[#5d4f33]' })}>
                Endereco atual: {deliveryAddressLabel}
              </div>
            )}

            {geoLoading && (
              <div className={surfaceClasses({ className: 'mb-4 inline-flex items-center gap-2 px-3 py-2 text-sm text-[#5d4f33]' })}>
                <Loader2 size={14} className="animate-spin" />
                Tentando localizar via GPS...
              </div>
            )}

            {gpsDetected && !showCepFallback && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="font-semibold text-emerald-800 mb-1">Endereco detectado via GPS</p>
                <p className="text-emerald-700">
                  {gpsDetected.street}, {gpsDetected.number || 's/n'} - {gpsDetected.neighborhood} - {gpsDetected.city}/{gpsDetected.state}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setAddress(gpsDetected)
                      setGpsDetected(null)
                      handleVerify(gpsDetected)
                    }}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300"
                  >
                    Confirmar endereco
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setAddress(gpsDetected)
                      setShowCepFallback(true)
                    }}
                    variant="outline"
                    size="sm"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-200"
                  >
                    Trocar endereco
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CEP</label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={address.zipCode}
                      onChange={(e) => updateAddress((prev) => ({ ...prev, zipCode: formatZipCode(e.target.value) }))}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      maxLength={9}
                      className="pr-10"
                    />
                    {cepLoading && <Loader2 size={16} className="animate-spin absolute right-3 top-2.5 text-gray-400" />}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Rua</label>
                  <Input
                    type="text"
                    value={address.street}
                    onChange={(e) => updateAddress((prev) => ({ ...prev, street: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Numero</label>
                    <Input
                      type="text"
                      value={address.number}
                      onChange={(e) => updateAddress((prev) => ({ ...prev, number: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Bairro</label>
                    <Input
                      type="text"
                      value={address.neighborhood}
                      onChange={(e) => updateAddress((prev) => ({ ...prev, neighborhood: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Cidade</label>
                    <Input
                      type="text"
                      value={address.city}
                      onChange={(e) => updateAddress((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                    <Input
                      type="text"
                      value={address.state}
                      onChange={(e) => updateAddress((prev) => ({ ...prev, state: e.target.value.slice(0, 2).toUpperCase() }))}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => handleVerify()}
                    disabled={verifyLoading}
                  >
                    {verifyLoading && <Loader2 size={14} className="animate-spin" />}
                    Verificar entrega
                  </Button>
                  {isGeolocationAvailable && (
                  <Button
                    type="button"
                    onClick={attemptGps}
                    disabled={geoLoading}
                    variant="outline"
                  >
                    <MapPin size={14} />
                    Usar minha localização atual
                  </Button>
                  )}
                </div>
              </div>

            <div ref={feedbackRef}>
              {errorMessage && (
                <div className="mb-3 flex items-start gap-2.5 rounded-lg border-2 border-red-300 bg-red-50 text-red-800 px-3 py-2.5 text-sm font-medium">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {calc && (
                <div className={cn(
                  'flex items-start gap-2.5 rounded-lg border-2 px-3 py-2.5 text-sm font-medium',
                  calc.outOfArea ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900',
                )}>
                  {calc.outOfArea ? <AlertTriangle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
                  {calc.outOfArea ? (
                    <span>Infelizmente ainda nao entregamos nesse endereco.</span>
                  ) : (
                    <span>
                      Entrega disponivel{calc.zoneName ? ` para ${calc.zoneName}` : ''}. Taxa: {' '}
                      <strong>
                        {calc.fee == null
                          ? 'Indisponível'
                          : calc.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            {calc && !calc.outOfArea && (
              <Button
                type="button"
                onClick={() => {
                  handleCloseModal()
                  navigate('/checkout')
                }}
                className="w-full mt-3 h-14 text-base bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300"
              >
                <CheckCircle2 size={18} />
                Usar este endereço e continuar
              </Button>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
              <Button
                type="button"
                onClick={() => {
                  handleCloseModal()
                  navigate('/checkout')
                }}
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
              >
                <Search size={12} />
                Abrir carrinho
              </Button>
              <Button
                type="button"
                onClick={handleCloseModal}
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
