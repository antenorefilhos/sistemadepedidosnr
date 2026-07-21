import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type DeliveryVerificationModalContextValue = {
  isOpen: boolean
  openModal: () => void
  closeModal: () => void
}

const DeliveryVerificationModalContext = createContext<DeliveryVerificationModalContextValue | null>(null)

export function DeliveryVerificationModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openModal = useCallback(() => setIsOpen(true), [])
  const closeModal = useCallback(() => setIsOpen(false), [])

  const value = useMemo(
    () => ({ isOpen, openModal, closeModal }),
    [isOpen, openModal, closeModal],
  )

  return (
    <DeliveryVerificationModalContext.Provider value={value}>
      {children}
    </DeliveryVerificationModalContext.Provider>
  )
}

export function useDeliveryVerificationModal() {
  const context = useContext(DeliveryVerificationModalContext)
  if (!context) {
    throw new Error('useDeliveryVerificationModal must be used within DeliveryVerificationModalProvider')
  }
  return context
}
