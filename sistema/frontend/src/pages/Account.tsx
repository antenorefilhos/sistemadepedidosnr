import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Banknote, Check, ChevronDown, ChevronRight, CreditCard, FileText, Loader2, LogOut, MapPin, MessageCircle, Package,
  Pencil, Plus, QrCode, RotateCcw, ShoppingCart, Star, Store, Trash2, Truck, User, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import NotificationBell from '../components/NotificationBell'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { PushAlertsCard } from '../components/PushAlertsCard'
import { ACTIVE_ORDER_STATUSES, useCustomerById, useOrders } from '../hooks/useOrders'
import { useCart } from '../hooks/useCart'
import { useBrand } from '../hooks/useBrand'
import { addressesAPI, authAPI, customersAPI, deliveryAPI, ordersAPI, productsAPI, type CreateAddressPayload, type DeliveryLocalityOption } from '../services/api'
import { fetchAddressByCep } from '../services/deliveryVerification'
import { getApiErrorMessage } from '../utils/apiError'
import type { Address, Customer, Order, Product } from '../types'
import { formatPrice, formatProductTitle } from '../utils/format'
import { getProductStep } from '../utils/productPricing'
import { getProductCardViewModel } from '../utils/productCard'
import { parseChangeForFromNotes } from '../utils/changeOptions'
import { buttonVariants } from '../components/ui/button'
import { cn } from '../lib/cn'
import { firstName, formatPhone, formatWhen, formatZip, initials, itemQuantity, maskCpf, orderStep } from '../utils/account'
import { SubstitutionChoice } from '../components/SubstitutionChoice'
import { pendingSuggestions } from '../utils/substitution'

// Conta refeita em 07/10/2026 (revisao de UI/UX do storefront, a pagina que o
// Jonathan apontou como a que mais precisava). Celular primeiro:
// - quem nao entrou ve "Entrar" e "Criar conta" (antes so "Ir para a loja");
// - abre em Pedidos, com o pedido em andamento acompanhado no topo (etapas,
//   atualiza sozinho) e "Comprar de novo" com o preco de hoje -- antes o
//   repetir usava o preco antigo e, no pesavel, a quantidade em kg como numero
//   de porcoes;
// - endereco com CEP que preenche a rua e a localidade do frete;
// - o cliente edita nome, e-mail e WhatsApp e cria ou troca a senha.

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Recebido',
  CONFIRMED: 'Confirmado',
  PICKING_PENDING: 'Na fila de separação',
  PICKING: 'Sendo separado',
  // Faltou item e o separador sugeriu trocas: o cliente escolhe aqui ou no WhatsApp (08/10/2026).
  WAITING_CUSTOMER_SUBSTITUTION: 'Escolha as trocas do seu pedido',
  CONFERENCE_PENDING: 'Em conferência',
  PACKING: 'Sendo embalado',
  READY_FOR_CHECKOUT: 'Finalizando no caixa',
  READY_FOR_DELIVERY: 'Pronto para entrega',
  READY_FOR_PICKUP: 'Pronto para retirar',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  FAILED_DELIVERY: 'Entrega não concluída',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reembolsado',
}
const PROBLEM_STATUSES = ['CANCELLED', 'REFUNDED', 'FAILED_DELIVERY']
const PAYMENT_METHOD_LABEL: Record<string, string> = { CASH: 'Dinheiro', PIX: 'PIX', CARD: 'Cartão na entrega' }

const isActive = (status: string) => ACTIVE_ORDER_STATUSES.includes(status)

const thumb = (ean?: string) => (ean ? `/thumbs/products/${ean}.webp?v=3` : '')

type Tab = 'pedidos' | 'enderecos' | 'dados'
const TABS: Array<{ key: Tab; label: string; icon: typeof Package }> = [
  { key: 'pedidos', label: 'Pedidos', icon: Package },
  { key: 'enderecos', label: 'Endereços', icon: MapPin },
  { key: 'dados', label: 'Meus dados', icon: User },
]

export default function Account() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user, logout } = useAuth()
  const { count: cartCount } = useCart()
  const tab = (TABS.some((t) => t.key === params.get('aba')) ? params.get('aba') : 'pedidos') as Tab
  const setTab = (next: Tab) => setParams((prev) => {
    const p = new URLSearchParams(prev)
    if (next === 'pedidos') p.delete('aba')
    else p.set('aba', next)
    return p
  }, { replace: true })

  const { data: orders = [], isLoading: ordersLoading } = useOrders(user?.id)
  const { data: customerDetails, refetch: refetchCustomer } = useCustomerById(user?.id)
  const profile = (customerDetails || user) as Customer | undefined
  const { data: fidelidade } = useQuery({
    queryKey: ['fidelidade', user?.id],
    queryFn: () => customersAPI.getFidelidade(user!.id).then((r) => r.data),
    enabled: Boolean(user?.id),
    staleTime: 1000 * 60 * 10,
  })

  const header = (
    <header className="sticky top-0 z-50 border-b border-[#E8D7B0]/60 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-1.5 px-2 py-2 sm:px-4">
        <button type="button" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))} aria-label="Voltar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
          <ArrowLeft size={22} />
        </button>
        <h1 className="flex-1 text-lg font-bold text-[#231F20]">Minha conta</h1>
        <Link to="/cart" aria-label={cartCount > 0 ? `Carrinho com ${cartCount} itens` : 'Carrinho vazio'} className="relative flex h-11 w-11 items-center justify-center rounded-full text-[#231F20] hover:bg-[#F8F4EA]">
          <ShoppingCart size={22} />
          {cartCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#5D082A] px-1 text-[10px] font-bold text-white">{cartCount > 9 ? '9+' : cartCount}</span>
          )}
        </Link>
        {user && <NotificationBell />}
      </div>
    </header>
  )

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FBFAF7] pb-24">
        {header}
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="rounded-3xl border border-[#E8D7B0]/70 bg-white p-6 text-center">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F8F2E6] text-[#5D082A]">
              <User size={28} />
            </span>
            <p className="text-lg font-bold text-[#231F20]">Entre na sua conta</p>
            <ul className="mx-auto mt-3 max-w-xs space-y-1.5 text-left text-sm text-[#5d4f33]">
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#5D082A]" /> Acompanhe o pedido até chegar</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#5D082A]" /> Compre de novo com um toque</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#5D082A]" /> Endereços salvos e frete certo</li>
            </ul>
            <div className="mt-6 flex flex-col gap-2">
              <Link to="/login?redirect=/account" className={buttonVariants({ size: 'lg', className: 'w-full rounded-xl' })}>Entrar</Link>
              <Link to="/register" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-full rounded-xl' })}>Criar conta</Link>
            </div>
          </div>
        </main>
        <MobileBottomNav />
      </div>
    )
  }

  // Pedido esperando a escolha das trocas vem primeiro: e onde o cliente precisa agir.
  const activeOrder = orders.find((o: Order) => isActive(o.status) && pendingSuggestions(o).length > 0)
    || orders.find((o: Order) => isActive(o.status))

  return (
    <div className="min-h-screen bg-[#FBFAF7] pb-24">
      {header}
      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <section className="flex items-center gap-3.5 rounded-2xl border border-[#E8D7B0]/70 bg-white p-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#5D082A] text-lg font-bold text-white">{initials(profile?.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-[#231F20]">Olá, {firstName(profile?.name)}</p>
            <p className="truncate text-xs text-gray-500">{profile?.email || formatPhone(profile?.whatsapp)}</p>
            {fidelidade?.clubeFidelidade && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#F8F0DC] px-2 py-0.5 text-[11px] font-bold text-[#5D082A]">
                <Star size={12} className="fill-[#D2BB8A] text-[#D2BB8A]" /> Cliente Clube Antenor{fidelidade.categoria?.descricao ? ` · ${fidelidade.categoria.descricao}` : ''}
              </p>
            )}
          </div>
        </section>

        {activeOrder && <ActiveOrderCard order={activeOrder} />}

        <nav role="tablist" aria-label="Seções da conta" className="grid grid-cols-3 gap-1 rounded-2xl border border-[#E8D7B0]/70 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn('flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors', tab === t.key ? 'bg-[#5D082A] text-white' : 'text-[#5d4f33] hover:bg-[#FBF7F0]')}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>

        {tab === 'pedidos' && <OrdersTab orders={orders} loading={ordersLoading} />}
        {tab === 'enderecos' && <AddressesTab customerId={user.id} addresses={profile?.addresses || []} onChanged={() => refetchCustomer()} />}
        {tab === 'dados' && profile && <ProfileTab profile={profile} onChanged={() => refetchCustomer()} onLogout={logout} />}
      </main>
      <MobileBottomNav />
    </div>
  )
}

function OrderProgress({ order }: { order: Order }) {
  const pickup = order.fulfillmentType === 'PICKUP'
  const steps = ['Recebido', 'Separando', pickup ? 'Pronto para retirar' : 'A caminho', pickup ? 'Retirado' : 'Entregue']
  const current = orderStep(order.status)
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Andamento do pedido">
      {steps.map((label, i) => (
        <li key={label} className="flex flex-col items-center gap-1.5 text-center">
          <span className={cn('h-1.5 w-full rounded-full', i <= current ? 'bg-[#5D082A]' : 'bg-[#E8D7B0]/70')} />
          <span className={cn('text-[11px] leading-tight', i === current ? 'font-bold text-[#5D082A]' : i < current ? 'text-[#5d4f33]' : 'text-gray-400')}>{label}</span>
        </li>
      ))}
    </ol>
  )
}

function useStoreWhatsapp(order: Order) {
  const { contactWhatsapp } = useBrand()
  const digits = (contactWhatsapp || import.meta.env.VITE_CONTACT_WHATSAPP || '').replace(/\D/g, '')
  const code = order.erpDav || order.id.slice(-8).toUpperCase()
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(`Olá! Sobre o meu pedido ${code}.`)}` : null
}

/** Pedido em andamento no topo: o que o cliente abre a conta para ver. */
function ActiveOrderCard({ order }: { order: Order }) {
  const whatsapp = useStoreWhatsapp(order)
  return (
    <section className="rounded-2xl border border-[#5D082A]/20 bg-[#FFF7FA] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5D082A]">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5D082A] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#5D082A]" /></span>
            Pedido em andamento
          </p>
          <p className="mt-1 text-lg font-bold text-[#231F20]">{ORDER_STATUS_LABEL[order.status] || 'Em andamento'}</p>
          <p className="text-xs text-gray-500">
            {order.erpDav ? `Pedido ${order.erpDav} · ` : ''}{formatWhen(order.createdAt)} · {formatPrice(order.total)}
          </p>
        </div>
        {order.fulfillmentType === 'PICKUP' ? <Store size={22} className="text-[#5D082A]" /> : <Truck size={22} className="text-[#5D082A]" />}
      </div>
      <OrderProgress order={order} />
      <SubstitutionChoice order={order} />
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-[#25D366]/40 bg-white px-3.5 text-xs font-semibold text-[#0d5c36]">
          <MessageCircle size={14} /> Falar com a loja sobre este pedido
        </a>
      )}
    </section>
  )
}

function OrdersTab({ orders, loading }: { orders: Order[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
        <Loader2 size={18} className="animate-spin text-[#5D082A]" /> Buscando seus pedidos…
      </div>
    )
  }
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E8D7B0]/70 bg-white p-8 text-center">
        <Package size={32} className="mx-auto mb-3 text-[#5D082A]/60" />
        <p className="font-bold text-[#231F20]">Você ainda não fez pedidos por aqui</p>
        <p className="mt-1 text-sm text-gray-500">Quando fizer, ele aparece aqui para acompanhar e repetir.</p>
        <Link to="/" className={buttonVariants({ size: 'md', className: 'mt-5 rounded-full px-6' })}>Começar a comprar</Link>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {orders.map((order) => <OrderCard key={order.id} order={order} />)}
    </div>
  )
}

function OrderCard({ order }: { order: Order }) {
  const navigate = useNavigate()
  const { addItem } = useCart()
  const whatsapp = useStoreWhatsapp(order)
  const [open, setOpen] = useState(false)
  const [repeating, setRepeating] = useState(false)
  const [nfeLoading, setNfeLoading] = useState(false)
  const items = order.items || []
  const pickup = order.fulfillmentType === 'PICKUP'
  const problem = PROBLEM_STATUSES.includes(order.status)
  const active = isActive(order.status)
  const deliveredAt = order.deliveryStops?.find((s) => s.status === 'DELIVERED' && s.deliveredAt)?.deliveredAt
  const changeFor = String(order.paymentMethod || '').toUpperCase() === 'CASH' ? parseChangeForFromNotes(order.notes) : null
  const adjusted = order.approvedTotal != null && Math.abs(Number(order.approvedTotal) - Number(order.total)) >= 0.01

  // Comprar de novo com o produto de HOJE: preco atual, e no pesavel a
  // quantidade em porcoes (o pedido grava kg; o carrinho conta porcoes).
  const repeat = async () => {
    setRepeating(true)
    let added = 0
    let missing = 0
    const results = await Promise.all(items.map(async (item) => {
      try {
        const key = item.product?.erpProductId ?? item.productId
        return { item, product: (await productsAPI.getOne(String(key))).data as Product }
      } catch {
        return { item, product: null }
      }
    }))
    for (const { item, product } of results) {
      if (!product || getProductCardViewModel(product).outOfStock) {
        missing++
        continue
      }
      const qty = product.isFractional ? Math.max(1, Math.round(item.quantity / getProductStep(product))) : Math.max(1, Math.round(item.quantity))
      addItem(product, qty)
      added++
    }
    setRepeating(false)
    if (added === 0) {
      toast.error('Nenhum item deste pedido está disponível agora.')
      return
    }
    toast.success(missing ? `${added} ${added === 1 ? 'item foi' : 'itens foram'} para o carrinho; ${missing} não ${missing === 1 ? 'está disponível' : 'estão disponíveis'} agora.` : 'Itens no carrinho, com o preço de hoje.')
    navigate('/cart')
  }

  // JON-182: a nota so existe depois que o pedido fatura no PDV -- consulta no clique.
  const downloadNfe = async () => {
    setNfeLoading(true)
    try {
      const { data } = await ordersAPI.getNfe(order.id)
      if (!data.disponivel || !data.xml) {
        toast.error('A nota fiscal ainda não está disponível para este pedido.')
        return
      }
      const url = URL.createObjectURL(new Blob([data.xml], { type: 'application/xml' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `nfe-${order.erpDav || order.id.slice(-8)}.xml`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Não foi possível consultar a nota fiscal agora.')
    } finally {
      setNfeLoading(false)
    }
  }

  return (
    <article className="rounded-2xl border border-[#E8D7B0]/70 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#231F20]">{formatWhen(order.createdAt)}</p>
            <p className="text-xs text-gray-500">
              {order.erpDav ? `Pedido ${order.erpDav}` : `Pedido ${order.id.slice(-6).toUpperCase()}`} · {pickup ? 'Retirada na loja' : 'Entrega'}
            </p>
          </div>
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold', problem ? 'bg-red-50 text-red-700' : active ? 'bg-[#F3E3EC] text-[#5D082A]' : 'bg-emerald-50 text-emerald-700')}>
            {ORDER_STATUS_LABEL[order.status] || 'Em andamento'}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex -space-x-2">
            {items.slice(0, 4).map((item) => (
              <span key={item.id} className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-[#FBF7F0]">
                {item.product?.ean ? <img src={thumb(item.product.ean)} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" /> : <Package size={16} className="text-gray-400" />}
              </span>
            ))}
            {items.length > 4 && <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-white bg-[#F8F2E6] text-xs font-bold text-[#5d4f33]">+{items.length - 4}</span>}
          </div>
          <div className="text-right">
            <p className="text-base font-black text-[#231F20]">{formatPrice(order.total)}</p>
            <p className="flex items-center justify-end gap-0.5 text-[11px] text-gray-500">
              {items.length} {items.length === 1 ? 'item' : 'itens'} <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
            </p>
          </div>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#EFE6D2] px-4 pb-4 pt-3">
          {active && <OrderProgress order={order} />}

          <ul className="divide-y divide-[#F1E8D6]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#EFE6D2] bg-white">
                  {item.product?.ean ? <img src={thumb(item.product.ean)} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" /> : <Package size={14} className="text-gray-400" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm text-[#231F20]">{formatProductTitle(item.product?.name || 'Produto')}</span>
                  <span className="text-xs text-gray-500">
                    {itemQuantity(item)}
                    {/* O que a separacao fez com o item (08/10/2026): faltou ou foi trocado. */}
                    {item.status === 'MISSING' && <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">Em falta</span>}
                    {item.status === 'SUBSTITUTED' && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">Trocado</span>}
                  </span>
                </span>
                <span className={cn('shrink-0 text-sm font-semibold tabular-nums', ['MISSING', 'SUBSTITUTED'].includes(item.status || '') ? 'text-gray-400 line-through' : 'text-[#231F20]')}>{formatPrice(Number(item.subtotal ?? (item.unitPrice || 0) * item.quantity))}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-1.5 rounded-xl bg-[#FBF7F0] p-3 text-sm">
            <div className="flex justify-between text-gray-600"><dt>Produtos</dt><dd>{formatPrice(Number(order.subtotal))}</dd></div>
            {Number(order.discount) > 0 && <div className="flex justify-between text-emerald-700"><dt>Desconto</dt><dd>-{formatPrice(Number(order.discount))}</dd></div>}
            <div className="flex justify-between text-gray-600"><dt>{pickup ? 'Retirada' : 'Entrega'}</dt><dd>{Number(order.delivery) > 0 ? formatPrice(Number(order.delivery)) : 'Grátis'}</dd></div>
            <div className="flex justify-between border-t border-[#E8D7B0]/60 pt-1.5 font-bold text-[#231F20]"><dt>Total</dt><dd>{formatPrice(Number(order.total))}</dd></div>
            {adjusted && (
              <p className="text-xs text-gray-500">
                Você aprovou {formatPrice(Number(order.approvedTotal))}; o valor final segue o peso conferido e as trocas na separação.
              </p>
            )}
          </dl>

          <div className="space-y-1 text-xs text-[#5d4f33]">
            <p className="flex items-center gap-1.5">
              {String(order.paymentMethod).toUpperCase() === 'PIX' ? <QrCode size={14} /> : String(order.paymentMethod).toUpperCase() === 'CARD' ? <CreditCard size={14} /> : <Banknote size={14} />}
              {PAYMENT_METHOD_LABEL[String(order.paymentMethod || 'CASH').toUpperCase()] || 'Pagamento na entrega'}
              {changeFor ? ` · troco para ${formatPrice(changeFor)}` : ''}
            </p>
            {!pickup && order.addressSnapshot && (
              <p className="flex items-start gap-1.5">
                <MapPin size={14} className="mt-px shrink-0" />
                {order.addressSnapshot.street}, {order.addressSnapshot.number}{order.addressSnapshot.complement ? ` - ${order.addressSnapshot.complement}` : ''} · {order.addressSnapshot.neighborhood}, {order.addressSnapshot.city}
              </p>
            )}
            {deliveredAt && <p className="flex items-center gap-1.5 font-semibold text-emerald-700"><Check size={14} /> Entregue em {new Date(deliveredAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={repeat} disabled={repeating} className={buttonVariants({ size: 'sm', className: 'h-10 rounded-full px-4' })}>
              {repeating ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} Comprar de novo
            </button>
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-4 text-xs font-semibold text-[#0d5c36]">
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            {order.erpDav && !active && !problem && (
              <button type="button" onClick={downloadNfe} disabled={nfeLoading} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#E8D7B0] px-4 text-xs font-semibold text-[#5d4f33]">
                {nfeLoading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Nota fiscal
              </button>
            )}
          </div>
        </div>
      )}
      {!open && (
        <div className="flex gap-2 px-4 pb-4">
          <button type="button" onClick={repeat} disabled={repeating} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#5D082A]/30 px-3.5 text-xs font-bold text-[#5D082A] hover:bg-[#FBF7F0]">
            {repeating ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Comprar de novo
          </button>
          <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-[#5d4f33] hover:bg-[#FBF7F0]">
            Detalhes <ChevronRight size={14} />
          </button>
        </div>
      )}
    </article>
  )
}

const EMPTY_ADDRESS: CreateAddressPayload = { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '', isDefault: false, locality: null, deliveryPointCode: null }

function AddressesTab({ customerId, addresses, onChanged }: { customerId: string; addresses: Address[]; onChanged: () => void }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Address | 'new' | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
    onChanged()
  }

  const setDefault = async (address: Address) => {
    setBusyId(address.id)
    try {
      await addressesAPI.setDefault(customerId, address.id)
      toast.success('Endereço principal atualizado.')
      refresh()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível mudar o endereço principal.'))
    } finally {
      setBusyId(null)
    }
  }
  const remove = async (address: Address) => {
    setBusyId(address.id)
    try {
      await addressesAPI.delete(customerId, address.id)
      toast.success('Endereço excluído.')
      setConfirmDelete(null)
      refresh()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Não foi possível excluir o endereço.'))
    } finally {
      setBusyId(null)
    }
  }

  const sorted = [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))

  return (
    <div className="space-y-3">
      {sorted.map((address) => (
        <article key={address.id} className="rounded-2xl border border-[#E8D7B0]/70 bg-white p-4">
          <div className="flex items-start gap-3">
            <MapPin size={20} className="mt-0.5 shrink-0 text-[#5D082A]" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#231F20]">
                {address.street}, {address.number}
                {address.isDefault && <span className="rounded-full bg-[#F3E3EC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5D082A]">Principal</span>}
              </p>
              <p className="text-xs text-gray-500">
                {address.complement ? `${address.complement} · ` : ''}{address.neighborhood}, {address.city} - {address.state} · {address.zipCode}
              </p>
              {address.locality && <p className="mt-0.5 text-xs text-[#5d4f33]">Localidade do frete: {address.locality}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 pl-8">
            {!address.isDefault && (
              <button type="button" onClick={() => setDefault(address)} disabled={busyId === address.id} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#E8D7B0] px-3 text-xs font-semibold text-[#5d4f33]">
                {busyId === address.id ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />} Tornar principal
              </button>
            )}
            <button type="button" onClick={() => setEditing(address)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#E8D7B0] px-3 text-xs font-semibold text-[#5d4f33]">
              <Pencil size={13} /> Editar
            </button>
            {confirmDelete === address.id ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Excluir?</span>
                <button type="button" onClick={() => setConfirmDelete(null)} className="font-semibold text-gray-500">Não</button>
                <button type="button" onClick={() => remove(address)} disabled={busyId === address.id} className="font-bold text-red-600">Sim, excluir</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(address.id)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-red-600 hover:bg-red-50">
                <Trash2 size={13} /> Excluir
              </button>
            )}
          </div>
        </article>
      ))}

      {addresses.length === 0 && (
        <div className="rounded-2xl border border-[#E8D7B0]/70 bg-white p-6 text-center text-sm text-gray-500">
          Você ainda não tem endereços salvos. Salve um para fechar o pedido mais rápido e ver o frete certo.
        </div>
      )}

      <button type="button" onClick={() => setEditing('new')} className={buttonVariants({ size: 'lg', className: 'w-full rounded-xl' })}>
        <Plus size={18} /> Novo endereço
      </button>

      {editing && (
        <AddressSheet
          customerId={customerId}
          address={editing === 'new' ? null : editing}
          firstAddress={addresses.length === 0}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}

/** Endereco numa folha: o CEP preenche a rua e mostra o frete (e a localidade, quando o CEP cobre mais de uma). */
function AddressSheet({ customerId, address, firstAddress, onClose, onSaved }: { customerId: string; address: Address | null; firstAddress: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CreateAddressPayload>(() =>
    address
      ? { street: address.street, number: address.number, complement: address.complement || '', neighborhood: address.neighborhood, city: address.city, state: address.state, zipCode: address.zipCode, isDefault: address.isDefault, locality: address.locality || null, deliveryPointCode: address.deliveryPointCode || null }
      : { ...EMPTY_ADDRESS, isDefault: firstAddress },
  )
  const [cepLoading, setCepLoading] = useState(false)
  const [localities, setLocalities] = useState<DeliveryLocalityOption[]>([])
  const [feeInfo, setFeeInfo] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<CreateAddressPayload>) => setForm((f) => ({ ...f, ...patch }))
  const cepDigits = String(form.zipCode).replace(/\D/g, '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  // CEP completo: preenche a rua e consulta o frete/localidades.
  useEffect(() => {
    if (cepDigits.length !== 8) {
      setLocalities([])
      setFeeInfo('')
      return
    }
    let alive = true
    setCepLoading(true)
    Promise.allSettled([fetchAddressByCep(cepDigits, form), deliveryAPI.calculate(cepDigits)])
      .then(([addr, calc]) => {
        if (!alive) return
        if (addr.status === 'fulfilled') {
          setForm((f) => ({
            ...f,
            street: f.street || addr.value.street,
            neighborhood: f.neighborhood || addr.value.neighborhood,
            city: f.city || addr.value.city,
            state: f.state || addr.value.state,
          }))
        }
        if (calc.status === 'fulfilled') {
          const data = calc.value.data
          const options = data.availableLocalities || []
          setLocalities(data.requiresLocalitySelection || options.length > 1 ? options : [])
          if (data.outOfArea) setFeeInfo('Ainda não entregamos neste CEP. Você pode retirar na loja.')
          else if (!data.requiresLocalitySelection && data.fee != null) setFeeInfo(data.fee > 0 ? `Frete para este endereço: ${formatPrice(data.fee)}` : 'Frete grátis para este endereço')
          else setFeeInfo('')
        }
      })
      .finally(() => alive && setCepLoading(false))
    return () => {
      alive = false
    }
    // So quando o CEP muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepDigits])

  const selectedLocality = localities.find((l) => l.code === form.deliveryPointCode)

  const save = async () => {
    if (!form.street.trim() || !form.number.trim() || !form.neighborhood.trim() || !form.city.trim() || !form.state.trim() || cepDigits.length !== 8) {
      setError('Preencha CEP, rua, número, bairro, cidade e estado.')
      return
    }
    if (localities.length > 0 && !form.deliveryPointCode) {
      setError('Escolha a localidade para calcularmos o frete certo.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, zipCode: formatZip(form.zipCode) }
      if (address) await addressesAPI.update(customerId, address.id, payload)
      else await addressesAPI.create(customerId, payload)
      toast.success(address ? 'Endereço atualizado.' : 'Endereço salvo.')
      onSaved()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível salvar o endereço.'))
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof CreateAddressPayload, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#5d4f33]">{label}</span>
      <input
        value={String(form[key] ?? '')}
        onChange={(e) => set({ [key]: key === 'zipCode' ? formatZip(e.target.value) : key === 'state' ? e.target.value.slice(0, 2).toUpperCase() : e.target.value } as Partial<CreateAddressPayload>)}
        className="h-12 w-full rounded-xl border border-[#E8D7B0] bg-white px-3.5 text-[15px] text-[#231F20] outline-none focus:border-[#D2BB8A] focus:ring-2 focus:ring-[#D2BB8A]/40"
        {...props}
      />
    </label>
  )

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={address ? 'Editar endereço' : 'Novo endereço'}>
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#EFE6D2] px-5 py-4">
          <h2 className="text-base font-bold text-[#231F20]">{address ? 'Editar endereço' : 'Novo endereço'}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F8F4EA]"><X size={20} /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="relative">
            {field('CEP', 'zipCode', { inputMode: 'numeric', placeholder: '00000-000', maxLength: 9, autoFocus: !address })}
            {cepLoading && <Loader2 size={16} className="absolute right-3 top-[38px] animate-spin text-[#5D082A]" />}
          </div>
          {feeInfo && <p className="flex items-center gap-1.5 text-xs font-semibold text-[#5D082A]"><Truck size={14} /> {feeInfo}</p>}
          {localities.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#5d4f33]">Localidade (este CEP tem mais de uma)</span>
              <select
                value={form.deliveryPointCode || ''}
                onChange={(e) => {
                  const opt = localities.find((l) => l.code === e.target.value)
                  set({ deliveryPointCode: opt?.code || null, locality: opt?.name || null })
                }}
                className="h-12 w-full rounded-xl border border-[#E8D7B0] bg-white px-3 text-[15px] text-[#231F20]"
              >
                <option value="">Escolha a localidade</option>
                {localities.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}{l.fee > 0 ? ` · frete ${formatPrice(l.fee)}` : ' · frete grátis'}</option>
                ))}
              </select>
              {selectedLocality?.reference && <span className="mt-1 block text-[11px] text-gray-500">{selectedLocality.reference}</span>}
            </label>
          )}
          {field('Rua', 'street', { autoComplete: 'address-line1' })}
          <div className="grid grid-cols-2 gap-2">
            {field('Número', 'number', { inputMode: 'numeric' })}
            {field('Complemento', 'complement', { placeholder: 'Opcional' })}
          </div>
          {field('Bairro', 'neighborhood')}
          <div className="grid grid-cols-[1fr_88px] gap-2">
            {field('Cidade', 'city')}
            {field('UF', 'state', { maxLength: 2 })}
          </div>
          <label className="flex items-center gap-2.5 py-1 text-sm text-[#231F20]">
            <input type="checkbox" checked={Boolean(form.isDefault)} onChange={(e) => set({ isDefault: e.target.checked })} className="h-5 w-5 accent-[#5D082A]" />
            Usar como endereço principal
          </label>
        </div>
        <div className="flex gap-2 border-t border-[#EFE6D2] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={onClose} className={buttonVariants({ variant: 'outline', className: 'h-12 rounded-xl px-5' })}>Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className={buttonVariants({ className: 'h-12 flex-1 rounded-xl' })}>
            {saving && <Loader2 size={16} className="animate-spin" />} {address ? 'Salvar alterações' : 'Salvar endereço'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileTab({ profile, onChanged, onLogout }: { profile: Customer; onChanged: () => void; onLogout: () => void }) {
  const { applySession } = useAuth()
  const { contactWhatsapp } = useBrand()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: profile.name || '', email: profile.email || '', whatsapp: formatPhone(profile.whatsapp) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!editing) setForm({ name: profile.name || '', email: profile.email || '', whatsapp: formatPhone(profile.whatsapp) })
  }, [profile, editing])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const { data } = await authAPI.updateProfile({ name: form.name, email: form.email, whatsapp: form.whatsapp })
      if (data?.access_token && data?.user) applySession(data.access_token, data.user)
      toast.success('Dados atualizados.')
      setEditing(false)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível salvar seus dados.'))
    } finally {
      setSaving(false)
    }
  }

  const storeWhatsapp = (contactWhatsapp || import.meta.env.VITE_CONTACT_WHATSAPP || '').replace(/\D/g, '')
  const input = 'h-12 w-full rounded-xl border border-[#E8D7B0] bg-white px-3.5 text-[15px] text-[#231F20] outline-none focus:border-[#D2BB8A] focus:ring-2 focus:ring-[#D2BB8A]/40'

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#E8D7B0]/70 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#231F20]">Dados pessoais</h2>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[#5D082A] hover:bg-[#FBF7F0]">
              <Pencil size={13} /> Editar
            </button>
          )}
        </div>
        {editing ? (
          <div className="space-y-3">
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[#5d4f33]">Nome completo</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} autoComplete="name" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[#5d4f33]">E-mail</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} autoComplete="email" placeholder="Opcional" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[#5d4f33]">WhatsApp</span><input inputMode="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={input} autoComplete="tel" /></label>
            <p className="text-xs text-gray-500">O CPF não muda por aqui: ele identifica sua nota fiscal. Precisa corrigir? Fale com a loja.</p>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditing(false)} className={buttonVariants({ variant: 'outline', className: 'h-11 rounded-xl px-5' })}>Cancelar</button>
              <button type="button" onClick={save} disabled={saving} className={buttonVariants({ className: 'h-11 flex-1 rounded-xl' })}>{saving && <Loader2 size={16} className="animate-spin" />} Salvar</button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-gray-500">Nome</dt><dd className="text-[#231F20]">{profile.name}</dd>
            <dt className="text-gray-500">E-mail</dt><dd className="break-all text-[#231F20]">{profile.email || <span className="text-gray-400">Não informado</span>}</dd>
            <dt className="text-gray-500">WhatsApp</dt><dd className="text-[#231F20]">{formatPhone(profile.whatsapp)}</dd>
            <dt className="text-gray-500">CPF</dt><dd className="font-mono text-[#231F20]">{maskCpf(profile.cpf)}</dd>
          </dl>
        )}
      </section>

      <PasswordCard hasPassword={profile.hasPassword !== false} onChanged={onChanged} />

      <PushAlertsCard
        title="Avisos no celular"
        enabledTitle="Avisos no celular ativados"
        idleText="Receba o andamento do pedido e as ofertas no celular."
        enabledText="Você recebe o andamento do pedido e as ofertas no celular."
      />

      <nav className="divide-y divide-[#EFE6D2] overflow-hidden rounded-2xl border border-[#E8D7B0]/70 bg-white text-sm">
        {storeWhatsapp && (
          <a href={`https://wa.me/${storeWhatsapp}`} target="_blank" rel="noreferrer" className="flex min-h-[52px] items-center justify-between px-4 text-[#231F20] hover:bg-[#FBF7F0]">
            <span className="flex items-center gap-2.5"><MessageCircle size={17} className="text-[#0d5c36]" /> Falar com a loja</span><ChevronRight size={16} className="text-gray-400" />
          </a>
        )}
        <Link to="/privacidade" className="flex min-h-[52px] items-center justify-between px-4 text-[#231F20] hover:bg-[#FBF7F0]">
          <span>Privacidade e seus dados</span><ChevronRight size={16} className="text-gray-400" />
        </Link>
        <Link to="/termos" className="flex min-h-[52px] items-center justify-between px-4 text-[#231F20] hover:bg-[#FBF7F0]">
          <span>Termos de uso</span><ChevronRight size={16} className="text-gray-400" />
        </Link>
      </nav>

      <button type="button" onClick={onLogout} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-red-600 hover:bg-red-50">
        <LogOut size={17} /> Sair da conta
      </button>
    </div>
  )
}

/** Conta do checkout convidado nasce sem senha: aqui o cliente cria (ou troca) a dele. */
function PasswordCard({ hasPassword, onChanged }: { hasPassword: boolean; onChanged: () => void }) {
  const { applySession } = useAuth()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = 'h-12 w-full rounded-xl border border-[#E8D7B0] bg-white px-3.5 text-[15px] text-[#231F20] outline-none focus:border-[#D2BB8A] focus:ring-2 focus:ring-[#D2BB8A]/40'
  const mismatch = confirm.length > 0 && confirm !== next

  const save = async () => {
    if (next.length < 6) return setError('A senha precisa de pelo menos 6 caracteres.')
    if (next !== confirm) return setError('As duas senhas não são iguais.')
    setSaving(true)
    setError(null)
    try {
      const { data } = await authAPI.setPassword(next, hasPassword ? current : undefined)
      if (data?.access_token && data?.user) applySession(data.access_token, data.user)
      toast.success(hasPassword ? 'Senha trocada.' : 'Senha criada. Agora você entra com ela.')
      setOpen(false)
      setCurrent('')
      setNext('')
      setConfirm('')
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível salvar a senha.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-[#E8D7B0]/70 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#231F20]">Senha</h2>
          <p className="text-xs text-gray-500">{hasPassword ? 'Troque quando quiser.' : 'Sua conta foi criada no pedido, sem senha. Crie uma para entrar de novo.'}</p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className={buttonVariants({ variant: hasPassword ? 'outline' : 'primary', size: 'sm', className: 'shrink-0 rounded-full px-4' })}>
            {hasPassword ? 'Trocar' : 'Criar senha'}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          {hasPassword && (
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[#5d4f33]">Senha atual</span><input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} autoComplete="current-password" /></label>
          )}
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[#5d4f33]">Nova senha</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={input} autoComplete="new-password" placeholder="Mínimo de 6 caracteres" /></label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#5d4f33]">Repita a nova senha</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={cn(input, mismatch && 'border-red-300')} autoComplete="new-password" />
            {mismatch && <span className="mt-1 block text-xs text-red-600">As senhas não são iguais.</span>}
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className={buttonVariants({ variant: 'outline', className: 'h-11 rounded-xl px-5' })}>Cancelar</button>
            <button type="button" onClick={save} disabled={saving} className={buttonVariants({ className: 'h-11 flex-1 rounded-xl' })}>{saving && <Loader2 size={16} className="animate-spin" />} Salvar senha</button>
          </div>
        </div>
      )}
    </section>
  )
}
