import { cn } from '../../lib/cn'

type SurfaceTone = 'default' | 'warm' | 'dark'

const toneClasses: Record<SurfaceTone, string> = {
  default: 'border-[#E8D7B0]/70 bg-white shadow-sm',
  warm: 'border-[#D2BB8A] bg-white shadow-sm',
  dark: 'border-[#3a3a3a] bg-[#231F20] text-white shadow-md',
}

export function surfaceClasses({
  tone = 'default',
  interactive = false,
  className,
}: {
  tone?: SurfaceTone
  interactive?: boolean
  className?: string
} = {}) {
  return cn(
    'rounded-lg border',
    toneClasses[tone],
    interactive && 'transition-shadow hover:shadow-md',
    className,
  )
}
