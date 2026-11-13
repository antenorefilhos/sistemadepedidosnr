import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import {
  PREFERENCE_LABEL,
  applyTheme,
  nextPreference,
  readStoredPreference,
  resolveTheme,
  storePreference,
  systemPrefersDark,
  type ThemePreference,
} from '@/lib/theme'

const ICON = { auto: Monitor, light: Sun, dark: Moon } as const

/**
 * Botao do cabecalho: cada clique passa por Automatico, Claro e Escuro. So ha UMA instancia
 * (o cabecalho aparece em celular e desktop); se um dia houver outra, o estado precisa ser
 * compartilhado, porque cada uma guarda a propria preferencia.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredPreference())

  useEffect(() => {
    applyTheme(resolveTheme(preference, systemPrefersDark()))
    if (preference !== 'auto') return undefined
    // Automatico: acompanha o aparelho se ele trocar de claro para escuro (ex.: ao anoitecer).
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(resolveTheme('auto', media.matches))
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const Icon = ICON[preference]
  const next = nextPreference(preference)
  const label = `Tema: ${PREFERENCE_LABEL[preference]}. Clique para mudar para ${PREFERENCE_LABEL[next]}.`

  return (
    <button
      type="button"
      onClick={() => {
        storePreference(next)
        setPreference(next)
      }}
      className={className}
      aria-label={label}
      title={label}
    >
      <Icon size={18} />
    </button>
  )
}
