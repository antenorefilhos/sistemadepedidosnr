import { describe, it, expect } from 'vitest'
import { destinoSeguro } from './AuthContext'

describe('destinoSeguro (redirect pos-login)', () => {
  it('aceita caminho interno', () => {
    expect(destinoSeguro('/checkout')).toBe('/checkout')
  })

  // Open redirect: o destino vem da query string, que qualquer link pode
  // montar. Mandar o cliente pra fora logo apos ele digitar a senha e o
  // vetor classico de phishing.
  it('recusa destino externo', () => {
    expect(destinoSeguro('https://site-falso.com')).toBe('/')
    expect(destinoSeguro('//site-falso.com')).toBe('/')
  })

  it('sem destino vai pra home', () => {
    expect(destinoSeguro(undefined)).toBe('/')
    expect(destinoSeguro('')).toBe('/')
  })
})
