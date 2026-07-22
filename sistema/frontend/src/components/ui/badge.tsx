import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type BadgeTone = 'gold' | 'burgundy' | 'neutral' | 'success'

const toneClasses: Record<BadgeTone, string> = {
  gold: 'border-[#D2BB8A] bg-[#F8F4EA] text-[#8A6A3A]',
  burgundy: 'border-[#5D082A]/20 bg-[#5D082A]/10 text-[#5D082A]',
  neutral: 'border-gray-200 bg-white text-[#5d4f33]',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
}

export function Badge({ className, tone = 'gold', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-md border px-2 text-label font-bold uppercase tracking-wider',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
