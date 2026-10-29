import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

// AEF-062 (29/10/2026): confirmacao de idade (+18) pra bebida alcoolica e
// tabacaria. "Fica guardada na sessao" (pedido do Jonathan via ORQ-API) ->
// sessionStorage: some ao fechar a aba, nao persiste entre visitas.
const STORAGE_KEY = 'aef_age_verified_18'

const readStoredVerification = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Navegador privado/bloqueado: sem persistir, pede confirmacao de novo
    // a cada carregamento -- degrada pra mais seguro, nao pra menos.
    return false
  }
}

type AgeVerificationContextValue = {
  isVerified: boolean
  isOpen: boolean
  /** Resolve true se ja confirmado ou o cliente confirmar agora; false se cancelar. */
  requestVerification: () => Promise<boolean>
  confirm: () => void
  cancel: () => void
}

const AgeVerificationContext = createContext<AgeVerificationContextValue | null>(null)

export function AgeVerificationProvider({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState(readStoredVerification)
  const [isOpen, setIsOpen] = useState(false)
  const resolvers = useRef<Array<(value: boolean) => void>>([])

  const requestVerification = useCallback(() => {
    if (isVerified) return Promise.resolve(true)
    setIsOpen(true)
    return new Promise<boolean>((resolve) => {
      resolvers.current.push(resolve)
    })
  }, [isVerified])

  const confirm = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Sem storage disponivel: confirmacao vale so pra esta renderizacao.
    }
    setIsVerified(true)
    setIsOpen(false)
    resolvers.current.forEach((resolve) => resolve(true))
    resolvers.current = []
  }, [])

  const cancel = useCallback(() => {
    setIsOpen(false)
    resolvers.current.forEach((resolve) => resolve(false))
    resolvers.current = []
  }, [])

  const value = useMemo(
    () => ({ isVerified, isOpen, requestVerification, confirm, cancel }),
    [isVerified, isOpen, requestVerification, confirm, cancel],
  )

  return <AgeVerificationContext.Provider value={value}>{children}</AgeVerificationContext.Provider>
}

export function useAgeVerification() {
  const context = useContext(AgeVerificationContext)
  if (!context) {
    throw new Error('useAgeVerification must be used within AgeVerificationProvider')
  }
  return context
}
