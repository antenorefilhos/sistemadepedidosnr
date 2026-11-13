/**
 * Tema do painel admin: Automatico (segue o aparelho), Claro ou Escuro.
 *
 * A escolha fica no navegador (localStorage). A classe `dark` vai no <html>, que e o
 * que `darkMode: ["class"]` do Tailwind e as variaveis do index.css esperam. O mesmo
 * calculo roda ANTES do React, num script em index.html, para a tela nao piscar
 * branca: se mudar a regra ou a chave aqui, mude la tambem.
 */
export type ThemePreference = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'antenor-admin-theme'

/**
 * Padrao enquanto o escuro nao foi conferido tela a tela (13/11/2026): quem nunca
 * mexeu no botao continua vendo o claro de sempre, mesmo com o aparelho no escuro.
 * Depois da conferencia, trocar para 'auto' (e o mesmo valor no script do index.html).
 */
export const DEFAULT_PREFERENCE: ThemePreference = 'light'

export const PREFERENCE_LABEL: Record<ThemePreference, string> = {
  auto: 'Automático',
  light: 'Claro',
  dark: 'Escuro',
}

export function parsePreference(raw: unknown): ThemePreference {
  return raw === 'auto' || raw === 'light' || raw === 'dark' ? raw : DEFAULT_PREFERENCE
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'auto') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

export function nextPreference(preference: ThemePreference): ThemePreference {
  if (preference === 'auto') return 'light'
  if (preference === 'light') return 'dark'
  return 'auto'
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

function defaultStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined // acesso bloqueado (navegador privado, politica de cookies)
  }
}

export function readStoredPreference(storage: ReadableStorage | undefined = defaultStorage()): ThemePreference {
  try {
    return parsePreference(storage?.getItem(THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_PREFERENCE
  }
}

export function storePreference(preference: ThemePreference, storage: WritableStorage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // sem armazenamento: o tema vale so ate fechar a aba
  }
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Aplica no <html>: classe `dark` (Tailwind) e `color-scheme` (barras de rolagem e campos nativos). */
export function applyTheme(resolved: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}
