import axios from 'axios';
import { getDeviceId } from './device';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
  }
}

type PurchaseItem = { productId: string; unitPrice: number; quantity: number; subtotal?: number | null; product?: { name?: string } }
type PurchaseOrder = { id: string; total: number; delivery: number; items: PurchaseItem[] }

const roundMoney = (n: number) => Math.round(n * 100) / 100

/**
 * Parametros do Purchase do Meta Pixel. O servidor manda o MESMO evento pela API de
 * Conversoes (backend/src/modules/meta-conversions) com event_id = id do pedido; a Meta
 * so deduplica se nome, event_id e conteudo conferirem -- mude os dois lados juntos.
 * Item pesavel (quantidade fracionada, ex.: 0,8 kg) entra como 1 unidade pelo valor da
 * linha, porque a Meta espera quantidade inteira. content_ids usa o id interno do
 * produto, o mesmo do ViewContent e do AddToCart.
 */
export const buildPurchaseParams = (order: PurchaseOrder) => {
  const contents = order.items.map((item) => {
    const qty = Number(item.quantity) || 0
    const line = item.subtotal != null ? Number(item.subtotal) : qty * Number(item.unitPrice)
    return Number.isInteger(qty) && qty > 0
      ? { id: item.productId, quantity: qty, item_price: roundMoney(Number(item.unitPrice)) }
      : { id: item.productId, quantity: 1, item_price: roundMoney(line) }
  })
  return {
    value: roundMoney(Number(order.total)),
    currency: 'BRL',
    content_type: 'product',
    content_ids: [...new Set(contents.map((c) => c.id))],
    contents,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
    order_id: order.id,
  }
}

const readCookie = (name: string): string | undefined => {
  try {
    const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
  } catch {
    return undefined
  }
}

/** Cookies do pixel e URL da pagina, enviados ao confirmar o pedido para o servidor casar
 * o Purchase (API de Conversoes) com o anuncio que trouxe o cliente. */
export const getMetaBrowserContext = (): { fbp?: string; fbc?: string; eventSourceUrl?: string } => {
  try {
    return { fbp: readCookie('_fbp'), fbc: readCookie('_fbc'), eventSourceUrl: window.location.href.slice(0, 1024) }
  } catch {
    return {}
  }
}

export type AnalyticsEventType =
  | 'VIEW_PRODUCT'
  | 'VIEW_CATEGORY'
  | 'ADD_TO_CART'
  | 'SEARCH'
  | 'INITIATE_CHECKOUT';

// Espelha os mesmos eventos do funil pro GA4/Meta Pixel, de graça -- os
// chamadores de trackEvent() (produto, carrinho, checkout) ja mandam nome,
// preco e quantidade no metadata, nao precisa instrumentar cada tela de novo.
// Nunca quebra a UI: se o script de terceiro falhar/for bloqueado, window.gtag
// e window.fbq simplesmente nao existem e a chamada e um no-op.
const pushToThirdPartyAnalytics = (type: AnalyticsEventType, entityId?: string, metadata?: Record<string, unknown>) => {
  const price = typeof metadata?.price === 'number' ? metadata.price : undefined
  const quantity = typeof metadata?.quantity === 'number' ? metadata.quantity : 1
  const name = typeof metadata?.name === 'string' ? metadata.name : undefined
  const item = entityId ? [{ item_id: entityId, item_name: name, price, quantity }] : undefined

  switch (type) {
    case 'VIEW_PRODUCT':
      window.gtag?.('event', 'view_item', { currency: 'BRL', value: price, items: item })
      window.fbq?.('track', 'ViewContent', { content_ids: entityId ? [entityId] : undefined, content_name: name, value: price, currency: 'BRL' })
      break
    case 'ADD_TO_CART':
      window.gtag?.('event', 'add_to_cart', { currency: 'BRL', value: price != null ? price * quantity : undefined, items: item })
      window.fbq?.('track', 'AddToCart', { content_ids: entityId ? [entityId] : undefined, content_name: name, value: price != null ? price * quantity : undefined, currency: 'BRL' })
      break
    case 'SEARCH':
      window.gtag?.('event', 'search', { search_term: typeof metadata?.query === 'string' ? metadata.query : undefined })
      break
    case 'INITIATE_CHECKOUT': {
      const total = typeof metadata?.total === 'number' ? metadata.total : undefined
      window.gtag?.('event', 'begin_checkout', { currency: 'BRL', value: total })
      window.fbq?.('track', 'InitiateCheckout', { value: total, currency: 'BRL' })
      break
    }
  }
}

/** Dispara no momento em que o pedido e criado com sucesso (Checkout.tsx). Nao
 * passa pelo /analytics/track proprio -- o pedido em si ja e gravado na tabela
 * orders, so falta avisar o GA4/Pixel pra fins de otimizacao de anuncio/funil. */
export const trackPurchase = (order: PurchaseOrder) => {
  try {
    window.gtag?.('event', 'purchase', {
      transaction_id: order.id,
      currency: 'BRL',
      value: order.total,
      shipping: order.delivery,
      items: order.items.map((item) => ({
        item_id: item.productId,
        item_name: item.product?.name,
        price: item.unitPrice,
        quantity: item.quantity,
      })),
    })
    // eventID = id do pedido: e o que o servidor manda como event_id (deduplicacao).
    window.fbq?.('track', 'Purchase', buildPurchaseParams(order), { eventID: order.id })
  } catch {
    // Analytics nunca deve quebrar a experiência do usuário
  }
}

// Sessao = visita: expira apos 30 min sem evento (mesmo criterio do GA).
// Sem isso nenhum evento carregava sessionId e nao dava pra medir conversao
// por visita (0 sessoes distintas em analytics_events ate 27/09/2026).
const SESSION_KEY = 'antenor.analyticsSession'
const SESSION_IDLE_MS = 30 * 60 * 1000

export const getSessionId = (): string | undefined => {
  try {
    const now = Date.now()
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as { id: string; lastSeen: number } | null
    const id = saved && now - saved.lastSeen < SESSION_IDLE_MS ? saved.id : `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastSeen: now }))
    return id
  } catch {
    return undefined
  }
}

export const trackEvent = async (type: AnalyticsEventType, entity?: string, entityId?: string, metadata?: any) => {
  pushToThirdPartyAnalytics(type, entityId, metadata)
  try {
    const userJson = localStorage.getItem('user');
    const customerId = userJson ? JSON.parse(userJson).id : null;
    const deviceId = getDeviceId();
    const sessionId = getSessionId();

    // Envio "fire and forget" para não travar a UI
    axios.post(`${API_URL}/analytics/track`, {
      type,
      entity,
      entityId,
      customerId,
      deviceId,
      sessionId,
      metadata
    }).catch(() => {
      // Analytics failures do not impact user experience
    });
  } catch (error) {
    // Analytics nunca deve quebrar a experiência do usuário
  }
};
