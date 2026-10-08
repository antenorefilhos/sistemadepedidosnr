import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import type { User as AuthUser } from '../contexts/AuthContext'
import { useCustomerById } from '../hooks/useOrders'
import { BrazilianValidators } from '../utils/validators'
import { useCart } from '../hooks/useCart'
import {
  useAddBackendCartItem,
  useConfirmCheckoutSession,
  useCreateAddress,
  useCreateBackendCart,
  useCreateCheckoutSession,
  useQuoteCheckoutSession,
} from '../hooks/useCheckout'
import { formatPrice } from '../utils/format'
import { getApiErrorMessage } from '../utils/apiError'
import { authAPI, deliveryAPI, type CheckoutQuoteResponse, type WhatsAppDispatch } from '../services/api'
import { Loader2, Banknote, QrCode, CreditCard, Ticket, MapPin, ShoppingBag, Plus, LocateFixed, Store, Truck } from 'lucide-react'
import { LoadingButton } from '../components/LoadingButton'
import { getDeviceId } from '../utils/device'
import { trackEvent } from '../utils/analytics'
import type { Order } from '../types'
import { buildChangeForOptions } from '../utils/changeOptions'
import { getProductStep } from '../utils/productPricing'
import { saveDeliveryAddress } from '../utils/deliveryAddress'
import { clearCheckoutDraft, readCheckoutDraft, saveCheckoutDraft } from '../utils/checkoutDraft'
import { useFreeShipping } from '../hooks/useFreeShipping'
import { FreeShippingBar } from '../components/FreeShippingBar'
import { useAddressAutofill } from '../hooks/useAddressAutofill'
import {
  createFallbackDeliverySlot,
  createIdempotencyKey,
  formatDeliveryWindow,
  getCheckoutBlockerMessage,
  maskCpfInput,
  maskPhoneInput,
} from '../utils/checkout'
import { CheckoutActionBar, CheckoutHeader, OrderItemsSummary } from '../components/checkout/CheckoutChrome'
import { LoginSheet } from '../components/checkout/LoginSheet'
import { Button } from '../components/ui/button'
import { OrderConfirmation } from '../components/OrderConfirmation'
import { LocalityPickerModal } from '../components/LocalityPickerModal'
import { Input } from '../components/ui/input'
import { getAsapWindow, getScheduleOptionsWithConfig } from '../utils/deliveryOperation'
import { useHoursConfig } from '../hooks/useDeliveryOperation'
import {
  formatZipCode,
  mapDeliveryCalcResponse,
  readDeliveryVerification,
  saveDeliveryVerification,
  subscribeDeliveryVerification,
  verifyDeliveryForAddress,
  type DeliveryCalcSnapshot,
} from '../services/deliveryVerification'

export default function Checkout() {
  const [step, setStep] = useState('address') // address, payment, confirmation
  const [fulfillmentType, setFulfillmentType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY')
  const isPickup = fulfillmentType === 'PICKUP'
  // '' = o quanto antes. Os horarios saem das janelas do admin, que ja
  // embutem o fechamento antecipado da loja.
  const [scheduledFor, setScheduledFor] = useState('')
  const hoursConfig = useHoursConfig()
  const scheduleOptions = useMemo(() => getScheduleOptionsWithConfig(hoursConfig), [hoursConfig])
  // Loja fechada agora: "o quanto antes" nao existe -- o cliente agenda
  // (hoje mais tarde ou o proximo dia aberto). O backend confere o mesmo.
  const asapAvailable = getAsapWindow(hoursConfig) !== null
  useEffect(() => {
    if (!asapAvailable && !scheduledFor && scheduleOptions.length > 0) setScheduledFor(scheduleOptions[0].value)
  }, [asapAvailable, scheduledFor, scheduleOptions])
  const [whatsappDispatch, setWhatsappDispatch] = useState<WhatsAppDispatch | null>(null)
  const whatsappAutoOpenFailedRef = useRef(false)
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null)
  const navigate = useNavigate()
  const { user, applySession } = useAuth()
  const { cart, total, subtotal, clear, couponCode, discount, applyCoupon, removeCoupon, showCouponNotice } = useCart()
  const [couponInput, setCouponInput] = useState('')
  const [couponOpen, setCouponOpen] = useState(false)
  const guestCheckoutEnabled = (import.meta.env.VITE_GUEST_CHECKOUT_ENABLED ?? 'true') !== 'false'
  const createAddress = useCreateAddress()
  const createBackendCart = useCreateBackendCart()
  const addBackendCartItem = useAddBackendCartItem()
  const createCheckoutSession = useCreateCheckoutSession()
  const quoteCheckoutSession = useQuoteCheckoutSession()
  const confirmCheckoutSession = useConfirmCheckoutSession()
  const orderIdempotencyKeyRef = useRef<string | null>(null)
  const backendCartIdRef = useRef<string | null>(null)
  const checkoutSessionIdRef = useRef<string | null>(null)
  const deliverySlotRef = useRef<ReturnType<typeof createFallbackDeliverySlot> | null>(null)
  // setDeliveryCalc so aplica no proximo render -- getDeliveryPayload roda
  // sincrono logo depois de setDeliveryCalc(calc) no mesmo handleSubmit, e
  // pegaria o valor antigo (null) via state. Ref le o valor certo na hora.
  const resolvedCoordsRef = useRef<{ lat: number | null; lng: number | null }>({ lat: null, lng: null })
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutQuote, setCheckoutQuote] = useState<CheckoutQuoteResponse | null>(null)
  useEffect(() => {
    trackEvent('INITIATE_CHECKOUT', 'ORDER', undefined, { total })
  }, [])

  useEffect(() => {
    if (!guestCheckoutEnabled && !user) {
      navigate('/login', { replace: true })
    }
  }, [guestCheckoutEnabled, user, navigate])

  // Fallback: se o window.open sincrono (no handler de confirmacao, logo
  // apos a resposta da API) tambem for bloqueado, tenta de novo aqui. So
  // dispara se a ref indicar que a tentativa sincrona falhou.
  useEffect(() => {
    if (step === 'confirmation' && whatsappDispatch?.url && whatsappAutoOpenFailedRef.current) {
      const timer = setTimeout(() => {
        window.open(whatsappDispatch.url, '_blank', 'noopener,noreferrer')
      }, 1500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [step, whatsappDispatch])

  // Endereco ja verificado (com coordenadas de GPS confirmadas) na Home nao
  // pode ser sobrescrito pela tentativa automatica de GPS do checkout: isso
  // troca coordenadas boas por uma leitura nova (menos precisa, principalmente
  // no desktop) e derruba um endereco que ja tinha sido aceito na zona.
  const hasVerifiedAddressRef = useRef(Boolean(readDeliveryVerification()?.calc && !readDeliveryVerification()?.calc.outOfArea))

  const [formData, setFormData] = useState(() => {
    const saved = readDeliveryVerification()?.address
    // Rascunho da tentativa anterior. Vence sobre `saved` nos campos de
    // endereco porque e o que o cliente digitou aqui por ultimo; perde pro
    // cadastro (`user`) nos dados pessoais, que sao a fonte de verdade.
    const draft = readCheckoutDraft()
    return {
      guestName: user?.name || draft.guestName || '',
      guestWhatsapp: maskPhoneInput(user?.whatsapp || draft.guestWhatsapp || ''),
      guestCpf: maskCpfInput(user?.cpf || draft.guestCpf || ''),
      guestEmail: user?.email || draft.guestEmail || '',
      street: draft.street || saved?.street || '',
      number: draft.number || saved?.number || '',
      complement: draft.complement || saved?.complement || '',
      neighborhood: draft.neighborhood || saved?.neighborhood || '',
      city: draft.city || saved?.city || '',
      state: draft.state || saved?.state || '',
      zipCode: draft.zipCode || saved?.zipCode || '',
      // Posicao do aparelho, quando houve GPS. Decide a zona por poligono.
      lat: (saved?.lat ?? null) as number | null,
      lng: (saved?.lng ?? null) as number | null,
      // CEP com mais de um ponto de entrega mapeado (ver DeliveryCalcSnapshot).
      locality: (draft.locality || saved?.locality || '') as string,
      deliveryPointCode: (draft.deliveryPointCode || saved?.deliveryPointCode || '') as string,
      paymentMethod: draft.paymentMethod || 'CASH',
      needsChange: draft.needsChange || 'NO',
      changeFor: draft.changeFor || '',
      notes: draft.notes || '',
    }
  })

  // Grava o rascunho a cada tecla. Sem isso, sair do checkout (voltar ao
  // carrinho pra corrigir uma quantidade) apagava o formulario inteiro e o
  // cliente redigitava tudo -- motivo classico de abandono de carrinho.
  useEffect(() => {
    if (step === 'confirmation') return
    saveCheckoutDraft(formData)
  }, [formData, step])

  const {
    cepLoading,
    cepAutoFilled,
    geoLoading,
    locationStatus,
    isGpsAvailable,
    handleCepBlur,
    handleUseMyLocation,
  } = useAddressAutofill({
    formData,
    setFormData,
    autoGpsEnabled: step === 'address' && !hasVerifiedAddressRef.current,
  })

  const [deliveryCalc, setDeliveryCalc] = useState<DeliveryCalcSnapshot | null>(() => readDeliveryVerification()?.calc ?? null)

  /**
   * Campos que descrevem ONDE o cliente esta. Editar qualquer um invalida a
   * posicao vinda do GPS: manter as coordenadas antigas faria o calculo de zona
   * apontar para o lugar de antes e cobrar o frete errado, sem aviso.
   * `complement` fica de fora — nao muda a localizacao.
   */
  const LOCATION_FIELDS = ['zipCode', 'street', 'number', 'neighborhood', 'city', 'state']

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    // Campo de localizacao invalida o GPS. A localidade escolhida e do CEP: so
    // mudar o CEP apaga a escolha (08/10/2026) -- antes digitar o numero depois
    // de escolher apagava, e o cliente escolhia a localidade duas vezes.
    const clearCoords = name === 'zipCode'
      ? { lat: null, lng: null, locality: '', deliveryPointCode: '' }
      : LOCATION_FIELDS.includes(name) ? { lat: null, lng: null } : {}

    // Máscaras enquanto digita (08/10/2026): WhatsApp, CPF e UF.
    if (name === 'guestWhatsapp' || name === 'guestCpf' || name === 'state') {
      const masked = name === 'guestWhatsapp' ? maskPhoneInput(value) : name === 'guestCpf' ? maskCpfInput(value) : value.toUpperCase()
      setFormData((prev) => ({ ...prev, [name]: masked, ...clearCoords }))
      return
    }

    // Máscara automática de CEP
    if (name === 'zipCode') {
      setFormData((prev) => ({ ...prev, [name]: formatZipCode(value), ...clearCoords }))
      return
    }

    setFormData((prev) => ({ ...prev, [name]: value, ...clearCoords }))
  }

  const lastAutoCalculatedCepRef = useRef<string | null>(null)

  // Cliente digita so o CEP e quer ver a taxa (ou o seletor de localidade)
  // na hora -- nao devia precisar preencher rua/numero pra ver o preco.
  // Chama o calculo direto pelo CEP, sem exigir endereco completo.
  const autoCalculateByCep = useCallback(async (zipCode: string, locality?: string, deliveryPointCode?: string) => {
    const digits = zipCode.replace(/\D/g, '')
    // A localidade entra na chave: endereco salvo com localidade escolhida
    // calcula a taxa dela, nao a lista "Selecione sua localidade" (08/10/2026).
    const key = `${digits}|${deliveryPointCode || ''}`
    if (digits.length !== 8 || lastAutoCalculatedCepRef.current === key) return
    lastAutoCalculatedCepRef.current = key

    try {
      const res = await deliveryAPI.calculate(zipCode, undefined, undefined, subtotal, locality || undefined, deliveryPointCode || undefined)
      setDeliveryCalc(mapDeliveryCalcResponse(res.data))
    } catch {
      // Preview silencioso -- a submissao da etapa de endereco e a fonte de
      // verdade e ja mostra erro se falhar de novo la.
    }
  }, [subtotal])

  useEffect(() => {
    if (step !== 'address') return
    const digits = formData.zipCode.replace(/\D/g, '')
    if (digits.length === 8) autoCalculateByCep(formData.zipCode, formData.locality, formData.deliveryPointCode)
  }, [step, formData.zipCode, formData.locality, formData.deliveryPointCode, autoCalculateByCep])

  const [localityModalOpen, setLocalityModalOpen] = useState(false)
  // Conta sem senha (tipica de checkout convidado): oferecemos criar uma
  // depois do pedido, pra ela deixar de ser inalcancavel no proximo acesso.
  const [contaSemSenha, setContaSemSenha] = useState(false)
  const precisaEscolherLocalidade = Boolean(
    deliveryCalc?.requiresLocalitySelection && (deliveryCalc.availableLocalities?.length ?? 0) > 0,
  )

  // Abre o modal sozinho quando a escolha vira obrigatoria. Sem escolher, o
  // backend nao libera a etapa -- deixar a lista rolando abaixo da dobra
  // (como era) travava o cliente no mobile sem ele entender por que.
  // O ref evita reabrir se o cliente fechou de proposito: so dispara de novo
  // se o CEP mudar.
  const cepComModalAbertoRef = useRef<string | null>(null)
  useEffect(() => {
    if (step !== 'address' || !precisaEscolherLocalidade || formData.deliveryPointCode) return
    if (cepComModalAbertoRef.current === formData.zipCode) return
    cepComModalAbertoRef.current = formData.zipCode
    setLocalityModalOpen(true)
  }, [step, precisaEscolherLocalidade, formData.deliveryPointCode, formData.zipCode])

  // CEP como 25750-222 cobre de Chafariz a um condominio 2km mais longe --
  // sem essa escolha o backend so libera passar de step (ver
  // requiresLocalitySelection acima), entao reverifica na hora.
  // Divisa de CEP entre duas localidades: nenhuma opcao bate com o endereco
  // real do cliente. Limpa CEP + deliveryCalc (senao precisaEscolherLocalidade
  // continua true e o efeito acima reabre o modal sozinho) e volta o foco pro
  // campo de CEP.
  const handleNoneOfThese = useCallback(() => {
    cepComModalAbertoRef.current = null
    setLocalityModalOpen(false)
    setDeliveryCalc(null)
    setFormData((prev) => ({ ...prev, zipCode: '', locality: '', deliveryPointCode: '' }))
    setTimeout(() => document.getElementById('zipCode')?.focus(), 50)
  }, [])

  const handleSelectLocality = async (option: { name: string; code: string }) => {
    setLocalityModalOpen(false)
    setFormData((prev) => ({ ...prev, locality: option.name, deliveryPointCode: option.code }))
    try {
      const calc = await verifyDeliveryForAddress(
        {
          street: formData.street.trim(),
          number: formData.number.trim(),
          complement: formData.complement || null,
          neighborhood: formData.neighborhood.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          zipCode: formData.zipCode.trim(),
          lat: formData.lat,
          lng: formData.lng,
          locality: option.name,
          deliveryPointCode: option.code,
        },
        subtotal,
      )
      setDeliveryCalc(calc)
      setCheckoutError(null)
    } catch (error) {
      setCheckoutError(getApiErrorMessage(error, 'Não foi possível confirmar a localidade. Tente de novo.'))
    }
  }

  useEffect(() => {
    const syncFromStoredVerification = () => {
      const snapshot = readDeliveryVerification()
      if (!snapshot?.address) return

      setFormData((prev) => ({
        ...prev,
        zipCode: snapshot.address.zipCode || prev.zipCode,
        street: snapshot.address.street || prev.street,
        number: snapshot.address.number || prev.number,
        complement: snapshot.address.complement || prev.complement,
        neighborhood: snapshot.address.neighborhood || prev.neighborhood,
        city: snapshot.address.city || prev.city,
        state: snapshot.address.state || prev.state,
        // Reaproveita a posicao do GPS validada no modal de entrega, para o
        // checkout nao recair no centroide do endereco.
        lat: snapshot.address.lat ?? prev.lat ?? null,
        lng: snapshot.address.lng ?? prev.lng ?? null,
        locality: snapshot.address.locality ?? prev.locality ?? '',
        deliveryPointCode: snapshot.address.deliveryPointCode ?? prev.deliveryPointCode ?? '',
      }))

      if (snapshot.calc) {
        setDeliveryCalc(snapshot.calc)
      }
    }

    syncFromStoredVerification()
    return subscribeDeliveryVerification(syncFromStoredVerification)
  }, [])

  useEffect(() => {
    backendCartIdRef.current = null
    checkoutSessionIdRef.current = null
    orderIdempotencyKeyRef.current = null
    deliverySlotRef.current = null
    setCheckoutQuote(null)
  }, [cart])

  const getDeliveryPayload = useCallback((deliveryAddressId?: string) => {
    // A verificacao rapida (verifyDeliveryForAddress) ja resolveu a
    // coordenada certa (GPS ou geocode do endereco via Mapbox) -- sem
    // reenvia-la aqui, a sessao de checkout so teria o CEP e nunca bateria
    // com zona por poligono. Ver deliveryVerification.ts.
    const lat = resolvedCoordsRef.current.lat ?? formData.lat ?? undefined
    const lng = resolvedCoordsRef.current.lng ?? formData.lng ?? undefined

    if (isPickup) {
      // Retirada nao tem endereco nem zona: o backend devolve frete 0 e
      // pula a validacao de area (checkout.service -> buildDeliverySnapshot).
      if (!deliverySlotRef.current) {
        deliverySlotRef.current = createFallbackDeliverySlot(hoursConfig)
      }
      return {
        mode: 'PICKUP',
        ...deliverySlotRef.current,
      }
    }

    if (!deliverySlotRef.current) {
      deliverySlotRef.current = createFallbackDeliverySlot(hoursConfig)
    }

    return {
      mode: 'DELIVERY',
      zipCode: formData.zipCode,
      lat,
      lng,
      addressId: deliveryAddressId,
      locality: formData.locality || undefined,
      deliveryPointCode: formData.deliveryPointCode || undefined,
      ...deliverySlotRef.current,
    }
  }, [formData.lat, formData.lng, formData.zipCode, formData.locality, formData.deliveryPointCode, isPickup, hoursConfig])

  const ensureCheckoutSession = useCallback(async ({
    customerId,
    deliveryAddressId,
  }: {
    customerId?: string
    deliveryAddressId?: string
  } = {}) => {
    if (cart.length === 0) {
      throw new Error('Carrinho vazio')
    }

    if (!backendCartIdRef.current) {
      const cartResponse = await createBackendCart.mutateAsync({
        customerId: customerId || user?.id,
        deviceId: getDeviceId(),
      })
      const backendCartId = cartResponse.data.id
      backendCartIdRef.current = backendCartId

      for (const item of cart) {
        // O carrinho guarda "numero de passos" para produtos pesaveis (ver
        // CartContext.addItem); o backend espera a quantidade real (kg).
        const realQuantity = item.quantity * getProductStep(item.product)
        await addBackendCartItem.mutateAsync({
          cartId: backendCartId,
          data: {
            productId: item.productId,
            quantity: realQuantity,
            allowSubstitution: item.allowSubstitution !== false,
          },
        })
      }
    }

    if (!orderIdempotencyKeyRef.current) {
      orderIdempotencyKeyRef.current = createIdempotencyKey()
    }

    if (!checkoutSessionIdRef.current) {
      if (!backendCartIdRef.current) throw new Error('Carrinho de checkout nao foi criado')
      if (!orderIdempotencyKeyRef.current) throw new Error('Chave de checkout nao foi criada')
      const sessionResponse = await createCheckoutSession.mutateAsync({
        cartId: backendCartIdRef.current,
        idempotencyKey: orderIdempotencyKeyRef.current,
        customerId: customerId || user?.id,
      })
      checkoutSessionIdRef.current = sessionResponse.data.session.id
    }

    if (!checkoutSessionIdRef.current) throw new Error('Sessao de checkout nao foi criada')
    const quoteResponse = await quoteCheckoutSession.mutateAsync({
      id: checkoutSessionIdRef.current,
      data: {
        customerId: customerId || user?.id,
        couponCode: couponCode || undefined,
        deliveryAddressId,
        delivery: getDeliveryPayload(deliveryAddressId),
        // O preco de oferta segue o dia da entrega (02/10/2026): o total da
        // tela e o cobrado no confirmar usam o mesmo dia agendado.
        scheduledFor: scheduledFor || undefined,
      },
    })
    setCheckoutQuote(quoteResponse.data)
    return quoteResponse.data
  }, [
    addBackendCartItem,
    cart,
    couponCode,
    createBackendCart,
    createCheckoutSession,
    getDeliveryPayload,
    quoteCheckoutSession,
    scheduledFor,
    user?.id,
  ])

  // Trocou o dia agendado: a oferta pode valer ou nao nesse dia -- recalcula.
  const lastQuotedScheduleRef = useRef(scheduledFor)
  useEffect(() => {
    if (lastQuotedScheduleRef.current === scheduledFor) return
    lastQuotedScheduleRef.current = scheduledFor
    if (step !== 'payment' || !checkoutSessionIdRef.current) return
    ensureCheckoutSession({ customerId: user?.id }).catch(() => null)
  }, [scheduledFor, step, ensureCheckoutSession, user?.id])

  // Cupom aplicado/retirado aqui no checkout: recalcula na hora. Se o
  // servidor recusar (ex.: ja usado por este cliente), tira o cupom e avisa
  // no meio da tela -- senao o "Finalizar" falharia sem o cliente entender.
  const lastQuotedCouponRef = useRef(couponCode)
  useEffect(() => {
    if (lastQuotedCouponRef.current === couponCode) return
    lastQuotedCouponRef.current = couponCode
    if (step !== 'payment' || !checkoutSessionIdRef.current) return
    ensureCheckoutSession({ customerId: user?.id }).catch((error) => {
      if (!couponCode) return
      showCouponNotice({ tone: 'error', title: `O cupom ${couponCode} não vale para este pedido`, message: getApiErrorMessage(error, 'Não foi possível aplicar o cupom.') })
      removeCoupon()
    })
  }, [couponCode, step, ensureCheckoutSession, user?.id, showCouponNotice, removeCoupon])

  const payableTotal = checkoutQuote?.price.total ?? total
  const quotedDiscount = checkoutQuote?.price.discountAmount ?? discount
  // price.deliveryAmount ja vem com cupom de frete gratis; delivery.fee e a
  // taxa cheia da zona (mostrava R$ 16 com o total ja sem o frete).
  const quotedDeliveryFee = checkoutQuote ? checkoutQuote.price.deliveryAmount : deliveryCalc?.fee ?? null
  const deliveryZoneName = checkoutQuote?.delivery.zoneName ?? deliveryCalc?.zoneName ?? null
  // Zona sobrepõe o global (regra de negócio) assim que conhecida -- antes
  // disso (nenhum endereço validado ainda) usa o global como estimativa.
  const freeShipping = useFreeShipping(subtotal, checkoutQuote?.delivery.freeAbove ?? deliveryCalc?.freeAbove)
  const deliveryIsFree = quotedDeliveryFee === 0 || (!checkoutQuote && freeShipping.achieved)
  const checkoutIsPending =
    createAddress.isPending ||
    createBackendCart.isPending ||
    addBackendCartItem.isPending ||
    createCheckoutSession.isPending ||
    quoteCheckoutSession.isPending ||
    confirmCheckoutSession.isPending

  // O erro de estoque so serve se disser QUAL item -- o quote traz productId,
  // e o nome esta aqui no carrinho local.
  const nomeDoProdutoNoCarrinho = (productId: string) =>
    cart.find((cartItem) => cartItem.productId === productId)?.product?.name

  // ---- Checkout refeito em 08/10/2026 -------------------------------------
  // Aviso na barra fixa (onde o cliente esta) e, quando e de um campo, leva
  // ate ele. Antes o aviso ia para o topo da pagina e o "Finalizar" parecia
  // nao fazer nada.
  const formRef = useRef<HTMLFormElement>(null)
  const fail = (message: string, fieldId?: string) => {
    setCheckoutError(message)
    if (!fieldId) return
    const el = document.getElementById(fieldId) as HTMLInputElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => el?.focus({ preventScroll: true }), 350)
  }

  // Conta que ja existe com os dados digitados: abre o login ali mesmo.
  const [loginSheet, setLoginSheet] = useState<{ open: boolean; reason: 'exists' | 'manual'; identifier: string }>({ open: false, reason: 'manual', identifier: '' })
  const pendingFinalizeRef = useRef(false)
  const lastAccountCheckRef = useRef<string>('')

  const openLogin = (reason: 'exists' | 'manual', identifier = '') => setLoginSheet({ open: true, reason, identifier })

  const checkAccount = async (): Promise<boolean> => {
    if (user) return false
    const whatsapp = formData.guestWhatsapp.replace(/\D/g, '')
    const cpf = formData.guestCpf.replace(/\D/g, '')
    const email = formData.guestEmail.trim().toLowerCase()
    const usable = (whatsapp.length >= 10 ? whatsapp : '') || (cpf.length === 11 ? cpf : '') || (email.includes('@') ? email : '')
    if (!usable) return false
    const key = `${whatsapp}|${cpf}|${email}`
    if (lastAccountCheckRef.current === key) return false
    lastAccountCheckRef.current = key
    try {
      const { data } = await authAPI.accountCheck({ whatsapp: whatsapp || undefined, cpf: cpf.length === 11 ? cpf : undefined, email: email || undefined })
      if (!data.exists) return false
      const identifier = data.via === 'cpf' ? formData.guestCpf : data.via === 'email' ? formData.guestEmail.trim() : formData.guestWhatsapp
      setCheckoutError(null)
      openLogin('exists', identifier)
      return true
    } catch {
      // Sem resposta (limite de tentativas, rede): o Finalizar confere de novo.
      return false
    }
  }

  const handleLoggedIn = (accessToken: string, loggedUser: AuthUser) => {
    applySession(accessToken, loggedUser)
    setLoginSheet((prev) => ({ ...prev, open: false }))
    // A sessao de compra foi aberta como convidado: recomeca com o cliente.
    backendCartIdRef.current = null
    checkoutSessionIdRef.current = null
    orderIdempotencyKeyRef.current = null
    setCheckoutQuote(null)
    setCheckoutError(null)
    setFormData((prev) => ({
      ...prev,
      guestName: loggedUser.name || prev.guestName,
      guestWhatsapp: maskPhoneInput(loggedUser.whatsapp || prev.guestWhatsapp),
      guestCpf: maskCpfInput(loggedUser.cpf || prev.guestCpf),
      guestEmail: loggedUser.email || prev.guestEmail,
    }))
    toast.success(`Pronto, ${String(loggedUser.name || '').split(' ')[0] || 'você entrou'}! O pedido continua daqui.`, { position: 'top-center' })
    if (pendingFinalizeRef.current) {
      pendingFinalizeRef.current = false
      window.setTimeout(() => formRef.current?.requestSubmit(), 120)
    }
  }

  // Endereços salvos de quem está logado: escolhe em vez de redigitar.
  const { data: customerData } = useCustomerById(user?.id)
  const savedAddresses = useMemo(
    () => [...(customerData?.addresses || [])].sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    [customerData],
  )
  const norm = (v?: string | null) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const selectedSavedAddress = savedAddresses.find(
    (a) => norm(a.street) === norm(formData.street) && norm(a.number) === norm(formData.number) && a.zipCode.replace(/\D/g, '') === formData.zipCode.replace(/\D/g, ''),
  )
  const [typingNewAddress, setTypingNewAddress] = useState(false)

  const applySavedAddress = (address: (typeof savedAddresses)[number]) => {
    setTypingNewAddress(false)
    lastAutoCalculatedCepRef.current = null
    cepComModalAbertoRef.current = null
    setDeliveryCalc(null)
    setCheckoutError(null)
    setFormData((prev) => ({
      ...prev,
      street: address.street,
      number: address.number,
      complement: address.complement || '',
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zipCode: formatZipCode(address.zipCode),
      lat: null,
      lng: null,
      locality: address.locality || '',
      deliveryPointCode: address.deliveryPointCode || '',
    }))
  }

  const startNewAddress = () => {
    setTypingNewAddress(true)
    lastAutoCalculatedCepRef.current = null
    cepComModalAbertoRef.current = null
    setDeliveryCalc(null)
    setFormData((prev) => ({ ...prev, street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', lat: null, lng: null, locality: '', deliveryPointCode: '' }))
    window.setTimeout(() => document.getElementById('zipCode')?.focus(), 80)
  }

  // Logado, sem endereço na tela: já começa com o endereço padrão.
  const appliedDefaultRef = useRef(false)
  useEffect(() => {
    if (appliedDefaultRef.current || !savedAddresses.length || formData.street) return
    appliedDefaultRef.current = true
    applySavedAddress(savedAddresses[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses, formData.street])

  const showAddressForm = typingNewAddress || !savedAddresses.length || !selectedSavedAddress

  const validateGuest = (): boolean => {
    if (user || !guestCheckoutEnabled) return true
    if (formData.guestName.trim().length < 3) {
      fail('Informe seu nome para continuar.', 'guestName')
      return false
    }
    const whatsapp = formData.guestWhatsapp.replace(/\D/g, '')
    if (whatsapp.length < 10 || whatsapp.length > 11) {
      fail('Informe o WhatsApp com DDD, por exemplo (24) 99999-0000.', 'guestWhatsapp')
      return false
    }
    if (!BrazilianValidators.validateCPF(formData.guestCpf)) {
      fail('Confira o CPF: os números não batem.', 'guestCpf')
      return false
    }
    const email = formData.guestEmail.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail('Confira o e-mail ou deixe em branco.', 'guestEmail')
      return false
    }
    return true
  }

  const submitAddressStep = async () => {
    if (!validateGuest()) return
    if (await checkAccount()) return
    try {
      if (isPickup) {
        // Sem endereço para validar: o cliente busca na loja.
        const quote = await ensureCheckoutSession({ customerId: user?.id })
        if (!quote.canConfirm) {
          fail(getCheckoutBlockerMessage(quote, nomeDoProdutoNoCarrinho))
          return
        }
        setStep('payment')
        window.scrollTo({ top: 0 })
        return
      }

      const addressToValidate = {
        street: formData.street.trim(),
        number: formData.number.trim(),
        neighborhood: formData.neighborhood.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        zipCode: formData.zipCode.trim(),
      }
      const missing: Array<[string, string]> = [
        ['zipCode', addressToValidate.zipCode.replace(/\D/g, '').length === 8 ? 'ok' : ''],
        ['street', addressToValidate.street],
        ['number', addressToValidate.number],
        ['neighborhood', addressToValidate.neighborhood],
        ['city', addressToValidate.city],
        ['state', addressToValidate.state],
      ]
      const firstMissing = missing.find(([, value]) => !value)
      if (firstMissing) {
        if (!showAddressForm) setTypingNewAddress(true)
        fail(firstMissing[0] === 'zipCode' ? 'Informe o CEP para calcular a entrega.' : 'Complete o endereço para continuar.', firstMissing[0])
        return
      }

      const calc = await verifyDeliveryForAddress(
        {
          street: addressToValidate.street,
          number: addressToValidate.number,
          complement: formData.complement || null,
          neighborhood: addressToValidate.neighborhood,
          city: addressToValidate.city,
          state: addressToValidate.state,
          zipCode: addressToValidate.zipCode,
          // Sem repassar isto, o cálculo cairia no centroide do endereço e a
          // zona por polígono erraria quem mora perto da divisa.
          lat: formData.lat,
          lng: formData.lng,
          locality: formData.locality || null,
          deliveryPointCode: formData.deliveryPointCode || null,
        },
        subtotal,
      )
      setDeliveryCalc(calc)
      resolvedCoordsRef.current = { lat: calc.lat ?? null, lng: calc.lng ?? null }

      if (calc.outOfArea) {
        fail('Ainda não entregamos neste endereço. Você pode retirar na loja.')
        return
      }

      if (calc.requiresLocalitySelection) {
        // Abre a lista em vez de só avisar: a ação que falta aparece na frente do cliente.
        setLocalityModalOpen(true)
        setCheckoutError('Este CEP atende mais de um lugar. Escolha a sua localidade para continuar.')
        return
      }

      const quote = await ensureCheckoutSession({ customerId: user?.id })
      if (!quote.canConfirm) {
        fail(getCheckoutBlockerMessage(quote, nomeDoProdutoNoCarrinho))
        return
      }

      // Endereço aprovado na zona: guarda junto com o cálculo de frete.
      saveDeliveryVerification({
        address: {
          ...addressToValidate,
          complement: formData.complement || null,
          lat: formData.lat,
          lng: formData.lng,
          locality: formData.locality || null,
          deliveryPointCode: formData.deliveryPointCode || null,
        },
        calc,
        verifiedAt: new Date().toISOString(),
      })

      setStep('payment')
      window.scrollTo({ top: 0 })
    } catch (error) {
      // Sessão pode ter expirado entre tentativas: troca a chave também, senão o
      // backend devolve a mesma sessão morta de novo.
      checkoutSessionIdRef.current = null
      orderIdempotencyKeyRef.current = null
      fail(getApiErrorMessage(error, 'Não foi possível confirmar o endereço agora. Confira os dados e tente de novo.'))
    }
  }

  const isSessionError = (error: unknown) =>
    /sess[aã]o de compra expirou|carrinho mudou|n[aã]o encontramos seu carrinho|n[aã]o conseguimos calcular o pedido/i.test(getApiErrorMessage(error, ''))

  const finalizeOrder = async (retried: boolean): Promise<void> => {
    try {
      let customerId = user?.id

      if (!customerId) {
        if (!validateGuest()) return
        const whatsappDigits = formData.guestWhatsapp.replace(/\D/g, '')
        const cpfDigits = formData.guestCpf.replace(/\D/g, '')
        const normalizedEmail = formData.guestEmail.trim() || `guest.${whatsappDigits || Date.now()}@checkout.local`

        let guestAuth
        try {
          guestAuth = await authAPI.guestCheckout({
            name: formData.guestName.trim(),
            whatsapp: whatsappDigits,
            cpf: cpfDigits,
            email: normalizedEmail,
          })
        } catch (error) {
          // Dados de uma conta com senha: abre o login na frente do cliente e
          // finaliza sozinho depois que ele entrar.
          if ((error as { response?: { status?: number } })?.response?.status === 409) {
            pendingFinalizeRef.current = true
            setCheckoutError(null)
            openLogin('exists', formData.guestWhatsapp || formData.guestCpf)
            return
          }
          throw error
        }

        const { access_token, user: guestUser } = guestAuth.data
        applySession(access_token, guestUser)
        customerId = guestUser.id
        setContaSemSenha(guestUser.hasPassword === false)
      }

      if (!customerId) throw new Error('Não foi possível identificar o cliente para finalizar o pedido.')

      let deliveryAddressId: string | undefined
      if (!isPickup) {
        const deliveryAddress = {
          street: formData.street,
          number: formData.number,
          complement: formData.complement || null,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode || '00000000',
          isDefault: true,
          locality: formData.locality || null,
          deliveryPointCode: formData.deliveryPointCode || null,
        }
        // O servidor reaproveita o endereço igual (não duplica em "Meus endereços").
        const createdAddressResponse = await createAddress.mutateAsync({ customerId, data: deliveryAddress })
        deliveryAddressId = typeof createdAddressResponse.data?.id === 'string' ? createdAddressResponse.data.id : undefined
        saveDeliveryAddress(deliveryAddress)

        if (!deliveryCalc || deliveryCalc.outOfArea || deliveryCalc.fee == null) {
          setStep('address')
          fail('Confirme o endereço de entrega para continuar.')
          return
        }
      }

      const changeAmount =
        formData.paymentMethod === 'CASH' && formData.needsChange === 'YES' && formData.changeFor ? formData.changeFor : undefined

      const quote = await ensureCheckoutSession({ customerId, deliveryAddressId })
      if (!quote.canConfirm) {
        fail(getCheckoutBlockerMessage(quote, nomeDoProdutoNoCarrinho))
        return
      }

      const orderResponse = await confirmCheckoutSession.mutateAsync({
        id: quote.session.id,
        data: {
          customerId,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes?.trim() || undefined,
          scheduledFor: scheduledFor || undefined,
          changeAmount,
          deviceId: getDeviceId(),
          deliveryAddressId,
          delivery: getDeliveryPayload(deliveryAddressId),
          couponCode: couponCode || undefined,
        },
      })

      setCreatedOrder(orderResponse.data.order)
      setWhatsappDispatch(orderResponse.data.whatsapp)
      // Limpa ANTES de abrir o WhatsApp (29/09/2026, DAV 102117/102118): no
      // navegador interno de app o window.open pode trocar a página, e o
      // carrinho sobrevivia -- o cliente voltava e finalizava de novo.
      orderIdempotencyKeyRef.current = null
      backendCartIdRef.current = null
      checkoutSessionIdRef.current = null
      clear()
      clearCheckoutDraft()
      // Abre ainda na cadeia do clique: fora dela o navegador do celular bloqueia.
      if (orderResponse.data.whatsapp?.url) {
        const popup = window.open(orderResponse.data.whatsapp.url, '_blank', 'noopener,noreferrer')
        whatsappAutoOpenFailedRef.current = !popup
      }
      setStep('confirmation')
      window.scrollTo({ top: 0 })
    } catch (error) {
      checkoutSessionIdRef.current = null
      orderIdempotencyKeyRef.current = null
      // Sessão de compra vencida no meio do caminho: tenta de novo uma vez,
      // sozinho, em vez de pedir ao cliente para apertar outra vez.
      if (!retried && isSessionError(error)) {
        backendCartIdRef.current = null
        return finalizeOrder(true)
      }
      fail(getApiErrorMessage(error, 'Não foi possível concluir o pedido. Tente de novo.'))
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setCheckoutError(null)
    if (step === 'address') return submitAddressStep()
    if (step === 'payment') return finalizeOrder(false)
  }

  if (cart.length === 0 && step !== 'confirmation') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFAF7] px-4">
        <div className="text-center">
          <ShoppingBag size={40} className="mx-auto text-[#D2BB8A]" />
          <p className="mb-4 mt-3 font-semibold text-[#231F20]">Seu carrinho está vazio.</p>
          <Button onClick={() => navigate('/')} variant="primary">
            Ver produtos da loja
          </Button>
        </div>
      </div>
    )
  }

  const goBack = () => {
    setCheckoutError(null)
    if (step === 'payment') {
      setStep('address')
      window.scrollTo({ top: 0 })
    } else navigate('/cart')
  }

  // Total da barra: antes da cotação, itens + frete estimado do endereço.
  const deliveryEstimate = isPickup || !deliveryCalc || deliveryCalc.outOfArea || deliveryIsFree ? 0 : deliveryCalc.fee ?? 0
  const barTotal = checkoutQuote ? payableTotal : total + deliveryEstimate
  const deliveryLine = (() => {
    if (isPickup) return { text: 'Retirada na loja: grátis', tone: 'ok' as const }
    if (!deliveryCalc) return null
    if (deliveryCalc.outOfArea) return { text: 'Ainda não entregamos neste endereço. Você pode retirar na loja.', tone: 'warn' as const }
    if (deliveryCalc.requiresLocalitySelection && !formData.deliveryPointCode) return { text: 'Escolha sua localidade para ver a taxa de entrega.', tone: 'info' as const }
    const placeName = formData.locality || deliveryCalc.zoneName
    const where = placeName ? ` para ${placeName}` : ''
    if (deliveryIsFree) return { text: `Entrega${where}: grátis`, tone: 'ok' as const }
    return { text: `Entrega${where}: ${formatPrice(deliveryCalc.fee ?? 0)}`, tone: 'info' as const }
  })()
  const fieldClass = 'h-12 rounded-xl bg-white px-4 text-base'
  const labelClass = 'mb-1.5 block text-sm font-semibold text-[#231F20]'
  const cardClass = 'rounded-2xl border border-[#E8D7B0]/70 bg-white p-4'
  const addressText = [formData.street && `${formData.street}${formData.number ? `, ${formData.number}` : ''}`, formData.complement].filter(Boolean).join(' · ')
  const addressText2 = [formData.neighborhood, formData.city && `${formData.city}${formData.state ? `/${formData.state}` : ''}`].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-[#FBFAF7]">
      <CheckoutHeader step={step} onBack={goBack} />

      <div className={`mx-auto max-w-2xl px-4 pt-4 ${step === 'confirmation' ? 'pb-10' : 'pb-48'}`}>
        {step === 'confirmation' ? (
          <OrderConfirmation
            createdOrder={createdOrder}
            whatsappDispatch={whatsappDispatch}
            contaSemSenha={contaSemSenha}
            isPickup={isPickup}
            onContinueShopping={() => navigate('/')}
            onTrackOrder={() => navigate('/minha-conta')}
          />
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
            {step === 'address' && (
              <>
                <OrderItemsSummary cart={cart} subtotal={subtotal} />

                {/* Convidado: dados primeiro -- se já forem de uma conta, o login abre antes do endereço. */}
                {!user && guestCheckoutEnabled && (
                  <section className={cardClass}>
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <h2 className="text-base font-bold text-[#231F20]">Seus dados</h2>
                      <button type="button" onClick={() => openLogin('manual', formData.guestWhatsapp || formData.guestCpf)} className="text-sm font-semibold text-[#5D082A] hover:underline">
                        Já tenho conta
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="guestName" className={labelClass}>Nome completo</label>
                        <Input id="guestName" name="guestName" value={formData.guestName} onChange={handleInputChange} autoComplete="name" enterKeyHint="next" className={fieldClass} />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="guestWhatsapp" className={labelClass}>WhatsApp</label>
                          <Input id="guestWhatsapp" name="guestWhatsapp" type="tel" inputMode="numeric" autoComplete="tel-national" value={formData.guestWhatsapp} onChange={handleInputChange} onBlur={() => void checkAccount()} placeholder="(24) 99999-0000" enterKeyHint="next" className={fieldClass} />
                          <p className="mt-1 text-xs text-[#8a6a3a]">Para avisar quando o pedido sair.</p>
                        </div>
                        <div>
                          <label htmlFor="guestCpf" className={labelClass}>CPF</label>
                          <Input id="guestCpf" name="guestCpf" inputMode="numeric" value={formData.guestCpf} onChange={handleInputChange} onBlur={() => void checkAccount()} placeholder="000.000.000-00" enterKeyHint="next" className={fieldClass} />
                          <p className="mt-1 text-xs text-[#8a6a3a]">Sai na nota fiscal.</p>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="guestEmail" className={labelClass}>E-mail <span className="font-normal text-gray-400">(opcional)</span></label>
                        <Input id="guestEmail" name="guestEmail" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={formData.guestEmail} onChange={handleInputChange} onBlur={() => void checkAccount()} placeholder="voce@email.com" className={fieldClass} />
                      </div>
                    </div>
                  </section>
                )}

                <section className={cardClass}>
                  <h2 className="mb-3 text-base font-bold text-[#231F20]">Como você quer receber?</h2>
                  <div className="grid grid-cols-2 gap-2.5">
                    {([
                      { id: 'DELIVERY', title: 'Entrega', desc: 'No seu endereço' },
                      { id: 'PICKUP', title: 'Retirar na loja', desc: 'Sem taxa' },
                    ] as const).map((option) => {
                      const active = fulfillmentType === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setFulfillmentType(option.id)
                            setCheckoutError(null)
                          }}
                          aria-pressed={active}
                          className={`rounded-xl border p-3 text-left transition-colors ${active ? 'border-[#5D082A] bg-[#5D082A]/5 ring-1 ring-[#5D082A]' : 'border-[#E8D7B0] bg-white'}`}
                        >
                          <span className={`block text-sm font-bold ${active ? 'text-[#5D082A]' : 'text-[#231F20]'}`}>{option.title}</span>
                          <span className="mt-0.5 block text-xs text-[#5d4f33]">{option.desc}</span>
                        </button>
                      )
                    })}
                  </div>

                  {isPickup && (
                    <p className="mt-3 rounded-xl bg-[#F8F4EA] px-3 py-2.5 text-sm text-[#5d4f33]">
                      Você retira na loja, sem taxa. Avisamos no WhatsApp quando o pedido estiver separado.
                    </p>
                  )}

                  {!isPickup && (
                    <div className="mt-4 space-y-3">
                      {/* Logado: escolhe entre os endereços salvos. */}
                      {savedAddresses.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-[#231F20]">Entregar em</p>
                          {savedAddresses.slice(0, 4).map((address) => {
                            const active = !typingNewAddress && selectedSavedAddress?.id === address.id
                            return (
                              <button
                                key={address.id}
                                type="button"
                                onClick={() => applySavedAddress(address)}
                                aria-pressed={active}
                                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${active ? 'border-[#5D082A] bg-[#5D082A]/5 ring-1 ring-[#5D082A]' : 'border-[#E8D7B0] bg-white'}`}
                              >
                                <MapPin size={18} className={`mt-0.5 shrink-0 ${active ? 'text-[#5D082A]' : 'text-gray-400'}`} />
                                <span className="min-w-0 text-sm">
                                  <span className="block font-semibold text-[#231F20]">{address.street}, {address.number}{address.complement ? ` · ${address.complement}` : ''}</span>
                                  <span className="block text-xs text-gray-500">{[address.locality || address.neighborhood, address.city].filter(Boolean).join(' · ')}</span>
                                </span>
                              </button>
                            )
                          })}
                          <button type="button" onClick={startNewAddress} className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed text-sm font-semibold ${typingNewAddress ? 'border-[#5D082A] text-[#5D082A]' : 'border-[#D2BB8A] text-[#5D082A]'}`}>
                            <Plus size={16} /> Entregar em outro endereço
                          </button>
                        </div>
                      )}

                      {showAddressForm && (
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="zipCode" className={labelClass}>
                              CEP
                              {cepAutoFilled && <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">endereço preenchido</span>}
                            </label>
                            <div className="relative">
                              <Input
                                id="zipCode"
                                name="zipCode"
                                inputMode="numeric"
                                autoComplete="postal-code"
                                value={formData.zipCode}
                                onChange={handleInputChange}
                                onBlur={() => {
                                  handleCepBlur(formData.zipCode)
                                  autoCalculateByCep(formData.zipCode)
                                }}
                                placeholder="00000-000"
                                maxLength={9}
                                className={`${fieldClass} pr-10`}
                              />
                              {cepLoading && <Loader2 className="absolute right-3 top-3.5 animate-spin text-gray-400" size={20} />}
                            </div>
                            {isGpsAvailable && (
                              <button type="button" onClick={handleUseMyLocation} disabled={geoLoading} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#5D082A] disabled:opacity-60">
                                {geoLoading ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />}
                                {geoLoading ? 'Buscando sua localização...' : 'Usar minha localização'}
                              </button>
                            )}
                            {!geoLoading && locationStatus === 'gps-imprecise' && (
                              <p className="mt-1 text-xs text-amber-700">Localização aproximada: confira o endereço abaixo.</p>
                            )}
                          </div>

                          {precisaEscolherLocalidade && (
                            <div className="rounded-xl bg-[#F8F4EA] p-3">
                              <p className="text-sm font-semibold text-[#231F20]">{formData.locality ? `Localidade: ${formData.locality}` : 'Escolha sua localidade'}</p>
                              <p className="mt-0.5 text-xs text-[#5d4f33]">Este CEP atende mais de um lugar.</p>
                              <Button type="button" onClick={() => setLocalityModalOpen(true)} variant="outline" className="mt-2 w-full">
                                {formData.locality ? 'Trocar localidade' : 'Escolher minha localidade'}
                              </Button>
                            </div>
                          )}

                          <div>
                            <label htmlFor="street" className={labelClass}>Rua</label>
                            <Input id="street" name="street" autoComplete="address-line1" value={formData.street} onChange={handleInputChange} className={fieldClass} />
                          </div>
                          <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
                            <div>
                              <label htmlFor="number" className={labelClass}>Número</label>
                              <Input id="number" name="number" inputMode="numeric" value={formData.number} onChange={handleInputChange} className={fieldClass} />
                            </div>
                            <div>
                              <label htmlFor="complement" className={labelClass}>Complemento <span className="font-normal text-gray-400">(opcional)</span></label>
                              <Input id="complement" name="complement" autoComplete="address-line2" value={formData.complement} onChange={handleInputChange} placeholder="Casa, apto, bloco" className={fieldClass} />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="neighborhood" className={labelClass}>Bairro</label>
                            <Input id="neighborhood" name="neighborhood" value={formData.neighborhood} onChange={handleInputChange} className={fieldClass} />
                          </div>
                          <div className="grid grid-cols-[1fr_5rem] gap-3">
                            <div>
                              <label htmlFor="city" className={labelClass}>Cidade</label>
                              <Input id="city" name="city" autoComplete="address-level2" value={formData.city} onChange={handleInputChange} className={fieldClass} />
                            </div>
                            <div>
                              <label htmlFor="state" className={labelClass}>UF</label>
                              <Input id="state" name="state" autoComplete="address-level1" value={formData.state} onChange={handleInputChange} maxLength={2} className={`${fieldClass} uppercase`} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {deliveryLine && (
                    <p className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${deliveryLine.tone === 'warn' ? 'bg-amber-50 text-amber-900' : deliveryLine.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-[#F8F4EA] text-[#231F20]'}`}>
                      <Truck size={17} className="mt-px shrink-0" /> {deliveryLine.text}
                    </p>
                  )}
                  {!isPickup && (
                    <div className="mt-3">
                      <FreeShippingBar subtotal={subtotal} zoneFreeAbove={checkoutQuote?.delivery.freeAbove ?? deliveryCalc?.freeAbove} />
                    </div>
                  )}
                </section>
              </>
            )}

            {step === 'payment' && (
              <>
                {/* Onde e quando: o que foi decidido na etapa 1, com o atalho para mudar. */}
                <section className={cardClass}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8F4EA] text-[#5D082A]">
                      {isPickup ? <Store size={17} /> : <MapPin size={17} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6a3a]">{isPickup ? 'Retirada' : 'Entrega'}</p>
                      {isPickup ? (
                        <p className="text-sm font-semibold text-[#231F20]">Na loja, sem taxa</p>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-[#231F20]">{addressText}</p>
                          <p className="text-xs text-gray-500">{addressText2}</p>
                        </>
                      )}
                      {(user?.name || formData.guestName) && (
                        <p className="mt-1 text-xs text-gray-500">Para {user?.name || formData.guestName}</p>
                      )}
                    </div>
                    <button type="button" onClick={goBack} className="shrink-0 text-sm font-semibold text-[#5D082A] hover:underline">
                      Alterar
                    </button>
                  </div>

                  {scheduleOptions.length > 0 && (
                    <div className="mt-3 border-t border-[#E8D7B0]/60 pt-3">
                      <label htmlFor="scheduledFor" className={labelClass}>{isPickup ? 'Quando você vai retirar?' : 'Quando você quer receber?'}</label>
                      <select
                        id="scheduledFor"
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                        className="h-12 w-full rounded-xl border border-[#E8D7B0] bg-white px-3 text-base text-[#231F20] focus:border-[#5D082A] focus:outline-none focus:ring-1 focus:ring-[#5D082A]"
                      >
                        {asapAvailable && <option value="">O quanto antes</option>}
                        {[...new Set(scheduleOptions.map((option) => option.day))].map((day) => (
                          <optgroup key={day} label={day}>
                            {scheduleOptions.filter((option) => option.day === day).map((option) => (
                              <option key={option.value} value={option.value}>
                                {day} · a partir das {option.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {!asapAvailable && <p className="mt-1 text-xs text-[#5d4f33]">Estamos fechados agora: seu pedido fica agendado.</p>}
                    </div>
                  )}
                </section>

                <section className={cardClass}>
                  <h2 className="text-base font-bold text-[#231F20]">Como você quer pagar?</h2>
                  <p className="mt-0.5 text-xs text-[#5d4f33]">Você paga na entrega ou na retirada. O valor final é confirmado depois da separação, por causa do peso dos itens.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {[
                      { id: 'PIX', label: 'Pix', hint: 'Na entrega', icon: QrCode },
                      { id: 'CARD', label: 'Cartão', hint: 'Maquininha', icon: CreditCard },
                      { id: 'CASH', label: 'Dinheiro', hint: 'Com troco', icon: Banknote },
                      { id: 'VOUCHER', label: 'Vale-alimentação', hint: 'Maquininha', icon: Ticket },
                    ].map((method) => {
                      const active = formData.paymentMethod === method.id
                      const Icon = method.icon
                      return (
                        <label key={method.id} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 ${active ? 'border-[#5D082A] bg-[#5D082A]/5 ring-1 ring-[#5D082A]' : 'border-[#E8D7B0] bg-white'}`}>
                          <input type="radio" name="paymentMethod" value={method.id} checked={active} onChange={handleInputChange} className="sr-only" />
                          <Icon size={20} className={active ? 'text-[#5D082A]' : 'text-gray-400'} />
                          <span className="min-w-0">
                            <span className={`block text-sm font-bold ${active ? 'text-[#5D082A]' : 'text-[#231F20]'}`}>{method.label}</span>
                            <span className="block text-[11px] text-gray-500">{method.hint}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  {formData.paymentMethod === 'CASH' && (
                    <div className="mt-3 rounded-xl bg-[#F8F4EA] p-3">
                      <p className="text-sm font-semibold text-[#231F20]">Vai precisar de troco? Para quanto?</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[{ id: 'NO', label: 'Não preciso' }, ...buildChangeForOptions(payableTotal, 3).map((value) => ({ id: String(value), label: formatPrice(value) }))].map((opt) => {
                          const active = opt.id === 'NO' ? formData.needsChange !== 'YES' : formData.needsChange === 'YES' && String(formData.changeFor) === opt.id
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setFormData((prev) => (opt.id === 'NO' ? { ...prev, needsChange: 'NO', changeFor: '' } : { ...prev, needsChange: 'YES', changeFor: opt.id }))}
                              aria-pressed={active}
                              className={`h-10 rounded-full border px-3.5 text-sm font-semibold ${active ? 'border-[#5D082A] bg-[#5D082A] text-white' : 'border-[#E8D7B0] bg-white text-[#231F20]'}`}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </section>

                <section className={cardClass}>
                  <label htmlFor="notes" className={labelClass}>Recado para a entrega <span className="font-normal text-gray-400">(opcional)</span></label>
                  <Input id="notes" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Ex.: deixar na portaria, chamar no portão" className={fieldClass} />
                </section>

                <section className={cardClass}>
                  <h2 className="mb-2 text-base font-bold text-[#231F20]">Resumo</h2>
                  <OrderItemsSummary cart={cart} subtotal={checkoutQuote?.price.subtotal ?? subtotal} />
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-[#5d4f33]">
                      <dt>Itens</dt>
                      <dd className="tabular-nums">{formatPrice(checkoutQuote?.price.subtotal ?? subtotal)}</dd>
                    </div>
                    <div className="flex justify-between text-[#5d4f33]">
                      <dt>{isPickup ? 'Retirada' : `Entrega${deliveryZoneName ? ` (${deliveryZoneName})` : ''}`}</dt>
                      <dd className={`tabular-nums ${isPickup || deliveryIsFree ? 'font-semibold text-emerald-700' : ''}`}>
                        {isPickup || deliveryIsFree ? 'Grátis' : quotedDeliveryFee == null ? '—' : formatPrice(quotedDeliveryFee)}
                      </dd>
                    </div>
                    {quotedDiscount > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <dt>Desconto{couponCode ? ` (${couponCode})` : ''}</dt>
                        <dd className="tabular-nums">−{formatPrice(quotedDiscount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-[#E8D7B0]/60 pt-2 text-base font-black text-[#231F20]">
                      <dt>Total</dt>
                      <dd className="tabular-nums">{formatPrice(payableTotal)}</dd>
                    </div>
                  </dl>

                  <div className="mt-3">
                    {couponCode ? (
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm">
                        <span className="font-semibold text-emerald-800">Cupom {couponCode} aplicado</span>
                        <button type="button" onClick={removeCoupon} className="text-xs font-semibold text-gray-600 underline">Remover</button>
                      </div>
                    ) : couponOpen ? (
                      <div className="flex gap-2">
                        <input
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase().replace(/\s/g, ''))}
                          placeholder="Código do cupom"
                          aria-label="Código do cupom"
                          autoFocus
                          className="h-11 min-w-0 flex-1 rounded-xl border border-[#E8D7B0] bg-white px-3 text-base uppercase"
                        />
                        <button type="button" disabled={!couponInput.trim()} onClick={() => applyCoupon(couponInput).then((r) => r.valid && setCouponInput(''))} className="h-11 rounded-xl bg-[#5D082A] px-4 text-sm font-semibold text-white disabled:opacity-40">
                          Aplicar
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setCouponOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5D082A]">
                        <Ticket size={15} /> Tenho um cupom
                      </button>
                    )}
                  </div>

                  {checkoutQuote?.stock.unavailableItems.length ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="mb-1 font-semibold">Revise antes de finalizar</p>
                      {checkoutQuote.stock.unavailableItems.map((item) => (
                        <p key={item.productId}>
                          {nomeDoProdutoNoCarrinho(item.productId) || 'Item do carrinho'}: {item.message || 'saiu do site. Tire do carrinho para continuar.'}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {checkoutQuote?.delivery.slot?.windowStart && (
                    <p className="mt-3 text-xs text-[#5d4f33]">Janela prevista: {formatDeliveryWindow(checkoutQuote)}</p>
                  )}
                </section>
              </>
            )}

            <button type="button" onClick={() => navigate('/')} className="mx-auto flex h-11 items-center gap-1.5 px-3 text-sm font-semibold text-[#5D082A]">
              <ShoppingBag size={15} /> Continuar comprando
            </button>
          </form>
        )}
      </div>

      {step !== 'confirmation' && (
        <CheckoutActionBar
          error={checkoutError}
          onDismissError={() => setCheckoutError(null)}
          totalLabel={step === 'payment' || checkoutQuote ? 'Total' : deliveryEstimate > 0 ? 'Total com entrega' : 'Total'}
          total={barTotal}
        >
          <LoadingButton
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            isLoading={checkoutIsPending}
            loadingText={step === 'payment' ? 'Finalizando...' : 'Conferindo...'}
            className="h-12 w-full rounded-xl text-[15px]"
          >
            {step === 'payment' ? 'Finalizar pedido' : 'Continuar'}
          </LoadingButton>
        </CheckoutActionBar>
      )}

      <LoginSheet
        open={loginSheet.open}
        reason={loginSheet.reason}
        identifier={loginSheet.identifier}
        onClose={() => {
          pendingFinalizeRef.current = false
          setLoginSheet((prev) => ({ ...prev, open: false }))
        }}
        onLoggedIn={handleLoggedIn}
      />

      <LocalityPickerModal
        open={localityModalOpen && precisaEscolherLocalidade}
        options={deliveryCalc?.availableLocalities ?? []}
        selectedCode={formData.deliveryPointCode}
        onSelect={handleSelectLocality}
        onClose={() => setLocalityModalOpen(false)}
        onNone={handleNoneOfThese}
      />
    </div>
  )
}
