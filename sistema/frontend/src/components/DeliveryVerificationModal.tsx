import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, MapPin, ShoppingBag, X } from 'lucide-react'
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
  describeGeolocationError,
  GPS_ACCURACY_THRESHOLD_M,
  mapDeliveryCalcResponse,
  readDeliveryVerification,
  requestCurrentPosition,
  reverseGeocode,
  saveDeliveryVerification,
  verifyDeliveryForAddress,
  type DeliveryCalcSnapshot,
} from '../services/deliveryVerification'
import { dropStaleCoords, type DeliveryAddressSnapshot } from '../utils/deliveryAddress'
import { isMobileDevice } from '../utils/device'

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

  const isSecureContext = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  // GPS so no aparelho que o cliente carrega consigo -- no desktop a
  // geolocalizacao resolve por Wi-Fi/IP e erra por quilometros mesmo "com
  // sucesso" (ver GPS_ACCURACY_THRESHOLD_M). No desktop o cliente digita CEP.
  const isMobile = isMobileDevice()
  const isGeolocationAvailable = typeof navigator !== 'undefined' &&
    'geolocation' in navigator &&
    isMobile &&
    isSecureContext

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
      setErrorMessage('A localização automática só funciona em conexões seguras (HTTPS). Digite seu CEP abaixo.')
      return
    }
    setGeoLoading(true)
    setErrorMessage(null)
    try {
      const coords = await requestCurrentPosition()
      const detected = await reverseGeocode(coords.lat, coords.lng)
      // Desktop resolve por Wi-Fi/IP e pode errar por quilometros mesmo
      // "com sucesso" -- so guarda a coordenada bruta pra decidir zona quando
      // a precisao e digna de GPS de celular. Fora disso, handleVerify cai no
      // geocode do endereco completo (mais preciso nesse caso).
      const isPreciseEnough = coords.accuracy == null || coords.accuracy <= GPS_ACCURACY_THRESHOLD_M
      // Numero nunca vem de GPS/IBGE, nem quando a base local devolve um
      // numero predial real -- e so o ponto mais proximo, pode ser a casa
      // vizinha. O cliente confirma o dele no campo abaixo antes de fechar.
      const detectedAddress = {
        ...detected,
        number: '',
        lat: isPreciseEnough ? coords.lat : null,
        lng: isPreciseEnough ? coords.lng : null,
      }
      const result = await verifyDeliveryForAddress(detectedAddress)
      setErrorMessage(null)
      setAddress(detectedAddress)
      setCalc(result)
      // Nao salva ainda (so goToView salva) -- sem numero confirmado pelo
      // cliente, nao ha endereco de verdade pra persistir. Fica no
      // formulario; se o CEP tiver varios pontos, o aviso de localidade
      // aparece normalmente (calc.requiresLocalitySelection).
    } catch (err: any) {
      setErrorMessage(describeGeolocationError(err))
    } finally {
      setGeoLoading(false)
    }
  }, [isGeolocationAvailable])

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
      setCalc(mapDeliveryCalcResponse(res.data))
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
      setErrorMessage('Não foi possível consultar o CEP agora.')
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
      setErrorMessage('Digite um CEP completo, com 8 dígitos.')
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
      // Endereco com lat/lng ja veio de attemptGps, que chamou
      // verifyDeliveryForAddress com a coordenada (prioridade de poligono,
      // mais precisa que CEP puro) -- recalcular so por CEP aqui
      // sobrescreveria esse resultado com um pior.
      if (address.lat == null || address.lng == null) {
        autoCalculateByCep(address.zipCode)
      }
      if (calc?.requiresLocalitySelection && !address.deliveryPointCode) {
        setLocalityModalOpen(true)
      }
    }
  }, [address.zipCode, address.lat, address.lng, address.deliveryPointCode, autoCalculateByCep, calc?.requiresLocalitySelection])

  const handleSelectLocality = useCallback(async (option: { name: string; code: string }) => {
    setLocalityModalOpen(false)
    const target: DeliveryAddressSnapshot = { ...address, locality: option.name, deliveryPointCode: option.code }
    setAddress(target)
    setErrorMessage(null)

    try {
      const res = await deliveryAPI.calculate(target.zipCode, undefined, undefined, undefined, option.name, option.code)
      setAddress(target)
      setCalc(mapDeliveryCalcResponse(res.data, { locality: option.name, deliveryPointCode: option.code }))
      // Fica no formulario, nao confirma sozinho -- falta o numero (ver
      // showResultPanel abaixo, que agora exige ele antes de "Confirmar").
    } catch {
      setErrorMessage('Não foi possível validar a localidade escolhida.')
    }
  }, [address])

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
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="delivery-verification-title" className="text-xl font-black leading-tight tracking-tight text-[#231F20]">
                  Onde você quer receber seu pedido?
                </h3>
                <p className="mt-1 text-xs text-[#5d4f33]">
                  Calculamos a taxa de entrega antes de você fechar o carrinho.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleCloseModal}
                variant="ghost"
                size="icon"
                className="-mr-1 -mt-1 shrink-0"
                aria-label="Fechar verificação de entrega"
              >
                <X size={18} />
              </Button>
            </div>

            {showViewPanel && (
              <div className="space-y-4">
                {/* Etiqueta de entrega: a taxa e o dado que o cliente abriu o
                    modal pra ver, entao ela ganha peso de display em vez de
                    ficar dentro de um paragrafo. Verde some da superficie e
                    fica so no sinal de conferido -- a superficie e da marca. */}
                <div className="overflow-hidden rounded-lg border border-[#D2BB8A] bg-white">
                  <div className="flex items-center gap-2 border-b border-[#E8D7B0] bg-[#F8F4EA] px-4 py-2">
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5d4f33]">
                      Endereço confirmado
                    </p>
                  </div>

                  <div className="px-4 py-3.5">
                    <p className="font-semibold leading-snug text-[#231F20]">
                      {deliveryAddressLabel || formatAddressLabel(address)}
                    </p>
                    {address.locality && (
                      <p className="mt-1 text-sm text-[#5d4f33]">{address.locality}</p>
                    )}

                    <div className="mt-3 flex items-end justify-between gap-3 border-t border-dashed border-[#E8D7B0] pt-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#5d4f33]">
                        Taxa de entrega
                      </span>
                      <span className="text-2xl font-black leading-none text-[#5D082A]">
                        {calc.fee == null
                          ? 'Indisponível'
                          : calc.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {/* So fecha o modal: confirmar o endereco nao pode arrastar
                      o cliente pro checkout no meio da navegacao -- quem quer
                      ir pro carrinho tem o botao proprio la embaixo. O rotulo
                      diz exatamente isso. */}
                  <Button type="button" onClick={handleCloseModal} size="lg" className="w-full text-base">
                    Confirmar e continuar comprando
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" onClick={handleChangeAddress} variant="outline">
                      Trocar endereço
                    </Button>
                    <Button type="button" onClick={handleClear} variant="ghost" className="text-[#8a2035] hover:bg-[#FFF7FA]">
                      Limpar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!showViewPanel && (
              <div className="space-y-4">
                {/* So no aparelho que o cliente carrega consigo -- no desktop
                    nem mostra o botao, direto pro CEP (ver isMobile acima). */}
                {isMobile && (
                  <>
                    {/* O proprio botao comunica o progresso (rotulo + spinner),
                        em vez de um aviso solto acima dele dizendo a mesma coisa. */}
                    <Button
                      type="button"
                      onClick={attemptGps}
                      disabled={geoLoading}
                      size="lg"
                      className="w-full text-base"
                    >
                      {geoLoading ? <Loader2 size={17} className="animate-spin" /> : <MapPin size={17} />}
                      {geoLoading ? 'Localizando você...' : 'Usar minha localização atual'}
                    </Button>

                    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-[#a89878]">
                      <span className="h-px flex-1 bg-[#E8D7B0]" />
                      ou informe o CEP
                      <span className="h-px flex-1 bg-[#E8D7B0]" />
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="delivery-modal-cep" className="mb-1.5 block text-xs font-semibold text-[#5d4f33]">
                    CEP
                  </label>
                  {/* Campo e acao juntos: o "Buscar" solto embaixo competia em
                      peso com o botao de GPS, que e o caminho principal. */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="delivery-modal-cep"
                        type="text"
                        value={address.zipCode}
                        onChange={(e) => handleCepChange(e.target.value)}
                        onBlur={handleCepBlur}
                        placeholder="00000-000"
                        maxLength={9}
                        inputMode="numeric"
                        className="pr-9"
                      />
                      {cepLoading && (
                        <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#D2BB8A]" />
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleVerifyCep}
                      disabled={cepLoading}
                      variant="secondary"
                      className="shrink-0 px-5"
                    >
                      Buscar
                    </Button>
                  </div>
                </div>

                {errorMessage && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {calc?.outOfArea && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900">
                    <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                    <span>Ainda não entregamos nesse endereço. Confira o CEP ou fale com a loja pelo WhatsApp.</span>
                  </div>
                )}

                {calc?.requiresLocalitySelection && !localityModalOpen && (
                  <div className="rounded-lg border border-[#D2BB8A] bg-[#F8F4EA] px-3 py-2.5">
                    <p className="text-sm font-medium text-[#5d4f33]">
                      Esse CEP atende mais de um ponto da região.
                    </p>
                    <Button
                      type="button"
                      onClick={() => setLocalityModalOpen(true)}
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                    >
                      Escolher minha localidade
                    </Button>
                  </div>
                )}

                {showResultPanel && (
                  <div className="rounded-lg border border-[#D2BB8A] bg-white p-3.5">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5d4f33]">
                          <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                          Entregamos aqui
                        </p>
                        {calc.zoneName && (
                          <p className="mt-1 truncate text-sm font-semibold text-[#231F20]">{calc.zoneName}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xl font-black leading-none text-[#5D082A]">
                        {calc.fee == null
                          ? 'Indisponível'
                          : calc.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>

                    {/* Numero nunca vem automatico (GPS/IBGE so acham o ponto
                        mais proximo, pode ser a casa vizinha) -- o cliente
                        digita o dele aqui antes de fechar o endereco. */}
                    <div className="mt-3 border-t border-dashed border-[#E8D7B0] pt-3">
                      <label htmlFor="delivery-modal-number" className="mb-1.5 block text-xs font-semibold text-[#5d4f33]">
                        Número
                      </label>
                      <Input
                        id="delivery-modal-number"
                        type="text"
                        inputMode="numeric"
                        value={address.number}
                        onChange={(e) => setAddress((prev) => ({ ...prev, number: e.target.value }))}
                        placeholder="Ex: 123"
                        autoFocus
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={() => {
                        if (!address.number.trim()) {
                          setErrorMessage('Informe o número do imóvel para confirmar o endereço.')
                          return
                        }
                        if (calc) goToView(address, calc)
                      }}
                      disabled={!address.number.trim()}
                      className="mt-3 w-full"
                    >
                      Confirmar endereço
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-[#E8D7B0] pt-3">
              <Button
                type="button"
                onClick={() => {
                  handleCloseModal()
                  navigate('/checkout')
                }}
                variant="ghost"
                size="sm"
                className="px-2"
              >
                <ShoppingBag size={13} />
                Ir para o carrinho
              </Button>
              <Button
                type="button"
                onClick={handleCloseModal}
                variant="ghost"
                size="sm"
                className="px-2 text-[#5d4f33] hover:bg-[#F8F4EA]"
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
            <div className="mb-1 flex items-start justify-between gap-3">
              <h3 id="locality-modal-title" className="text-lg font-black leading-tight tracking-tight text-[#231F20]">
                Selecione sua localidade ou condomínio
              </h3>
              <Button
                type="button"
                onClick={() => setLocalityModalOpen(false)}
                variant="ghost"
                size="icon"
                className="-mr-1 -mt-1 shrink-0"
                aria-label="Fechar seleção de localidade"
              >
                <X size={18} />
              </Button>
            </div>

            <p className="mb-4 text-xs text-[#5d4f33]">
              O CEP informado atende diferentes pontos da região.
            </p>

            <div className="space-y-2">
              {calc?.availableLocalities?.map((option) => (
                <button
                  key={`${option.code}--${option.name}`}
                  type="button"
                  onClick={() => handleSelectLocality({ name: option.name, code: option.code })}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#E8D7B0] bg-white px-4 py-3.5 text-left text-sm font-semibold text-[#231F20] transition-colors hover:border-[#5D082A] hover:bg-[#FFF7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D2BB8A]/50"
                >
                  <span className="min-w-0">{option.name}</span>
                  <ChevronRight size={16} className="shrink-0 text-[#D2BB8A]" />
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