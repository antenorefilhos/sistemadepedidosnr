import { useEffect, useRef, useState } from 'react'
import { Truck, CheckCircle } from 'lucide-react'
import { useFreeShipping } from '../hooks/useFreeShipping'
import { formatPrice } from '../utils/format'

interface Props {
  subtotal: number
}

export function FreeShippingBar({ subtotal }: Props) {
  const info = useFreeShipping(subtotal)
  const prevAchieved = useRef(false)
  const [pulse, setPulse] = useState(false)

  // Dispara pulso apenas na transição para conquistado
  useEffect(() => {
    if (info.achieved && !prevAchieved.current) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 1200)
      prevAchieved.current = true
      return () => clearTimeout(t)
    }
    if (!info.achieved) {
      prevAchieved.current = false
    }
    return undefined
  }, [info.achieved])

  if (!info.enabled) return null

  return (
    <div
      className={`rounded-lg px-4 py-3 transition-all duration-500 ${
        info.achieved
          ? 'bg-emerald-50 border border-emerald-200'
          : 'bg-[#FDF8F0] border border-[#E8D7B0]'
      } ${pulse ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {info.achieved ? (
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
        ) : (
          <Truck size={16} className="text-[#5D082A] shrink-0" />
        )}
        <p className="text-sm font-semibold">
          {info.achieved ? (
            <span className="text-emerald-700">🎉 Frete grátis conquistado!</span>
          ) : (
            <span className="text-[#231F20]">
              Falta{' '}
              <span className="text-[#5D082A] font-bold">{formatPrice(info.remaining)}</span>
              {' '}para frete grátis
            </span>
          )}
        </p>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            info.achieved ? 'bg-emerald-500' : 'bg-[#5D082A]'
          }`}
          style={{ width: `${info.pct}%` }}
        />
      </div>
    </div>
  )
}
