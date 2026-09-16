import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { useAutoScroll } from './useAutoScroll'

// JON-108: prefersReducedMotion faltava nas deps do useEffect -- ativar a
// preferencia com o carrossel montado nao cancelava o timer em andamento.
describe('useAutoScroll', () => {
  let matchesRef: { value: boolean }
  let listeners: Array<() => void>

  beforeEach(() => {
    vi.useFakeTimers()
    matchesRef = { value: false }
    listeners = []
    window.matchMedia = vi.fn().mockImplementation(() => ({
      get matches() {
        return matchesRef.value
      },
      addEventListener: (_: string, cb: () => void) => listeners.push(cb),
      removeEventListener: vi.fn(),
    })) as any
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('cancela o timer quando prefers-reduced-motion e ativado com o carrossel montado', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'scrollWidth', { value: 1000, configurable: true })
    Object.defineProperty(container, 'clientWidth', { value: 200, configurable: true })
    container.scrollBy = vi.fn()
    const ref = createRef<HTMLDivElement>()
    ;(ref as any).current = container

    renderHook(() => useAutoScroll(ref, true, { step: 100, intervalMs: 1000 }))

    vi.advanceTimersByTime(1000)
    expect(container.scrollBy).toHaveBeenCalledTimes(1)

    matchesRef.value = true
    act(() => {
      listeners.forEach((cb) => cb())
    })

    vi.advanceTimersByTime(3000)
    expect(container.scrollBy).toHaveBeenCalledTimes(1)
  })
})
