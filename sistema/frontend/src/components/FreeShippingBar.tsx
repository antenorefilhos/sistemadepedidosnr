import { useEffect, useMemo, useRef, useState } from 'react'
import { Truck, CheckCircle } from 'lucide-react'
import { useFreeShipping } from '../hooks/useFreeShipping'
import { formatPrice } from '../utils/format'

interface Props {
  subtotal: number
  /** Ver useFreeShipping: zona sobrepõe o global quando conhecida. */
  zoneFreeAbove?: number | null
}

const CONFETTI_COLORS = ['#5D082A', '#D2BB8A', '#10B981', '#F59E0B', '#3B82F6']

// burstKey muda a cada conquista pra reiniciar as posicoes/animacao (useMemo
// sozinho nao reexecuta sem uma dependencia nova).
function ConfettiBurst({ burstKey }: { burstKey: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        duration: 1.8 + Math.random() * 1.2,
        rotate: Math.round(Math.random() * 360),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [burstKey],
  )

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-[-10px] block h-2.5 w-1.5 rounded-sm"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}

export function FreeShippingBar({ subtotal, zoneFreeAbove }: Props) {
  const info = useFreeShipping(subtotal, zoneFreeAbove)
  const prevAchieved = useRef(false)
  const [pulse, setPulse] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [burstKey, setBurstKey] = useState(0)

  // Dispara pulso + confete/popup apenas na transição para conquistado
  useEffect(() => {
    if (info.achieved && !prevAchieved.current) {
      prevAchieved.current = true
      setPulse(true)
      setCelebrate(true)
      setBurstKey((k) => k + 1)
      const pulseTimer = setTimeout(() => setPulse(false), 1200)
      const celebrateTimer = setTimeout(() => setCelebrate(false), 3200)
      return () => {
        clearTimeout(pulseTimer)
        clearTimeout(celebrateTimer)
      }
    }
    if (!info.achieved) {
      prevAchieved.current = false
    }
    return undefined
  }, [info.achieved])

  if (!info.enabled) return null

  return (
    <>
      {celebrate && (
        <>
          <ConfettiBurst burstKey={burstKey} />
          <div
            role="status"
            className="toast-in-anim fixed top-4 left-1/2 z-[71] w-[min(92vw,360px)] -translate-x-1/2 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-xl"
          >
            <p className="text-sm font-bold text-emerald-700">🎉 Frete grátis conquistado!</p>
            <p className="mt-1 text-xs text-[#5d4f33]">
              Vale nesta compra — e volta a valer sempre que o pedido bater esse valor de novo.
            </p>
          </div>
        </>
      )}
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
    </>
  )
}
