import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useNotifications } from './useNotifications'

vi.mock('../services/api', () => ({
  notificationsAPI: {
    list: vi.fn().mockResolvedValue({ data: [] }),
    unreadCount: vi.fn().mockResolvedValue({ data: 0 }),
    markAsRead: vi.fn(),
    subscribeToPush: vi.fn(),
    unsubscribeFromPush: vi.fn(),
  },
}))

// Bug real (18/09/2026): pushStatus nascia sempre 'idle' a cada mount, sem
// checar se ja existia uma subscription push ativa no navegador -- o cliente
// clicava em "Ativar notificacoes", funcionava, e ao recarregar a pagina ou
// navegar pra outra a tela "esquecia" e voltava a oferecer o botao de novo,
// mesmo com a inscricao ativa (browser + backend).
describe('useNotifications — pushStatus reflete subscription existente', () => {
  const wrapper = ({ children }: { children: ReactNode }) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // limpa mocks globais entre testes
    delete (navigator as any).serviceWorker
    delete (window as any).Notification
    delete (window as any).PushManager
  })

  it('sobe pra "enabled" ao montar quando ja existe subscription ativa e permissao concedida', async () => {
    ;(window as any).Notification = { permission: 'granted', requestPermission: vi.fn() }
    ;(window as any).PushManager = function () {}
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: 'https://example.com/sub' }) },
        }),
      },
    })

    const { result } = renderHook(() => useNotifications(), { wrapper })

    expect(result.current.pushStatus).toBe('idle')
    await waitFor(() => expect(result.current.pushStatus).toBe('enabled'))
  })

  it('permanece "idle" quando nao ha subscription (usuario nunca ativou)', async () => {
    ;(window as any).Notification = { permission: 'granted', requestPermission: vi.fn() }
    ;(window as any).PushManager = function () {}
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
      },
    })

    const { result } = renderHook(() => useNotifications(), { wrapper })

    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.pushStatus).toBe('idle')
  })

  it('nao verifica subscription quando a permissao do navegador nao foi concedida', async () => {
    ;(window as any).Notification = { permission: 'default', requestPermission: vi.fn() }
    ;(window as any).PushManager = function () {}
    const getSubscription = vi.fn().mockResolvedValue({ endpoint: 'https://example.com/sub' })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription } }) },
    })

    renderHook(() => useNotifications(), { wrapper })

    await new Promise((r) => setTimeout(r, 0))
    expect(getSubscription).not.toHaveBeenCalled()
  })
})
