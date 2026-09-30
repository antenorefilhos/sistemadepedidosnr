import { createContext, useState, useCallback, useEffect, ReactNode, useContext } from 'react'
import type { Product } from '../types'
import { getProductLineTotal, hasConfiguredFractionStep } from '../utils/productPricing'
import { couponsAPI } from '../services/api'
import { CouponNoticeDialog, type CouponNotice } from '../components/CouponNoticeDialog'

export interface CartItem {
  productId: string
  quantity: number
  product: Product
  allowSubstitution?: boolean
}

export interface CartContextData {
  cart: CartItem[]
  couponCode: string | null
  discount: number
  subtotal: number
  addItem: (product: Product, quantity: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateAllowSubstitution: (productId: string, allowSubstitution: boolean) => void
  clear: () => void
  applyCoupon: (code: string) => Promise<{ valid: boolean; message: string }>
  removeCoupon: () => void
  /** Aviso de cupom no meio da tela (aplicado, recusado ou retirado). */
  showCouponNotice: (notice: CouponNotice) => void
  total: number
  count: number
}

export const CartContext = createContext<CartContextData>({} as CartContextData)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const stored = localStorage.getItem('cart')
    return stored ? (JSON.parse(stored) as CartItem[]) : []
  })
  const [couponCode, setCouponCode] = useState<string | null>(() => {
    const stored = localStorage.getItem('cartCouponCode')
    return stored ? String(stored) : null
  })
  const [discount, setDiscount] = useState<number>(0)
  const [couponNotice, setCouponNotice] = useState<CouponNotice | null>(null)
  const closeCouponNotice = useCallback(() => setCouponNotice(null), [])

  // Sincroniza localStorage sempre que cart mudar
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    if (!couponCode) {
      localStorage.removeItem('cartCouponCode')
      setDiscount(0)
      return
    }

    localStorage.setItem('cartCouponCode', couponCode)
  }, [couponCode])

  const addItem = useCallback((product: Product, quantity: number) => {
    setCart((prev) => {
      if (!hasConfiguredFractionStep(product)) return prev

      const existing = prev.find((item) => item.productId === product.id)

      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        )
      }
      return [...prev, { productId: product.id, quantity, product, allowSubstitution: true }]
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity } : item,
      ),
    )
  }, [])

  const updateAllowSubstitution = useCallback((productId: string, allowSubstitution: boolean) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, allowSubstitution } : item,
      ),
    )
  }, [])

  const clear = useCallback(() => {
    setCart([])
    setCouponCode(null)
    setDiscount(0)
    localStorage.removeItem('cart')
    localStorage.removeItem('cartCouponCode')
  }, [])

  const subtotal = cart.reduce((sum, item) => {
    return sum + getProductLineTotal(item.product, item.quantity)
  }, 0)

  const applyCoupon = useCallback(async (code: string) => {
    const normalizedCode = String(code || '').trim().toUpperCase()
    if (!normalizedCode) {
      return { valid: false, message: 'Informe um cupom para aplicar.' }
    }

    const response = await couponsAPI.validate(normalizedCode, subtotal)
    const result = response.data

    if (!result.valid) {
      setDiscount(0)
      setCouponCode(null)
      setCouponNotice({ tone: 'error', title: `O cupom ${normalizedCode} não foi aplicado`, message: result.message })
      return { valid: false, message: result.message }
    }

    setCouponCode(result.code)
    setDiscount(result.discountAmount)
    setCouponNotice({
      tone: 'success',
      title: `Cupom ${result.code} aplicado`,
      message: result.discountAmount > 0 ? `Desconto de ${result.discountAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no seu pedido.` : result.message,
    })
    return { valid: true, message: result.message }
  }, [subtotal])

  const removeCoupon = useCallback(() => {
    setCouponCode(null)
    setDiscount(0)
    localStorage.removeItem('cartCouponCode')
  }, [])

  useEffect(() => {
    if (!couponCode) return
    if (subtotal <= 0) {
      setDiscount(0)
      return
    }

    let cancelled = false

    couponsAPI
      .validate(couponCode, subtotal)
      .then((response) => {
        if (cancelled) return
        const result = response.data
        if (!result.valid) {
          // Tirava o cupom calado: o cliente seguia achando que tinha o
          // desconto (DAV 102120, cupom vencido no meio da compra).
          setCouponNotice({ tone: 'error', title: `O cupom ${couponCode} saiu do seu carrinho`, message: result.message })
          setCouponCode(null)
          setDiscount(0)
          localStorage.removeItem('cartCouponCode')
          return
        }
        setDiscount(result.discountAmount)
      })
      .catch(() => {
        if (cancelled) return
        setDiscount(0)
      })

    return () => {
      cancelled = true
    }
  }, [couponCode, subtotal])

  const total = Math.max(0, subtotal - discount)

  // Item pesavel conta como 1: quantity dele e numero de porcoes (6 porcoes de
  // pao = 1 item, nao "6 itens").
  const count = cart.reduce((sum, item) => sum + (item.product?.isFractional ? 1 : item.quantity), 0)

  return (
    <CartContext.Provider
      value={{
        cart,
        couponCode,
        discount,
        subtotal,
        addItem,
        removeItem,
        updateQuantity,
        updateAllowSubstitution,
        clear,
        applyCoupon,
        removeCoupon,
        showCouponNotice: setCouponNotice,
        total,
        count,
      }}
    >
      {children}
      {couponNotice && <CouponNoticeDialog notice={couponNotice} onClose={closeCouponNotice} />}
    </CartContext.Provider>
  )
}

export function useCartContext() {
  return useContext(CartContext)
}
