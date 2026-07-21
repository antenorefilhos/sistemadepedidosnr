import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Navigation, Search, X } from 'lucide-react'
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
  readDeliveryVerification,
  requestCurrentPosition,
  reverseGeocodeByMapbox,
  saveDeliveryVerification,
  verifyDeliveryForAddress,
  type DeliveryCalcSnapshot,
} from '../services/deliveryVerification'
import type { DeliveryAddressSnapshot } from '../utils/deliveryAddress'

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
  const [calc, setCalc] = useState<DeliveryCalcSnapshot | null>(cached?.calc || null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      setGpsDetected(detected)
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
      setAddress((prev) => ({
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
                      onChange={(e) => setAddress((prev) => ({ ...prev, zipCode: formatZipCode(e.target.value) }))}
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
                    onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Numero</label>
                    <Input
                      type="text"
                      value={address.number}
                      onChange={(e) => setAddress((prev) => ({ ...prev, number: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Bairro</label>
                    <Input
                      type="text"
                      value={address.neighborhood}
                      onChange={(e) => setAddress((prev) => ({ ...prev, neighborhood: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Cidade</label>
                    <Input
                      type="text"
                      value={address.city}
                      onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                    <Input
                      type="text"
                      value={address.state}
                      onChange={(e) => setAddress((prev) => ({ ...prev, state: e.target.value.slice(0, 2).toUpperCase() }))}
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
                    <Navigation size={14} />
                    Tentar GPS
                  </Button>
                  )}
                </div>
              </div>

            {errorMessage && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                {errorMessage}
              </div>
            )}

            {calc && (
              <div className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                calc.outOfArea ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-emerald-300 bg-emerald-50 text-emerald-800',
              )}>
                {calc.outOfArea ? (
                  <p>Infelizmente ainda nao entregamos nesse endereco.</p>
                ) : (
                  <p>
                    Entrega disponivel{calc.zoneName ? ` para ${calc.zoneName}` : ''}. Taxa: {' '}
                    <strong>
                      {calc.fee == null
                        ? 'Indisponivel'
                        : calc.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
              <Button
                type="button"
                onClick={() => navigate('/checkout')}
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
