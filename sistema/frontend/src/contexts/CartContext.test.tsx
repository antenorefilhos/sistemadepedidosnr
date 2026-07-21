// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ReactNode } from 'react'
import { CartProvider, CartContext } from './CartContext'
import { useContext } from 'react'
import type { Product } from '../types'

// Mock localStorage
let localStore: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => localStore[key] ?? null,
  setItem: (key: string, value: string) => { localStore[key] = value },
  removeItem: (key: string) => { delete localStore[key] },
  clear: () => { localStore = {} },
}
vi.stubGlobal('localStorage', localStorageMock)

// Mock da API de cupons
vi.mock('../services/api', () => ({
  couponsAPI: {
    validate: vi.fn(),
  },
}))

import { couponsAPI } from '../services/api'

const mockCouponsAPI = couponsAPI as { validate: ReturnType<typeof vi.fn> }

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  ean: '7891234567890',
  name: 'Feijão Carioca 1kg',
  price: 10,
  active: true,
  isFractional: false,
  ...overrides,
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
)

function useCart() {
  return useContext(CartContext)
}

beforeEach(() => {
  localStore = {}
  vi.clearAllMocks()
})

describe('CartContext - addItem', () => {
  it('adiciona produto novo ao carrinho', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    const product = makeProduct()

    act(() => {
      result.current.addItem(product, 2)
    })

    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].quantity).toBe(2)
    expect(result.current.cart[0].productId).toBe('prod-1')
  })

  it('soma quantidade ao adicionar produto já no carrinho', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    const product = makeProduct()

    act(() => {
      result.current.addItem(product, 2)
      result.current.addItem(product, 3)
    })

    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].quantity).toBe(5)
  })

  it('adiciona múltiplos produtos distintos', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    const p1 = makeProduct({ id: 'prod-1' })
    const p2 = makeProduct({ id: 'prod-2', name: 'Arroz', price: 8 })

    act(() => {
      result.current.addItem(p1, 1)
      result.current.addItem(p2, 1)
    })

    expect(result.current.cart).toHaveLength(2)
  })
})

describe('CartContext - removeItem', () => {
  it('remove produto do carrinho', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    const product = makeProduct()

    act(() => {
      result.current.addItem(product, 2)
      result.current.removeItem('prod-1')
    })

    expect(result.current.cart).toHaveLength(0)
  })

  it('não remove produto com id errado', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    const product = makeProduct()

    act(() => {
      result.current.addItem(product, 1)
      result.current.removeItem('outro-id')
    })

    expect(result.current.cart).toHaveLength(1)
  })
})

describe('CartContext - updateQuantity', () => {
  it('atualiza quantidade de produto existente', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    const product = makeProduct()

    act(() => {
      result.current.addItem(product, 1)
      result.current.updateQuantity('prod-1', 5)
    })

    expect(result.current.cart[0].quantity).toBe(5)
  })
})

describe('CartContext - clear', () => {
  it('limpa o carrinho completamente', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addItem(makeProduct({ id: 'p1' }), 2)
      result.current.addItem(makeProduct({ id: 'p2' }), 1)
      result.current.clear()
    })

    expect(result.current.cart).toHaveLength(0)
    expect(result.current.couponCode).toBeNull()
    expect(result.current.discount).toBe(0)
  })

  it('limpa localStorage ao fazer clear (cart fica array vazio)', () => {
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(makeProduct(), 1))
    act(() => result.current.clear())

    // useEffect escreve [] de volta após clear — comportamento esperado do Context
    const stored = localStorage.getItem('cart')
    const parsed = stored ? JSON.parse(stored) : null
    expect(parsed).toEqual([])
  })
})

describe('CartContext - subtotal e total', () => {
  it('calcula subtotal corretamente', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addItem(makeProduct({ price: 10 }), 3)
    })

    expect(result.current.subtotal).toBeCloseTo(30)
  })

  it('total = subtotal - discount', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addItem(makeProduct({ price: 10 }), 2)
    })

    // sem desconto
    expect(result.current.total).toBeCloseTo(result.current.subtotal)
  })

  it('count reflete quantidade total de itens', () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => {
      result.current.addItem(makeProduct({ id: 'p1' }), 3)
      result.current.addItem(makeProduct({ id: 'p2' }), 2)
    })

    expect(result.current.count).toBe(5)
  })
})

describe('CartContext - applyCoupon', () => {
  it('aplica cupom válido e seta desconto', async () => {
    mockCouponsAPI.validate.mockResolvedValue({
      data: { valid: true, code: 'DESC10', discountAmount: 5, message: 'Cupom aplicado!' },
    })

    const { result } = renderHook(() => useCart(), { wrapper })

    act(() => result.current.addItem(makeProduct({ price: 20 }), 1))

    let response: { valid: boolean; message: string } | undefined
    await act(async () => {
      response = await result.current.applyCoupon('DESC10')
    })

    expect(response?.valid).toBe(true)
    expect(result.current.discount).toBe(5)
    expect(result.current.couponCode).toBe('DESC10')
  })

  it('rejeita cupom inválido', async () => {
    mockCouponsAPI.validate.mockResolvedValue({
      data: { valid: false, message: 'Cupom expirado.' },
    })

    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(makeProduct({ price: 20 }), 1))

    let response: { valid: boolean; message: string } | undefined
    await act(async () => {
      response = await result.current.applyCoupon('INVALIDO')
    })

    expect(response?.valid).toBe(false)
    expect(result.current.discount).toBe(0)
    expect(result.current.couponCode).toBeNull()
  })

  it('retorna mensagem de erro para cupom vazio', async () => {
    const { result } = renderHook(() => useCart(), { wrapper })

    let response: { valid: boolean; message: string } | undefined
    await act(async () => {
      response = await result.current.applyCoupon('')
    })

    expect(response?.valid).toBe(false)
    expect(response?.message).toBeTruthy()
  })
})

describe('CartContext - removeCoupon', () => {
  it('remove cupom aplicado', async () => {
    mockCouponsAPI.validate.mockResolvedValue({
      data: { valid: true, code: 'PROMO', discountAmount: 3, message: 'OK' },
    })

    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(makeProduct({ price: 20 }), 1))

    await act(async () => {
      await result.current.applyCoupon('PROMO')
    })

    act(() => result.current.removeCoupon())

    expect(result.current.couponCode).toBeNull()
    expect(result.current.discount).toBe(0)
  })
})
