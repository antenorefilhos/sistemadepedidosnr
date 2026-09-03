import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mesmo stub do CartContext.test: o `environment: 'jsdom'` do vite.config nao
// esta chegando nestes arquivos, entao cada teste que toca storage traz o seu.
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
})
import { clearCheckoutDraft, readCheckoutDraft, saveCheckoutDraft } from './checkoutDraft'

describe('checkoutDraft', () => {
  beforeEach(() => localStorage.clear())

  it('devolve o que foi salvo', () => {
    saveCheckoutDraft({ guestName: 'Jonathan', zipCode: '25750-222', locality: 'Chafariz' })
    expect(readCheckoutDraft()).toMatchObject({ guestName: 'Jonathan', locality: 'Chafariz' })
  })

  // O formData do checkout tem lat/lng (number|null) e o rascunho e so texto;
  // deixar passar poria numero onde a tela espera string.
  it('ignora campo que nao esta na lista e valor que nao e string', () => {
    saveCheckoutDraft({ guestName: 'A', lat: -22.5, paymentMethod: 3 } as never)
    const draft = readCheckoutDraft()
    expect(draft).toEqual({ guestName: 'A' })
  })

  it('storage corrompido nao derruba a tela', () => {
    localStorage.setItem('antenor.checkoutDraft', '{isso nao e json')
    expect(readCheckoutDraft()).toEqual({})
  })

  it('pedido concluido limpa o rascunho', () => {
    saveCheckoutDraft({ guestName: 'A' })
    clearCheckoutDraft()
    expect(readCheckoutDraft()).toEqual({})
  })

  it('nao guarda campo vazio, pra nao sobrescrever o cadastro com string vazia', () => {
    saveCheckoutDraft({ guestName: '', city: 'Miguel Pereira' })
    expect(readCheckoutDraft()).toEqual({ city: 'Miguel Pereira' })
  })
})
