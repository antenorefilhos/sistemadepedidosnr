import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDeliveryVerificationModal } from '../contexts/DeliveryVerificationModalContext'
import { useDeliveryAddress } from '../hooks/useDeliveryAddress'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { surfaceClasses } from './ui/surface'
import { deliveryAPI } from '../services/api'
import {
  clearDeliveryVerification,
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
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [localityModalOpen, setLocalityModalOpen] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [address, setAddress] = useState<DeliveryAddressSnapshot>(cached?.address || EMPTY_ADDRESS)
  const [calc, setCalc] = useState<DeliveryCalcSnapshot | null>(cached?.calc || null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Trava o scroll do body enquanto o modal esta aberto -- sem scrollIntoView
  // no feedback (que desalinhava o body e travava o scroll no celular).
  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

  const updateAddress = useCallback(
    (patch: (prev: DeliveryAddressSnapshot) => DeliveryAddressSnapshot) =>
      setAddress((prev) => dropStaleCoords(patch(prev), prev)),
    [],
  )

  const handleCloseModal = useCallback(() => {
    setGeoLoading(false)
    setCepLoading(false)
    setLocalityModalOpen(false)
    closeModal()
  }, [closeModal])

  const isGeolocationAvailable = typeof navigator !== 'undefined' &&
    'geolocation' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')

  const goToView = useCallback((nextAddress: DeliveryAddressSnapshot, nextCalc: DeliveryCalcSnapshot) => {
    setAddress(nextAddress)
    setCalc(nextCalc)
    setErrorMessage(null)
    saveDeliveryVerification({
      address: nextAddress,
      calc: nextCalc,
      verifiedAt: new Date().toISOString(),
    })
    // Calc que ainda pede escolha de localidade nao tem taxa final pra
    // mostrar no card do modo 'view' -- ir pra la deixaria o modal vazio
    // (o painel exige showResultPanel). Fica no formulario e abre o seletor.
    if (nextCalc.requiresLocalitySelection) {
      setMode('edit')
      setLocalityModalOpen(true)
      return
    }
    setMode('view')
  }, [])

  const attemptGps = useCallback(async () => {
    if (!isGeolocationAvailable) {
      setErrorMessage('GPS nao disponivel em conexoes HTTP. Digite seu CEP abaixo.')
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
      const detectedAddress = {
        ...detected,
        lat: isPreciseEnough ? coords.lat : null,
        lng: isPreciseEnough ? coords.lng : null,
      }
      const result = await verifyDeliveryForAddress(detectedAddress)
      goToView(detectedAddress, result)
    } catch (err: any) {
      if (err?.code === 1) {
        setErrorMessage('Permissao de localizacao negada. Digite seu CEP abaixo.')
      } else {
        setErrorMessage('Nao foi possivel obter sua localizacao. Digite seu CEP abaixo.')
      }
    } finally {
      setGeoLoading(false)
    }
  }, [isGeolocationAvailable, goToView])

  const lastAutoCalculatedCepRef = useRef<string | null>(null)

  // Cliente digita so o CEP e quer ver a taxa (ou o seletor de localidade)
  // na hora -- nao devia precisar preencher rua/numero primeiro so pra ver
  // o preco. Chama o calculo direto pelo CEP, sem exigir endereco completo.
  const autoCalculateByCep = useCallback(async (zipCode: string) => {
    const digits = zipCode.replace(/\D/g, '')
    if (digits.length !== 8 || lastAutoCalculatedCepRef.current === digits) return
    lastAutoCalculatedCepRef.current = digits

    try {
      const res = await deliveryAPI.calculate(zipCode)
      const data = res.data
      setCalc({
        fee: data.fee,
        freeAbove: data.freeAbove,
        zoneName: data.zoneName,
        zoneId: data.zoneId,
        isFree: data.isFree,
        outOfArea: Boolean(data.outOfArea || data.fee == null),
        lat: null,
        lng: null,
        requiresLocalitySelection: Boolean(data.requiresLocalitySelection),
        availableLocalities: data.availableLocalities || [],
        locality: null,
        deliveryPointCode: null,
      })
    } catch {
      // Preview silencioso -- o fechamento do endereco e a fonte de verdade.
    }
  }, [])

  const handleCepBlur = useCallback(async () => {
    if (address.zipCode.replace(/\D/g, '').length !== 8) return

    autoCalculateByCep(address.zipCode)
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
  }, [address, autoCalculateByCep, updateAddress])

  const handleCepChange = useCallback(
    (value: string) => {
      updateAddress((prev) => ({ ...prev, zipCode: formatZipCode(value) }))
      setMode('edit')
    },
    [updateAddress],
  )

  const handleVerifyCep = useCallback(() => {
    if (address.zipCode.replace(/\D/g, '').length !== 8) {
      setErrorMessage('Digite um CEP completo com 8 digitos.')
      return
    }
    handleCepBlur()
  }, [address.zipCode, handleCepBlur])

  // Dispara a consulta automatica quando o CEP completa 8 digitos (cobre o
  // teclado numerico do mobile que "some" sem disparar blur) e, se o CEP tem
  // multiplas localidades, abre o sub-modal dedicado.
  useEffect(() => {
    const digits = address.zipCode.replace(/\D/g, '')
    if (digits.length === 8) {
      autoCalculateByCep(address.zipCode)
      if (calc?.requiresLocalitySelection && !address.deliveryPointCode) {
        setLocalityModalOpen(true)
      }
    }
  }, [address.zipCode, address.deliveryPointCode, autoCalculateByCep, calc?.requiresLocalitySelection])

  const handleSelectLocality = useCallback(async (option: { name: string; code: string }) => {
    setLocalityModalOpen(false)
    const target: DeliveryAddressSnapshot = { ...address, locality: option.name, deliveryPointCode: option.code }
    setAddress(target)
    setErrorMessage(null)

    try {
      const res = await deliveryAPI.calculate(target.zipCode, undefined, undefined, undefined, option.name, option.code)
      const data = res.data
      goToView(target, {
        fee: data.fee,
        freeAbove: data.freeAbove,
        zoneName: data.zoneName,
        zoneId: data.zoneId,
        isFree: data.isFree,
        outOfArea: Boolean(data.outOfArea || data.fee == null),
        lat: null,
        lng: null,
        requiresLocalitySelection: false,
        availableLocalities: data.availableLocalities || [],
        locality: option.name,
        deliveryPointCode: option.code,
      })
    } catch {
      setErrorMessage('Nao foi possivel validar a localidade escolhida.')
    }
  }, [address, goToView])

  // "Trocar endereco" nao pode ser so setMode('edit'): a ref guarda o ultimo
  // CEP calculado e faz autoCalculateByCep sair cedo, entao redigitar o
  // MESMO CEP nao recalculava nada. A localidade escolhida antes tambem nao
  // vale pro endereco novo.
  const handleChangeAddress = useCallback(() => {
    lastAutoCalculatedCepRef.current = null
    setAddress((prev) => ({ ...prev, locality: null, deliveryPointCode: null }))
    setErrorMessage(null)
    setLocalityModalOpen(false)
    setMode('edit')
  }, [])

  const handleClear = useCallback(() => {
    clearDeliveryVerification()
    setAddress(EMPTY_ADDRESS)
    setCalc(null)
    setErrorMessage(null)
    setLocalityModalOpen(false)
    lastAutoCalculatedCepRef.current = null
    setMode('edit')
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setErrorMessage(null)
    setLocalityModalOpen(false)
    // Le do storage a cada abertura, nao do `cached` (useMemo congelado na
    // montagem): o cliente pode ter salvo o endereco nesta mesma sessao, e o
    // cache velho o mandava de volta pro formulario com o endereco ja pronto.
    const snapshot = readDeliveryVerification()
    // Precisa bater com showResultPanel abaixo: snapshot que ainda pede
    // escolha de localidade (cliente fechou o modal no meio) nao tem card pra
    // exibir, e cair em 'view' com ele deixava o modal em branco.
    const hasVerified =
      snapshot?.address &&
      snapshot?.calc &&
      snapshot.calc.outOfArea === false &&
      !snapshot.calc.requiresLocalitySelection
    if (hasVerified) {
      setAddress(snapshot.address)
      setCalc(snapshot.calc)
      setMode('view')
    } else {
      setMode('edit')
    }
  }, [isOpen])

  const showResultPanel = calc && !calc.outOfArea && !calc.requiresLocalitySelection
  // Rede de seguranca: qualquer combinacao de mode/calc que nao renderize o
  // card cai no formulario. Garante que o modal nunca fique sem conteudo.
  const showViewPanel = mode === 'view' && showResultPanel

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center justify-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-verification-title"
            className={surfaceClasses({
              tone: 'warm',
              className: 'w-full md:max-w-lg rounded-t-2xl md:rounded-lg p-4 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain',
            })}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="delivery-verification-title" className="text-lg font-bold text-[#231F20]">
                Onde você quer receber seu pedido?
              </h3>
              <Button type="button" onClick={handleCloseModal} variant="ghost" size="icon" aria-label="Fechar verificacao de entrega">
                <X size={18} />
              </Button>
            </div>

            {showViewPanel && (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">Endereco de entrega</p>
                      <p className="font-semibold text-[#231F20]">
                        {deliveryAddressLabel || formatAddressLabel(address)}
                      </p>
                      {address.locality && (
                        <p className="text-sm text-emerald-800 mt-1">
                          Localidade: <strong>{address.locality}</strong>
                        </p>
                      )}
                      <p className="text-sm text-emerald-800 mt-1">
                        Taxa de entrega:{' '}
                        <strong>
                          {calc.fee == null
                            ? 'Indisponível'
                            : calc.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </p>
                    </div>
                    <CheckCircle2 size={22} className="shrink-0 text-emerald-600" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {/* So fecha o modal: confirmar o endereco nao pode arrastar
                      o cliente pro checkout no meio da navegacao -- quem quer
                      ir pro carrinho tem o botao proprio la embaixo. */}
                  <Button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300"
                  >
                    <CheckCircle2 size={18} />
                    Confirmar endereço e continuar
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" onClick={handleChangeAddress} variant="outline" size="md">
                      Trocar endereço
                    </Button>
                    <Button type="button" onClick={handleClear} variant="ghost" size="md" className="text-red-700 hover:bg-red-50">
                      Limpar endereço
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!showViewPanel && (
              <div className="space-y-4">
                {geoLoading && (
                  <div className={surfaceClasses({ className: 'inline-flex items-center gap-2 px-3 py-2 text-sm text-[#5d4f33]' })}>
                    <Loader2 size={14} className="animate-spin" />
                    Tentando localizar via GPS...
                  </div>
                )}

                <Button
                  type="button"
                  onClick={attemptGps}
                  disabled={geoLoading}
                  className="w-full h-12 text-base"
                >
                  {geoLoading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}
                  📍 Usar minha localização atual (GPS)
                </Button>

                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="h-px flex-1 bg-gray-200" />
                  ou digite seu CEP
                  <span className="h-px flex-1 bg-gray-200" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CEP</label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={address.zipCode}
                      onChange={(e) => handleCepChange(e.target.value)}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      maxLength={9}
                      inputMode="numeric"
                      className="pr-10"
                    />
                    {cepLoading && <Loader2 size={16} className="animate-spin absolute right-3 top-2.5 text-gray-400" />}
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleVerifyCep}
                  disabled={cepLoading}
                  variant="outline"
                  className="w-full"
                >
                  {cepLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Verificar CEP
                </Button>

                {errorMessage && (
                  <div className="flex items-start gap-2.5 rounded-lg border-2 border-red-300 bg-red-50 text-red-800 px-3 py-2.5 text-sm font-medium">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {calc?.outOfArea && (
                  <div className="flex items-start gap-2.5 rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-900 px-3 py-2.5 text-sm font-medium">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <span>Infelizmente ainda nao entregamos nesse endereco.</span>
                  </div>
                )}

                {calc?.requiresLocalitySelection && !localityModalOpen && (
                  <div className="flex items-start gap-2.5 rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-900 px-3 py-2.5 text-sm font-medium">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <span>Esse CEP atende mais de um ponto de entrega. Escolha a sua localidade.</span>
                  </div>
                )}

                {showResultPanel && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <p className="text-emerald-800">
                      Entrega disponivel{calc.zoneName ? ` para ${calc.zoneName}` : ''}. Taxa:{' '}
                      <strong>
                        {calc.fee == null
                          ? 'Indisponível'
                          : calc.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>
                    </p>
                    <Button
                      type="button"
                      onClick={() => {
                        goToView(address, calc)
                      }}
                      className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300"
                    >
                      <CheckCircle2 size={16} />
                      Confirmar endereço e continuar
                    </Button>
                  </div>
                )}
              </div>
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

      {/* Sub-modal dedicado: escolha da localidade/condominio quando o CEP
          cobre mais de um ponto da planilha de balcao. Lista limpa, so com o
          nome -- sem taxas e sem codigos. */}
      {localityModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-end md:items-center justify-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="locality-modal-title"
            className={surfaceClasses({
              tone: 'warm',
              className: 'w-full md:max-w-md rounded-t-2xl md:rounded-lg p-4 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain',
            })}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 id="locality-modal-title" className="text-lg font-bold text-[#231F20]">
                Selecione sua localidade ou condomínio
              </h3>
              <Button type="button" onClick={() => setLocalityModalOpen(false)} variant="ghost" size="icon" aria-label="Fechar">
                <X size={18} />
              </Button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              O CEP digitado atende diferentes pontos de Pedro do Rio.
            </p>

            <div className="space-y-2">
              {calc?.availableLocalities?.map((option) => (
                <button
                  key={`${option.code}--${option.name}`}
                  type="button"
                  onClick={() => handleSelectLocality({ name: option.name, code: option.code })}
                  className="w-full rounded-lg border border-[#E8D7B0] bg-white px-4 py-3 text-left text-sm font-semibold text-[#231F20] hover:border-[#5D082A]/60 hover:bg-[#FFF7FA] transition-colors"
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatAddressLabel(address: DeliveryAddressSnapshot) {
  const complement = address.complement?.trim() ? `, ${address.complement.trim()}` : ''
  return `${address.street}, ${address.number}${complement} - ${address.neighborhood}`
}