import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
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
import { authAPI, deliveryAPI, type CheckoutQuoteResponse, type FulfillmentSlot, type WhatsAppDispatch } from '../services/api'
import { Loader2, User, Banknote, QrCode, CreditCard, AlertTriangle, CheckCircle2, MapPin } from 'lucide-react'
import { LoadingButton } from '../components/LoadingButton'
import { getDeviceId } from '../utils/device'
import { trackEvent } from '../utils/analytics'
import type { Order } from '../types'
import { buildChangeForOptions, formatChangeForLabel } from '../utils/changeOptions'
import { getProductLineTotal, getProductPricePresentation } from '../utils/productPricing'
import { saveDeliveryAddress } from '../utils/deliveryAddress'
import { useFreeShipping } from '../hooks/useFreeShipping'
import { useAddressAutofill } from '../hooks/useAddressAutofill'
import {
  PAYMENT_METHOD_LABEL,
  createFallbackDeliverySlot,
  createIdempotencyKey,
  formatDeliveryWindow,
  getCheckoutBlockerMessage,
} from '../utils/checkout'
import { Button, buttonVariants } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Radio } from '../components/ui/radio'
import { surfaceClasses } from '../components/ui/surface'
import {
  formatZipCode,
  readDeliveryVerification,
  subscribeDeliveryVerification,
  verifyDeliveryForAddress,
} from '../services/deliveryVerification'

export default function Checkout() {
  const [step, setStep] = useState('address') // address, payment, confirmation
  const [whatsappDispatch, setWhatsappDispatch] = useState<WhatsAppDispatch | null>(null)
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cart, total, subtotal, clear, couponCode, discount } = useCart()
  const freeShipping = useFreeShipping(subtotal)
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
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutQuote, setCheckoutQuote] = useState<CheckoutQuoteResponse | null>(null)
  const { data: deliverySlots = [] } = useQuery({
    queryKey: ['delivery-slots', 'DELIVERY'],
    queryFn: async () => {
      const response = await deliveryAPI.slots('DELIVERY')
      return response.data
    },
    staleTime: 60_000,
  })

  const selectedDeliverySlot = useMemo(() => {
    const minCutoffBufferMs = 2 * 60 * 1000
    const usableSlot = (slot: FulfillmentSlot) => {
      const startsAtMs = new Date(slot.startsAt).getTime()

      return (
        slot.status === 'ACTIVE' &&
        !slot.cutoffExpired &&
        !slot.isFull &&
        Number(slot.availableOrders ?? 0) > 0 &&
        Number.isFinite(startsAtMs) &&
        startsAtMs > Date.now() + minCutoffBufferMs
      )
    }

    return deliverySlots.find(usableSlot) || null
  }, [deliverySlots])

  useEffect(() => {
    trackEvent('INITIATE_CHECKOUT', 'ORDER', undefined, { total })
  }, [])

  useEffect(() => {
    if (!guestCheckoutEnabled && !user) {
      navigate('/login', { replace: true })
    }
  }, [guestCheckoutEnabled, user, navigate])

  useEffect(() => {
    if (step === 'confirmation' && whatsappDispatch?.url) {
      const timer = setTimeout(() => {
        window.open(whatsappDispatch.url, '_blank', 'noopener,noreferrer')
      }, 1500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [step, whatsappDispatch])

  const [formData, setFormData] = useState(() => {
    const saved = readDeliveryVerification()?.address
    return {
      guestName: user?.name || '',
      guestWhatsapp: user?.whatsapp || '',
      guestCpf: user?.cpf || '',
      guestEmail: user?.email || '',
      street: saved?.street || '',
      number: saved?.number || '',
      complement: saved?.complement || '',
      neighborhood: saved?.neighborhood || '',
      city: saved?.city || '',
      state: saved?.state || '',
      zipCode: saved?.zipCode || '',
      paymentMethod: 'CASH',
      needsChange: 'NO',
      changeFor: '',
      notes: '',
    }
  })

  const {
    cepLoading,
    cepAutoFilled,
    geoLoading,
    locationStatus,
    handleCepBlur,
    handleUseMyLocation,
  } = useAddressAutofill({
    formData,
    setFormData,
    autoGpsEnabled: step === 'address',
  })

  const [deliveryCalc, setDeliveryCalc] = useState<{
    fee: number | null
    freeAbove: number | null
    zoneName: string | null
    isFree: boolean
    outOfArea: boolean
  } | null>(() => readDeliveryVerification()?.calc ?? null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    // Máscara automática de CEP
    if (name === 'zipCode') {
      setFormData((prev) => ({ ...prev, [name]: formatZipCode(value) }))
      return
    }
    
    setFormData((prev) => ({ ...prev, [name]: value }))
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
    if (selectedDeliverySlot) {
      return {
        mode: 'DELIVERY',
        zipCode: formData.zipCode,
        addressId: deliveryAddressId,
        slotId: selectedDeliverySlot.id,
        windowStart: selectedDeliverySlot.startsAt,
        windowEnd: selectedDeliverySlot.endsAt,
      }
    }

    if (!deliverySlotRef.current) {
      deliverySlotRef.current = createFallbackDeliverySlot()
    }

    return {
      mode: 'DELIVERY',
      zipCode: formData.zipCode,
      addressId: deliveryAddressId,
      ...deliverySlotRef.current,
    }
  }, [formData.zipCode, selectedDeliverySlot])

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
        await addBackendCartItem.mutateAsync({
          cartId: backendCartId,
          data: {
            productId: item.productId,
            quantity: item.quantity,
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
    user?.id,
  ])

  const payableTotal = checkoutQuote?.price.total ?? total
  const quotedDiscount = checkoutQuote?.price.discountAmount ?? discount
  const quotedDeliveryFee = checkoutQuote?.delivery.fee ?? deliveryCalc?.fee ?? null
  const deliveryZoneName = checkoutQuote?.delivery.zoneName ?? deliveryCalc?.zoneName ?? null
  const deliveryIsFree = quotedDeliveryFee === 0 || (!checkoutQuote && freeShipping.achieved)
  const checkoutIsPending =
    createAddress.isPending ||
    createBackendCart.isPending ||
    addBackendCartItem.isPending ||
    createCheckoutSession.isPending ||
    quoteCheckoutSession.isPending ||
    confirmCheckoutSession.isPending
  const checkoutSteps = [
    { id: 'address', label: 'Entrega' },
    { id: 'payment', label: 'Pagamento' },
    { id: 'confirmation', label: 'Confirmado' },
  ]
  const activeStepIndex = checkoutSteps.findIndex((item) => item.id === step)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCheckoutError(null)

    if (step === 'address') {
      try {
        const addressToValidate = {
          street: formData.street.trim(),
          number: formData.number.trim(),
          neighborhood: formData.neighborhood.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          zipCode: formData.zipCode.trim(),
        }

        if (!addressToValidate.street || !addressToValidate.number || !addressToValidate.neighborhood || !addressToValidate.city || !addressToValidate.state) {
          setCheckoutError('Preencha o endereco completo para continuar.')
          return
        }

        const calc = await verifyDeliveryForAddress({
          street: addressToValidate.street,
          number: addressToValidate.number,
          complement: formData.complement || null,
          neighborhood: addressToValidate.neighborhood,
          city: addressToValidate.city,
          state: addressToValidate.state,
          zipCode: addressToValidate.zipCode,
        })
        setDeliveryCalc(calc)

        if (calc.outOfArea) {
          setCheckoutError('Endereco fora da zona de entrega cadastrada.')
          return
        }

        const quote = await ensureCheckoutSession({ customerId: user?.id })
        if (!quote.canConfirm) {
          setCheckoutError(getCheckoutBlockerMessage(quote))
          return
        }

        setStep('payment')
      } catch (error) {
        setCheckoutError(getApiErrorMessage(error, 'Nao foi possivel validar endereco, estoque e zona de entrega. Revise os dados e tente novamente.'))
      }
      return
    }

    if (step === 'payment') {
      try {
        let customerId = user?.id

        if (!customerId) {
          const name = formData.guestName.trim()
          const whatsappDigits = formData.guestWhatsapp.replace(/\D/g, '')
          const cpfDigits = formData.guestCpf.replace(/\D/g, '')
          const generatedCpf = `9${whatsappDigits.padStart(10, '0').slice(-10)}`
          const normalizedEmail = formData.guestEmail.trim() || `guest.${whatsappDigits || Date.now()}@checkout.local`

          if (!name || !whatsappDigits) {
            setCheckoutError('Informe nome e WhatsApp para finalizar como convidado.')
            return
          }

          const guestAuth = await authAPI.guestCheckout({
            name,
            whatsapp: whatsappDigits,
            cpf: cpfDigits || generatedCpf,
            email: normalizedEmail,
          })

          const { access_token, user: guestUser } = guestAuth.data
          localStorage.setItem('token', access_token)
          localStorage.setItem('user', JSON.stringify(guestUser))
          customerId = guestUser.id
        }

        if (!customerId) {
          throw new Error('Não foi possível identificar o cliente para finalizar o pedido')
        }

        const deliveryAddress = {
          street: formData.street,
          number: formData.number,
          complement: formData.complement || null,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode || '00000000',
          isDefault: true,
        }

        const createdAddressResponse = await createAddress.mutateAsync({
          customerId: customerId,
          data: deliveryAddress,
        })
        const deliveryAddressId =
          typeof createdAddressResponse.data?.id === 'string'
            ? createdAddressResponse.data.id
            : undefined

        saveDeliveryAddress(deliveryAddress)

        if (!deliveryCalc || deliveryCalc.outOfArea || deliveryCalc.fee == null) {
          setCheckoutError('Endereco fora da zona de entrega cadastrada.')
          return
        }

        const changeAmount =
          formData.paymentMethod === 'CASH' && formData.needsChange === 'YES' && formData.changeFor
            ? formData.changeFor
            : undefined

        const quote = await ensureCheckoutSession({ customerId, deliveryAddressId })
        if (!quote.canConfirm) {
          setCheckoutError(getCheckoutBlockerMessage(quote))
          return
        }

        const orderResponse = await confirmCheckoutSession.mutateAsync({
          id: quote.session.id,
          data: {
            customerId,
            paymentMethod: formData.paymentMethod,
            notes: formData.notes?.trim() || undefined,
            changeAmount,
            deviceId: getDeviceId(),
            deliveryAddressId,
            delivery: getDeliveryPayload(deliveryAddressId),
            couponCode: couponCode || undefined,
          },
        })

        setCreatedOrder(orderResponse.data.order)
        setWhatsappDispatch(orderResponse.data.whatsapp)
        orderIdempotencyKeyRef.current = null
        backendCartIdRef.current = null
        checkoutSessionIdRef.current = null
        clear()
        setStep('confirmation')
      } catch (error) {
        setCheckoutError(getApiErrorMessage(error, 'Nao foi possivel concluir o pedido.'))
      }
    }
  }
  if (cart.length === 0 && step !== 'confirmation') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F8F4EA] via-[#FBFAF7] to-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[#5d4f33] mb-4">Seu carrinho está vazio no momento.</p>
          <Button
            onClick={() => navigate('/')}
            variant="primary"
          >
            Ver produtos da loja
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F4EA] via-[#FBFAF7] to-white py-6 md:py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl md:text-3xl font-bold text-[#231F20] mb-4 md:mb-8">Finalizar pedido</h1>

        <div className="mb-5 rounded-lg border border-[#E8D7B0] bg-white px-3 py-3 shadow-sm">
          <div className="grid grid-cols-3 gap-2">
            {checkoutSteps.map((item, index) => {
              const isComplete = index < activeStepIndex
              const isActive = index === activeStepIndex
              return (
                <div key={item.id} className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      isComplete || isActive
                        ? 'bg-[#5D082A] text-white'
                        : 'bg-[#F5F1E8] text-[#8A6A3A]'
                    }`}
                  >
                    {isComplete ? '✓' : index + 1}
                  </span>
                  <span className={`truncate text-xs font-bold ${isActive ? 'text-[#5D082A]' : 'text-[#5d4f33]'}`}>
                    {item.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Customer summary */}
        {step !== 'confirmation' && (user || formData.guestName) && (
          <div className="bg-white rounded-xl p-4 mb-5 border border-[#E8D7B0] flex items-center gap-3 shadow-sm">
            <span className="w-9 h-9 rounded-full bg-[#F8F0DC] flex items-center justify-center border border-[#E8D7B0]/60 text-[#5D082A]">
              <User size={18} />
            </span>
            <div>
              <p className="font-semibold text-[#231F20]">{user?.name || formData.guestName}</p>
              <p className="text-sm text-gray-500">{user?.email || user?.whatsapp || formData.guestWhatsapp}</p>
            </div>
          </div>
        )}
        {checkoutError && step !== 'confirmation' && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />
            <span>{checkoutError}</span>
          </div>
        )}
        {step !== 'confirmation' && cart.length > 0 && (
          <div className="mb-5 rounded-lg border border-[#E8D7B0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#8A6A3A]">Revisão rápida</p>
                <p className="mt-1 text-sm font-bold text-[#231F20]">
                  {cart.length} {cart.length === 1 ? 'item' : 'itens'} no pedido
                </p>
              </div>
              <p className="text-lg font-black text-[#5D082A]">{formatPrice(total)}</p>
            </div>
            <div className="mt-3 space-y-2">
              {cart.slice(0, 3).map((item) => (
                <div key={item.productId} className="flex items-start justify-between gap-3 rounded-lg bg-[#FBFAF7] px-3 py-2 text-xs">
                  <span className="min-w-0 font-semibold text-[#231F20] line-clamp-2">
                    {item.product?.name || item.productId} x{item.quantity}
                  </span>
                  <span className={`shrink-0 rounded-md px-2 py-1 font-bold ${
                    item.allowSubstitution === false
                      ? 'bg-red-50 text-red-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    Substituição: {item.allowSubstitution === false ? 'não' : 'sim'}
                  </span>
                </div>
              ))}
              {cart.length > 3 && <p className="text-xs text-[#5d4f33]">+{cart.length - 3} item(ns) no resumo final.</p>}
            </div>
          </div>
        )}
        {step === 'confirmation' ? (
          <div className="bg-white border border-[#D2BB8A]/40 rounded-2xl p-8 text-center shadow-[0_12px_40px_rgba(93,8,42,0.04)] animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-[#FFF7FA] border border-[#5D082A]/15 flex items-center justify-center mx-auto mb-5 text-[#5D082A] shadow-inner">
              <CheckCircle2 size={36} className="animate-bounce-short" />
            </div>
            <h2 className="text-2xl font-bold text-[#5D082A] mb-2 font-outfit">Pedido Confirmado!</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Seu pedido já está pronto para ser enviado no WhatsApp com todos os detalhes.
            </p>
            {createdOrder && (() => {
              const methodKey = String(createdOrder.paymentMethod || 'CASH').toUpperCase()
              const badgeLabel = PAYMENT_METHOD_LABEL[methodKey] || createdOrder.paymentMethod || 'Dinheiro'
              const badgeIcon = methodKey === 'PIX' ? <QrCode size={12} className="text-[#5D082A]" /> : methodKey === 'CARD' ? <CreditCard size={12} className="text-[#5D082A]" /> : <Banknote size={12} className="text-[#5D082A]" />
              const changeAmount = createdOrder.notes?.match(/Troco para:\s*([^)]*)/)?.[1]
              
              return (
                <div className="mb-6 rounded-xl border border-[#E8D7B0]/60 bg-[#FBFAF7] p-5 text-left space-y-4 shadow-sm">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm border-b border-[#E8D7B0]/30 pb-3">
                    <span className="text-gray-500 font-medium">Pedido</span>
                    <span className="font-mono text-right text-gray-800 font-bold">#{createdOrder.id.slice(-8).toUpperCase()}</span>
                    
                    <span className="text-gray-500 font-medium">Pagamento</span>
                    <div className="flex justify-end">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F8F0DC] px-2 py-0.5 text-xs font-semibold text-[#5D082A] border border-[#E8D7B0]/40">
                        {badgeIcon}
                        {badgeLabel}
                      </span>
                    </div>

                    {(() => {
                      const pStatus = String(createdOrder.paymentStatus || 'UNPAID').toUpperCase()
                      const statusConfig: Record<string, { label: string; cls: string }> = {
                        PAID: { label: 'Pago', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                        AUTHORIZED: { label: 'Autorizado', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
                        PENDING: { label: 'Pagamento pendente', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
                        FAILED: { label: 'Pagamento falhou', cls: 'bg-red-50 text-red-800 border-red-200' },
                        UNPAID: { label: 'Aguardando pagamento', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
                      }
                      const cfg = statusConfig[pStatus] ?? { label: pStatus, cls: 'bg-gray-50 text-gray-700 border-gray-200' }
                      return (
                        <>
                          <span className="text-gray-500 font-medium">Status</span>
                          <div className="flex justify-end">
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border ${cfg.cls}`}>
                              {cfg.label}
                            </span>
                          </div>
                        </>
                      )
                    })()}

                    {methodKey === 'CASH' && changeAmount && (
                      <>
                        <span className="text-gray-500 font-medium">Troco</span>
                        <div className="flex justify-end">
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                            <Banknote size={12} className="text-amber-700" />
                            Troco para R$ {changeAmount}
                          </span>
                        </div>
                      </>
                    )}

                    <span className="text-gray-500 font-semibold text-base mt-1">Total</span>
                    <span className="font-bold text-right text-base text-[#5D082A] mt-1">{formatPrice(createdOrder.total)}</span>
                  </div>

                  <div className="rounded-xl bg-[#FFF7FA] border border-[#5D082A]/10 p-3.5 flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-[#5D082A] shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-700 leading-relaxed font-medium">
                      O valor final será confirmado pela equipe após a separação dos itens (em função do peso real e possíveis substituições).
                    </p>
                  </div>
                </div>
              )
            })()}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              {whatsappDispatch?.url && (
                <a
                  href={whatsappDispatch.url}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: 'primary', size: 'md' })}
                >
                  Enviar no WhatsApp
                </a>
              )}
              <Button
                onClick={() => navigate('/')}
                variant="secondary"
              >
                Continuar comprando
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pb-28 md:pb-0">
            {/* Steps Indicator */}
            <div className="hidden gap-4 mb-8 md:flex">
              {['address', 'payment'].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-2 rounded ${
                    s === step || step === 'payment'
                      ? 'bg-[#5D082A]'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Address Step */}
            {step === 'address' && (
              <div className={surfaceClasses({ tone: 'warm', className: 'space-y-4 p-6' })}>
                <h2 className="text-xl font-bold mb-4">Onde vamos entregar?</h2>

                {!user && guestCheckoutEnabled && (
                  <>
                    <div className="rounded-lg border border-[#D2BB8A]/50 bg-[#FBFAF7] p-4 space-y-4">
                      <h3 className="font-semibold text-[#231F20]">Seus dados para o pedido</h3>
                      <div>
                        <label htmlFor="guestName" className="block text-sm font-medium mb-1">Nome</label>
                        <Input
                          id="guestName"
                          type="text"
                          name="guestName"
                          value={formData.guestName}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="guestWhatsapp" className="block text-sm font-medium mb-1">WhatsApp</label>
                          <Input
                            id="guestWhatsapp"
                            type="text"
                            name="guestWhatsapp"
                            value={formData.guestWhatsapp}
                            onChange={handleInputChange}
                            placeholder="(11) 99999-9999"
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="guestCpf" className="block text-sm font-medium mb-1">CPF (opcional)</label>
                          <Input
                            id="guestCpf"
                            type="text"
                            name="guestCpf"
                            value={formData.guestCpf}
                            onChange={handleInputChange}
                            placeholder="Somente numeros"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="guestEmail" className="block text-sm font-medium mb-1">Email (opcional)</label>
                        <Input
                          id="guestEmail"
                          type="email"
                          name="guestEmail"
                          value={formData.guestEmail}
                          onChange={handleInputChange}
                          placeholder="voce@email.com"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="rounded-lg border border-[#D2BB8A]/40 bg-[#FBFAF7] px-3 py-2 text-xs text-[#5d4f33]">
                  {geoLoading && 'Tentando localizar via GPS...'}
                  {!geoLoading && locationStatus === 'gps-success' && 'Endereco inicial preenchido via GPS. Confira e confirme os dados.'}
                  {!geoLoading && locationStatus === 'gps-fallback' && 'GPS indisponivel. Continue pelo CEP para preencher automaticamente.'}
                  {!geoLoading && locationStatus === 'idle' && 'Ao abrir o cadastro tentamos localizar via GPS automaticamente.'}
                </div>

                <div>
                  <label htmlFor="zipCode" className="block text-sm font-medium mb-1">
                    CEP
                    {cepAutoFilled && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                        Preenchido
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Input
                      id="zipCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{5}-?[0-9]{3}"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      onBlur={() => handleCepBlur(formData.zipCode)}
                      placeholder="00000-000"
                      maxLength={9}
                      required
                      className="pr-10"
                    />
                    {cepLoading && (
                      <Loader2 className="absolute right-3 top-2.5 animate-spin text-gray-400" size={20} />
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={geoLoading}
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-auto px-0 py-0 text-xs font-semibold text-[#5D082A] hover:bg-transparent hover:text-[#4a0621]"
                  >
                    {geoLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} className="text-[#5D082A]" />}
                    {geoLoading ? 'Obtendo localizacao...' : 'Tentar GPS novamente'}
                  </Button>
                </div>

                <div>
                  <label htmlFor="street" className="block text-sm font-medium mb-1">Rua</label>
                  <Input
                    id="street"
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="number" className="block text-sm font-medium mb-1">Número</label>
                    <Input
                      id="number"
                      type="text"
                      name="number"
                      value={formData.number}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="complement" className="block text-sm font-medium mb-1">Complemento</label>
                    <Input
                      id="complement"
                      type="text"
                      name="complement"
                      value={formData.complement}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="neighborhood" className="block text-sm font-medium mb-1">Bairro</label>
                  <Input
                    id="neighborhood"
                    type="text"
                    name="neighborhood"
                    value={formData.neighborhood}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium mb-1">Cidade</label>
                    <Input
                      id="city"
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium mb-1">Estado</label>
                    <Input
                      id="state"
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      maxLength={2}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Payment Step */}
            {step === 'payment' && (
              <div className={surfaceClasses({ tone: 'warm', className: 'space-y-4 p-6' })}>
                <h2 className="text-xl font-bold mb-4">Como você quer pagar?</h2>

                <div className="rounded-lg border border-[#D2BB8A]/50 bg-[#FBFAF7] p-4 text-sm text-[#5d4f33]">
                  Você está apenas informando como prefere pagar. O pagamento será fechado pela equipe após a separação do pedido, porque o valor final pode mudar por peso real, corte ou substituição de item.
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'CASH', label: 'Dinheiro', icon: <Banknote className="w-5 h-5 text-[#5D082A]" /> },
                    { id: 'PIX', label: 'PIX (Copia e Cola)', icon: <QrCode className="w-5 h-5 text-[#5D082A]" /> },
                    { id: 'CARD', label: 'Cartão na Entrega', icon: <CreditCard className="w-5 h-5 text-[#5D082A]" /> },
                  ].map((method) => (
                    <label
                      key={method.id}
                      className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.paymentMethod === method.id
                          ? 'border-[#5D082A] bg-gradient-to-r from-[#F8F4EA] to-white shadow-[0_4px_20px_rgba(93,8,42,0.06)]'
                          : 'border-gray-100 hover:border-[#D2BB8A]/40 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-9 h-9 rounded-full bg-[#F8F0DC] flex items-center justify-center border border-[#E8D7B0]/60 shrink-0">
                          {method.icon}
                        </span>
                        <div>
                          <p className="font-bold text-gray-800">{method.label}</p>
                          <p className="text-xs text-gray-500">
                            {method.id === 'CASH' && 'Você paga quando receber'}
                            {method.id === 'PIX' && 'Pagamento rápido por chave PIX'}
                            {method.id === 'CARD' && 'Cartão na entrega com maquininha'}
                          </p>
                        </div>
                      </div>
                      <Radio
                        name="paymentMethod"
                        value={method.id}
                        checked={formData.paymentMethod === method.id}
                        onChange={handleInputChange}
                      />
                    </label>
                  ))}
                </div>

                {/* Conditional Fields */}
                {formData.paymentMethod === 'CASH' && (
                  <div className="mt-4 p-4 bg-[#F8F4EA] rounded-lg border border-[#D2BB8A]/30 animate-in fade-in slide-in-from-top-2">
                    <p className="block text-sm font-medium text-[#5D082A] mb-2">Vai precisar de troco?</p>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { id: 'NO', label: 'Não' },
                        { id: 'YES', label: 'Sim' },
                      ].map((opt) => (
                        <label key={opt.id} className="inline-flex items-center gap-2 text-sm text-[#231F20]">
                          <Radio
                            name="needsChange"
                            value={opt.id}
                            checked={formData.needsChange === opt.id}
                            onChange={(e) => {
                              const value = e.target.value
                              const nextChangeFor =
                                value === 'YES'
                                  ? String(buildChangeForOptions(payableTotal, 3)[0])
                                  : ''
                              setFormData((prev) => ({
                                ...prev,
                                needsChange: value,
                                changeFor: nextChangeFor,
                              }))
                            }}
                            className="h-4 w-4"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>

                    {formData.needsChange === 'YES' && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-[#5D082A]/80">Selecione o valor para troco:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {buildChangeForOptions(payableTotal, 3).map((value) => (
                            <Button
                              key={value}
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, changeFor: String(value) }))}
                              variant={String(value) === String(formData.changeFor) ? 'primary' : 'outline'}
                              size="sm"
                            >
                              {formatChangeForLabel(value)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Algum recado para a entrega?
                  </label>
                  <Input
                    type="text"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Ex: deixar na portaria ou chamar no portão"
                  />
                </div>

                {/* Order Summary */}
                <div className="mt-6 border-t pt-6">
                  <h3 className="font-bold mb-3">Confira seu pedido</h3>
                  <div className="space-y-2 text-sm">
                    {cart.map((item) => (
                      <div key={item.productId} className="flex justify-between gap-3">
                        <div>
                          <span>
                            {item.product?.name} x{item.quantity}
                          </span>
                          {item.product?.isFractional && (
                            <>
                              <p className="text-xs text-gray-500">
                                {item.product?.alternativeDescription || `Fracionado (${(item.product?.unit || 'un').toUpperCase()})`}
                              </p>
                              <p className="text-xs text-[#5d4f33]">
                                {item.product ? getProductPricePresentation(item.product).fullLabel : ''}
                              </p>
                            </>
                          )}
                          <p className="mt-1 text-xs text-[#5d4f33]">
                            Substituição: {item.allowSubstitution === false ? 'não autorizada' : 'autorizada'}
                          </p>
                        </div>
                        <span>
                          {formatPrice(item.product ? getProductLineTotal(item.product, item.quantity) : 0)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm mt-4 border-t pt-2">
                      <span>Subtotal</span>
                      <span>{formatPrice(checkoutQuote?.price.subtotal ?? subtotal)}</span>
                    </div>
                    {quotedDiscount > 0 && (
                      <div className="flex justify-between text-sm text-emerald-700">
                        <span>Descontos</span>
                        <span>-{formatPrice(quotedDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg mt-2 border-t pt-2">
                      <span>Total:</span>
                      <span className="text-[#5D082A]">{formatPrice(payableTotal)}</span>
                    </div>
                    {((checkoutQuote && !checkoutQuote.delivery.outOfArea) || (deliveryCalc && !deliveryCalc.outOfArea)) && (
                      <div className="flex justify-between text-sm mt-1 text-gray-600">
                        <span>Entrega{deliveryZoneName ? ` (${deliveryZoneName})` : ''}</span>
                        <span className={deliveryIsFree ? 'text-emerald-600 font-semibold' : ''}>
                          {deliveryIsFree
                            ? 'Grátis'
                            : quotedDeliveryFee == null
                            ? 'Indisponivel'
                            : formatPrice(quotedDeliveryFee)}
                        </span>
                      </div>
                    )}
                    {checkoutQuote?.delivery.validSlot && (
                      <div className="flex justify-between text-sm mt-1 text-gray-600">
                        <span>Janela</span>
                        <span>{formatDeliveryWindow(checkoutQuote)}</span>
                      </div>
                    )}
                    {checkoutQuote?.stock.unavailableItems.length ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <p className="font-semibold mb-1">Itens indisponiveis</p>
                        {checkoutQuote.stock.unavailableItems.map((item) => (
                          <p key={item.productId}>
                            {cart.find((cartItem) => cartItem.productId === item.productId)?.product?.name || item.productId}: solicitado {item.requested}, disponivel {item.available}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {checkoutQuote?.stock.items.length ? (
                      <div className="text-xs text-gray-500">
                        Substituicoes: {checkoutQuote.stock.items.every((item) => item.allowSubstitution) ? 'aceitas para os itens' : 'ha itens sem substituicao aceita'}.
                      </div>
                    ) : null}
                    {deliveryCalc?.outOfArea && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1 font-semibold">
                        <AlertTriangle size={13} />
                        CEP fora da área de entrega. Entre em contato.
                      </p>
                    )}
                    {freeShipping.enabled && deliveryIsFree && (
                      <p className="text-xs text-emerald-600 font-semibold text-center mt-1.5 flex items-center justify-center gap-1 bg-emerald-50 border border-emerald-100 rounded-md py-1 animate-pulse">
                        <CheckCircle2 size={13} />
                        Frete grátis incluído!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation & Action Buttons */}
            <div className="sticky bottom-0 z-40 -mx-4 border-t border-[#D2BB8A]/40 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(35,31,32,0.12)] backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
              {/* Primary Actions */}
              <div className="flex gap-3">
                {step !== 'address' && (
                  <Button
                    type="button"
                    onClick={() => {
                      if (step === 'payment') setStep('address')
                    }}
                    variant="outline"
                    className="min-h-14 flex-1 py-3.5"
                  >
                    ← Voltar
                  </Button>
                )}
                <LoadingButton
                  type="submit"
                  isLoading={checkoutIsPending}
                  loadingText={step === 'payment' ? 'Finalizando...' : 'Aguarde...'}
                  className="flex-[2] min-h-14 py-3.5 text-base rounded-lg shadow-lg"
                >
                  {step === 'payment' ? '✓ Finalizar pedido' : 'Continuar →'}
                </LoadingButton>
              </div>
              
              {/* Secondary: Continue Shopping */}
              <Button
                type="button"
                onClick={() => navigate('/')}
                variant="secondary"
                className="mt-3 hidden w-full items-center justify-center gap-2 py-3 text-sm md:flex"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                Continuar comprando
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
