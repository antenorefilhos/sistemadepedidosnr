import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFERENCE,
  PREFERENCE_LABEL,
  THEME_STORAGE_KEY,
  nextPreference,
  parsePreference,
  readStoredPreference,
  resolveTheme,
  storePreference,
} from './theme'

describe('tema do admin', () => {
  describe('parsePreference', () => {
    it('aceita os tres valores validos', () => {
      expect(parsePreference('auto')).toBe('auto')
      expect(parsePreference('light')).toBe('light')
      expect(parsePreference('dark')).toBe('dark')
    })

    it('qualquer outra coisa cai no padrao (nunca quebra a tela)', () => {
      expect(parsePreference(null)).toBe(DEFAULT_PREFERENCE)
      expect(parsePreference(undefined)).toBe(DEFAULT_PREFERENCE)
      expect(parsePreference('')).toBe(DEFAULT_PREFERENCE)
      expect(parsePreference('night')).toBe(DEFAULT_PREFERENCE)
      expect(parsePreference(42)).toBe(DEFAULT_PREFERENCE)
    })
  })

  describe('resolveTheme', () => {
    it('automatico segue o aparelho', () => {
      expect(resolveTheme('auto', true)).toBe('dark')
      expect(resolveTheme('auto', false)).toBe('light')
    })

    it('claro e escuro ignoram o aparelho', () => {
      expect(resolveTheme('light', true)).toBe('light')
      expect(resolveTheme('dark', false)).toBe('dark')
    })
  })

  describe('nextPreference', () => {
    it('cicla automatico, claro, escuro e volta', () => {
      expect(nextPreference('auto')).toBe('light')
      expect(nextPreference('light')).toBe('dark')
      expect(nextPreference('dark')).toBe('auto')
    })
  })

  it('todo valor tem rotulo em portugues', () => {
    expect(PREFERENCE_LABEL).toEqual({ auto: 'Automático', light: 'Claro', dark: 'Escuro' })
  })

  describe('armazenamento', () => {
    const fake = (valor: string | null) => ({ getItem: () => valor, setItem: () => undefined })

    it('le a preferencia salva', () => {
      expect(readStoredPreference(fake('dark'))).toBe('dark')
    })

    it('sem nada salvo ou com valor invalido usa o padrao', () => {
      expect(readStoredPreference(fake(null))).toBe(DEFAULT_PREFERENCE)
      expect(readStoredPreference(fake('lixo'))).toBe(DEFAULT_PREFERENCE)
    })

    it('storage indisponivel (navegador privado, bloqueado) nao quebra', () => {
      const quebrado = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
      expect(readStoredPreference(quebrado)).toBe(DEFAULT_PREFERENCE)
      expect(() => storePreference('dark', quebrado)).not.toThrow()
    })

    it('grava na chave certa', () => {
      const gravados: Array<[string, string]> = []
      storePreference('light', { setItem: (k: string, v: string) => { gravados.push([k, v]) } })
      expect(gravados).toEqual([[THEME_STORAGE_KEY, 'light']])
    })
  })
})
