import { useEffect, useRef, useState } from 'react'

export function NetworkToast() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [visible, setVisible] = useState<boolean>(!navigator.onLine)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const clearTimer = () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }

    const showTemporarily = () => {
      clearTimer()
      hideTimerRef.current = window.setTimeout(() => setVisible(false), 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setVisible(true)
      clearTimer()
    }

    const handleOnline = () => {
      setIsOnline(true)
      setVisible(true)
      showTemporarily()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      clearTimer()
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      <div
        className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
          isOnline ? 'bg-[#5D082A]' : 'bg-red-600'
        }`}
      >
        {isOnline ? 'Conexao restabelecida.' : 'Sem conexao com a internet.'}
      </div>
    </div>
  )
}
