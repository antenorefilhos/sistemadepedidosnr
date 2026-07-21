import { createContext, useState, useCallback, useEffect, ReactNode, useContext } from 'react'
import type { Product } from '../types'
import { getProductLineTotal, hasConfiguredFractionStep } from '../utils/productPricing'
import { couponsAPI } from '../services/api'

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
      return { valid: false, message: result.message }
    }

    setCouponCode(result.code)
    setDiscount(result.discountAmount)
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

  const count = cart.reduce((sum, item) => sum + item.quantity, 0)

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
        total,
        count,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCartContext() {
  return useContext(CartContext)
}
