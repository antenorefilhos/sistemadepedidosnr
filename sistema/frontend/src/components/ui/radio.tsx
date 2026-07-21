import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function Radio({ className, ...props }: RadioProps) {
  return (
    <input
      type="radio"
      className={cn(
        'h-5 w-5 shrink-0 border-[#D2BB8A] text-[#5D082A] focus:ring-[#D2BB8A]',
        className,
      )}
      {...props}
    />
  )
}
