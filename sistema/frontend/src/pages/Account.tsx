import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, User, Clock, MapPin, RotateCcw, ChevronDown, ChevronUp, MessageCircle, RefreshCw, Banknote, QrCode, CreditCard, Plus, Pencil, Trash2, Star, X, Loader2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { useCustomerById, useOrders } from '../hooks/useOrders'
import { useCart } from '../hooks/useCart'
import { useBrand } from '../hooks/useBrand'
import { addressesAPI, type CreateAddressPayload } from '../services/api'
import { getApiErrorMessage } from '../utils/apiError'
import type { Address, Customer, Order, OrderItem } from '../types'
import { formatPrice, formatProductTitle } from '../utils/format'
import { parseChangeForFromNotes } from '../utils/changeOptions'
import { Badge } from '../components/ui/badge'
import { Button, buttonVariants } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { surfaceClasses } from '../components/ui/surface'
import { cn } from '../lib/cn'

function formatZipCode(value: string) {
  const clean = value.replace(/\D/g, '').slice(0, 8)
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean
}

const EMPTY_ADDRESS_FORM: CreateAddressPayload = {
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
  isDefault: false,
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluido',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

const ORDER_STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-[#F8F0DC] text-[#5D082A]',
  COMPLETED: 'bg-[#F8F0DC] text-[#5D082A]',
  DELIVERED: 'bg-[#F8F0DC] text-[#5D082A]',
  CANCELLED: 'bg-red-100 text-red-800',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CARD: 'Cartão na entrega',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Não pago',
  PENDING: 'Pendente',
  PAID: 'Pago',
  FAILED: 'Falhou',
  REFUNDED: 'Estornado',
}

function getStatusLabel(status: string) {
  return ORDER_STATUS_LABEL[status] || status
}

function getStatusClass(status: string) {
  return ORDER_STATUS_CLASS[status] || 'bg-gray-100 text-gray-800'
}

function getPaymentStatusClassName(status?: string) {
  switch ((status || '').toUpperCase()) {
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'FAILED':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'REFUNDED':
      return 'bg-slate-50 text-slate-700 border-slate-200'
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

function getPaymentMethodIcon(method?: string | null) {
  const key = String(method || '').toUpperCase()
  if (key === 'PIX') return <QrCode size={11} className="text-[#5D082A]" />
  if (key === 'CARD') return <CreditCard size={11} className="text-[#5D082A]" />
  return <Banknote size={11} className="text-[#5D082A]" />
}

function getPaymentMethodLabel(method?: string) {
  const key = String(method || 'CASH').toUpperCase()
  return PAYMENT_METHOD_LABEL[key] || key
}

function getInitials(name?: string) {
  const safeName = String(name || '').trim()
  if (!safeName) return 'AF'
  const parts = safeName.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || ''
  const second = parts[1]?.[0] || ''
  return `${first}${second}`.toUpperCase() || 'AF'
}

function Account() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user: customer, logout } = useAuth()
  const { contactWhatsapp } = useBrand()
  const [activeTab, setActiveTab] = useState('profile')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [paymentMethodFilter, setPaymentMethodFilter] = useState(() => {
    const value = String(searchParams.get('payMethod') || 'ALL').toUpperCase()
    return ['ALL', 'CASH', 'PIX', 'CARD'].includes(value) ? value : 'ALL'
  })
  const { data: orders, isLoading: ordersLoading, isFetching: ordersFetching } = useOrders(customer?.id)
  const { data: customerDetails, refetch: refetchCustomer } = useCustomerById(customer?.id)
  const { addItem } = useCart()
  const profile = (customerDetails || customer) as Customer

  const [addressFormOpen, setAddressFormOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [addressForm, setAddressForm] = useState<CreateAddressPayload>(EMPTY_ADDRESS_FORM)
const [addressFormLoading, setAddressFormLoading] = useState(false)
  const [addressFormError, setAddressFormError] = useState<string | null>(null)
  const [busyAddressId, setBusyAddressId] = useState<string | null>(null)
  const [addressActionError, setAddressActionError] = useState<string | null>(null)

  const refreshAddresses = () => {
    if (!customer?.id) return
    queryClient.invalidateQueries({ queryKey: ['customer', customer.id] })
    refetchCustomer()
  }

  const openNewAddressForm = () => {
    setAddressForm(EMPTY_ADDRESS_FORM)
    setEditingAddressId(null)
    setAddressFormError(null)
    setAddressFormOpen(true)
  }

  const openEditAddressForm = (address: Address) => {
    setAddressForm({
      street: address.street,
      number: address.number,
      complement: address.complement || '',
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      isDefault: address.isDefault,
    })
    setEditingAddressId(address.id)
    setAddressFormError(null)
    setAddressFormOpen(true)
  }

  const handleAddressFormChange = (field: keyof CreateAddressPayload, value: string | boolean) => {
    setAddressForm((prev) => ({
      ...prev,
      [field]: field === 'zipCode' ? formatZipCode(String(value)) : value,
    }))
  }

  const handleAddressFormSubmit = async () => {
    if (!customer?.id) return
    if (!addressForm.street.trim() || !addressForm.number.trim() || !addressForm.neighborhood.trim() ||
        !addressForm.city.trim() || !addressForm.state.trim() || addressForm.zipCode.replace(/\D/g, '').length !== 8) {
      setAddressFormError('Preencha todos os campos obrigatorios (CEP com 8 digitos).')
      return
    }

    setAddressFormLoading(true)
    setAddressFormError(null)
    try {
      if (editingAddressId) {
        await addressesAPI.update(customer.id, editingAddressId, addressForm)
      } else {
        await addressesAPI.create(customer.id, addressForm)
      }
      setAddressFormOpen(false)
      refreshAddresses()
    } catch (error) {
      setAddressFormError(getApiErrorMessage(error, 'Nao foi possivel salvar o endereco.'))
    } finally {
      setAddressFormLoading(false)
    }
  }

  const handleDeleteAddress = async (address: Address) => {
    if (!customer?.id) return
    if (!window.confirm(`Excluir o endereco ${address.street}, ${address.number}?`)) return

    setBusyAddressId(address.id)
    setAddressActionError(null)
    try {
      await addressesAPI.delete(customer.id, address.id)
      refreshAddresses()
    } catch (error) {
      setAddressActionError(getApiErrorMessage(error, 'Nao foi possivel excluir o endereco.'))
    } finally {
      setBusyAddressId(null)
    }
  }

  const handleSetDefault = async (address: Address) => {
    if (!customer?.id) return
    setBusyAddressId(address.id)
    setAddressActionError(null)
    try {
      await addressesAPI.setDefault(customer.id, address.id)
      refreshAddresses()
    } catch (error) {
      setAddressActionError(getApiErrorMessage(error, 'Nao foi possivel definir o endereco padrao.'))
    } finally {
      setBusyAddressId(null)
    }
  }

  const filteredOrders = useMemo(() => {
    if (!orders) return []

    return orders.filter((order: Order) => {
      const paymentMethod = String(order.paymentMethod || 'CASH').toUpperCase()

      const methodMatches = paymentMethodFilter === 'ALL' || paymentMethod === paymentMethodFilter

      return methodMatches
    })
  }, [orders, paymentMethodFilter])

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)

      if (paymentMethodFilter === 'ALL') next.delete('payMethod')
      else next.set('payMethod', paymentMethodFilter)

      return next
    }, { replace: true })
  }, [paymentMethodFilter, setSearchParams])

  const handleLogout = () => {
    logout()
  }

  const handleRepeatOrder = (order: Order) => {
    if (!order?.items?.length) return

    order.items.forEach((item: OrderItem) => {
      const fallbackName = item.product?.name
        ? formatProductTitle(item.product.name)
        : `Produto ${item.productId?.slice?.(-6) || ''}`

      addItem(
        {
          id: item.productId,
          ean: item.product?.ean || '',
          name: fallbackName,
          price: item.unitPrice || 0,
          promotionalPrice: item.unitPrice || 0,
          active: true,
        },
        item.quantity || 1,
      )
    })

    navigate('/cart')
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <header className="glass sticky top-0 z-50 border-b border-[#D2BB8A]/20">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Link to="/" className="flex items-center gap-3 w-fit">
              <div className="w-9 h-9 rounded-full bg-[#D2BB8A]/25 border border-[#D2BB8A]/40 flex items-center justify-center">
                <span className="text-caption font-bold tracking-wider text-[#5D082A]">AF</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#231F20]">
                Antenor <span className="text-[#5D082A]">& Filhos</span>
              </h1>
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className={surfaceClasses({ tone: 'warm', className: 'p-8 text-center' })}>
            <p className="text-gray-600 mb-6">Entre na sua conta para acompanhar pedidos e continuar comprando.</p>
            <Link
              to="/"
              className={buttonVariants({ variant: 'primary', size: 'md' })}
            >
              Ir para a loja
            </Link>
          </div>
        </main>
        <MobileBottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="glass border-b border-[#D2BB8A]/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#D2BB8A]/25 border border-[#D2BB8A]/40 flex items-center justify-center">
              <span className="text-caption font-bold tracking-wider text-[#5D082A]">AF</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#231F20]">
              Antenor <span className="text-[#5D082A]">& Filhos</span>
            </h1>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              onClick={handleLogout}
              variant="primary"
              size="md"
            >
              <LogOut size={18} />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className={surfaceClasses({ tone: 'warm', className: 'bg-gradient-to-r from-[#FBFAF7] via-white to-[#F8F4EA] p-6' })}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#F8F0DC] border border-[#E8D7B0] flex items-center justify-center">
                <span className="text-lg font-bold text-[#5D082A]">{getInitials(profile.name)}</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#231F20]">{profile.name}</h1>
                <p className="text-sm text-gray-600">{profile.email || profile.whatsapp}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="burgundy" className="h-7 px-3">
                Cliente
              </Badge>
              <Badge tone="neutral" className="h-7 px-3">
                Conta ativa
              </Badge>
            </div>
          </div>
        </div>

        <div className={surfaceClasses({ tone: 'warm', className: 'overflow-hidden' })}>
          <div className="px-4 pt-4">
            <div className="flex gap-2 p-1 rounded-lg bg-[#faf7f1] border border-[#E8D7B0]/40 overflow-x-auto no-scrollbar">
            <Button
              onClick={() => setActiveTab('profile')}
              variant={activeTab === 'profile' ? 'primary' : 'ghost'}
              size="md"
              className="shrink-0"
              aria-pressed={activeTab === 'profile'}
            >
              <User className="inline mr-2" size={20} />
              Perfil
            </Button>
            <Button
              onClick={() => setActiveTab('orders')}
              variant={activeTab === 'orders' ? 'primary' : 'ghost'}
              size="md"
              className="shrink-0"
              aria-pressed={activeTab === 'orders'}
            >
              <Clock className="inline mr-2" size={20} />
              Pedidos
            </Button>
            <Button
              onClick={() => setActiveTab('addresses')}
              variant={activeTab === 'addresses' ? 'primary' : 'ghost'}
              size="md"
              className="shrink-0"
              aria-pressed={activeTab === 'addresses'}
            >
              <MapPin className="inline mr-2" size={20} />
              Endereços
            </Button>
          </div>
          </div>

          <div className="p-6">
            {activeTab === 'profile' && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#E8D7B0] p-4 bg-[#FBFAF7]">
                  <label className="block text-xs font-semibold tracking-wide uppercase text-gray-500">Nome</label>
                  <p className="text-lg mt-1 text-[#231F20]">{profile.name}</p>
                </div>
                <div className="rounded-lg border border-[#E8D7B0] p-4 bg-[#FBFAF7]">
                  <label className="block text-xs font-semibold tracking-wide uppercase text-gray-500">Email</label>
                  <p className="text-lg mt-1 text-[#231F20]">{profile.email || 'Não informado'}</p>
                </div>
                <div className="rounded-lg border border-[#E8D7B0] p-4 bg-[#FBFAF7]">
                  <label className="block text-xs font-semibold tracking-wide uppercase text-gray-500">CPF</label>
                  <p className="text-lg mt-1 font-mono text-[#231F20]">
                    {profile.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E8D7B0] p-4 bg-[#FBFAF7]">
                  <label className="block text-xs font-semibold tracking-wide uppercase text-gray-500">WhatsApp</label>
                  <p className="text-lg mt-1 font-mono text-[#231F20]">
                    {profile.whatsapp?.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {ordersFetching && !ordersLoading && (
                      <>
                        <RefreshCw size={11} className="animate-spin text-[#5D082A]" />
                        <span>Atualizando...</span>
                      </>
                    )}
                  </div>
                  <label className="text-xs text-gray-600 inline-flex items-center gap-2">
                    Método:
                    <Select
                      value={paymentMethodFilter}
                      onChange={(e) => setPaymentMethodFilter(e.target.value)}
                      className="h-8 w-auto min-w-[150px] px-3 py-1 text-xs"
                    >
                      <option value="ALL">Todos</option>
                      <option value="CASH">Dinheiro</option>
                      <option value="PIX">PIX</option>
                      <option value="CARD">Cartão na entrega</option>
                    </Select>
                  </label>
                </div>
                {ordersLoading ? (
                  <p className="text-gray-600 text-center py-8">Buscando seus pedidos...</p>
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((order: Order) => {
                    const isExpanded = expandedOrderId === order.id
                    const isActive = ['PENDING', 'CONFIRMED'].includes(order.status)
                    const whatsappNumber = (contactWhatsapp || import.meta.env.VITE_CONTACT_WHATSAPP || '').replace(/\D/g, '')
                    const whatsappMsg = encodeURIComponent(`Olá! Gostaria de saber o status do meu pedido #${order.id.slice(-8).toUpperCase()}.`)
                    const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${whatsappMsg}` : null

                    return (
                    <div key={order.id} className={`rounded-lg border p-4 transition-colors ${isActive ? 'border-[#5D082A]/20 bg-[#FFF7FA]' : 'border-[#E8D7B0] bg-[#FBFAF7]'}`}>
                      <div className="flex justify-between items-start mb-2 gap-3">
                        <div>
                          <p className="font-mono text-sm text-gray-500">#{order.id.slice(-8).toUpperCase()}</p>
                          <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end items-center">
                          {isActive && <span className="inline-flex items-center gap-1 text-label text-[#5D082A] font-semibold"><RefreshCw size={9} className="animate-spin" /> ao vivo</span>}
                          <span className={`px-3 py-1 rounded-md text-xs font-semibold border border-transparent ${getStatusClass(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F8F0DC] px-2 py-0.5 text-xs font-semibold text-[#5D082A] border border-[#E8D7B0]/40">
                          {getPaymentMethodIcon(order.paymentMethod)}
                          {getPaymentMethodLabel(order.paymentMethod)}
                        </span>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${getPaymentStatusClassName(order.paymentStatus)}`}>
                          {PAYMENT_STATUS_LABELS[(order.paymentStatus || 'UNPAID').toUpperCase()] || order.paymentStatus || 'Não pago'}
                        </span>
                        {String(order.paymentMethod || '').toUpperCase() === 'CASH' && (() => {
                          const changeFor = parseChangeForFromNotes(order.notes)
                          if (!changeFor) return null
                          return (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                              <Banknote size={11} className="text-amber-700" />
                              Troco para R$ {changeFor.toFixed(2).replace('.', ',')}
                            </span>
                          )
                        })()}
                      </div>

                      <Button
                        type="button"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        variant="ghost"
                        size="sm"
                        className="mb-2 h-8 px-2 text-xs"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {order.items?.length ?? 0} {(order.items?.length ?? 0) === 1 ? 'item' : 'itens'}
                      </Button>

                      {isExpanded && (
                        <div className="space-y-1 mb-3 pl-1 border-l-2 border-[#E8D7B0]">
                          {order.items?.map((item: OrderItem) => (
                            <div key={item.id} className="flex justify-between text-sm text-[#231F20]">
                              <span>{formatProductTitle(item.product?.name || '')} <span className="text-gray-500">×{item.quantity}</span></span>
                              <span className="text-gray-600 tabular-nums">{formatPrice((item.unitPrice || 0) * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleRepeatOrder(order)}
                            variant="subtle"
                            size="sm"
                          >
                            <RotateCcw size={14} />
                            Repetir
                          </Button>
                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100')}
                            >
                              <MessageCircle size={14} />
                              WhatsApp
                            </a>
                          )}
                        </div>
                        <p className="text-right font-bold text-[#231F20]">{formatPrice(order.total)}</p>
                      </div>
                    </div>
                    )
                  })
                ) : (
                  <div>
                    <p className="text-gray-600 text-center py-8">
                      {orders && orders.length > 0
                        ? 'Nenhum pedido encontrado para esse filtro de pagamento.'
                        : 'Você ainda não fez nenhum pedido por aqui.'}
                    </p>
                    <Link
                      to="/"
                      className={buttonVariants({ variant: 'primary', size: 'md', className: 'w-full' })}
                    >
                      Ver produtos da loja
                    </Link>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'addresses' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm text-gray-600">Gerencie os endereços usados nas suas entregas.</p>
                  <Button type="button" onClick={openNewAddressForm} variant="primary" size="md">
                    <Plus size={16} />
                    Novo Endereço
                  </Button>
                </div>

                {addressActionError && (
                  <div className="flex items-start gap-2.5 rounded-lg border-2 border-red-300 bg-red-50 text-red-800 px-3 py-2.5 text-sm font-medium">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <span>{addressActionError}</span>
                  </div>
                )}

                {profile.addresses && profile.addresses.length > 0 ? (
                  profile.addresses.map((address: Address) => (
                    <div
                      key={address.id}
                      className="rounded-lg border border-[#E8D7B0] p-4 bg-[#FBFAF7]"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-[#231F20]">
                              {address.street}, {address.number}
                            </p>
                            {address.isDefault && (
                              <Badge tone="burgundy" className="h-6 px-2.5">
                                <Star size={11} className="mr-1" />
                                Padrão
                              </Badge>
                            )}
                          </div>
                          {address.complement && <p className="text-sm text-gray-600">{address.complement}</p>}
                          <p className="text-sm text-gray-600">
                            {address.neighborhood}, {address.city} - {address.state}
                          </p>
                          <p className="text-sm text-gray-600 font-mono">{address.zipCode}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!address.isDefault && (
                          <Button
                            type="button"
                            onClick={() => handleSetDefault(address)}
                            disabled={busyAddressId === address.id}
                            variant="subtle"
                            size="sm"
                          >
                            {busyAddressId === address.id ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                            Definir como padrão
                          </Button>
                        )}
                        <Button
                          type="button"
                          onClick={() => openEditAddressForm(address)}
                          variant="outline"
                          size="sm"
                        >
                          <Pencil size={14} />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleDeleteAddress(address)}
                          disabled={busyAddressId === address.id}
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                        >
                          {busyAddressId === address.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div>
                    <p className="text-gray-600 text-center py-6">
                      Você ainda não tem endereços salvos. Adicione um para agilizar suas próximas entregas.
                    </p>
                    <Button type="button" onClick={openNewAddressForm} variant="primary" size="md" className="w-full">
                      <Plus size={16} />
                      Adicionar meu primeiro endereço
                    </Button>
                  </div>
                )}

                {addressFormOpen && (
                  <div className="fixed inset-0 z-[110] bg-black/40 flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="address-form-title">
                    <div className={surfaceClasses({ tone: 'warm', className: 'w-full md:max-w-lg rounded-t-2xl md:rounded-lg p-5 md:p-6 shadow-2xl max-h-[92vh] overflow-auto' })}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 id="address-form-title" className="text-lg font-bold text-[#231F20]">
                          {editingAddressId ? 'Editar endereço' : 'Novo endereço'}
                        </h3>
                        <Button type="button" onClick={() => setAddressFormOpen(false)} variant="ghost" size="icon" aria-label="Fechar">
                          <X size={18} />
                        </Button>
                      </div>

                      {addressFormError && (
                        <div className="mb-3 flex items-start gap-2.5 rounded-lg border-2 border-red-300 bg-red-50 text-red-800 px-3 py-2.5 text-sm font-medium">
                          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                          <span>{addressFormError}</span>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">CEP *</label>
                          <Input
                            type="text"
                            value={addressForm.zipCode}
                            onChange={(e) => handleAddressFormChange('zipCode', e.target.value)}
                            placeholder="00000-000"
                            maxLength={9}
                            inputMode="numeric"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Rua *</label>
                          <Input
                            type="text"
                            value={addressForm.street}
                            onChange={(e) => handleAddressFormChange('street', e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Número *</label>
                            <Input
                              type="text"
                              value={addressForm.number}
                              onChange={(e) => handleAddressFormChange('number', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Complemento</label>
                            <Input
                              type="text"
                              value={addressForm.complement || ''}
                              onChange={(e) => handleAddressFormChange('complement', e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Bairro *</label>
                          <Input
                            type="text"
                            value={addressForm.neighborhood}
                            onChange={(e) => handleAddressFormChange('neighborhood', e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Cidade *</label>
                            <Input
                              type="text"
                              value={addressForm.city}
                              onChange={(e) => handleAddressFormChange('city', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Estado *</label>
                            <Input
                              type="text"
                              value={addressForm.state}
                              onChange={(e) => handleAddressFormChange('state', e.target.value.slice(0, 2).toUpperCase())}
                              maxLength={2}
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(addressForm.isDefault)}
                            onChange={(e) => handleAddressFormChange('isDefault', e.target.checked)}
                            className="accent-[#5D082A]"
                          />
                          Definir como endereço padrão
                        </label>
                      </div>

                      <div className="mt-5 flex gap-2 justify-end">
                        <Button type="button" onClick={() => setAddressFormOpen(false)} variant="ghost" size="md">
                          Cancelar
                        </Button>
                        <Button type="button" onClick={handleAddressFormSubmit} disabled={addressFormLoading} variant="primary" size="md">
                          {addressFormLoading && <Loader2 size={16} className="animate-spin" />}
                          {editingAddressId ? 'Salvar alterações' : 'Adicionar endereço'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <MobileBottomNav />
    </div>
  )
}

export default Account
