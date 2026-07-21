import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-md border border-[#D2BB8A]/70 bg-white px-3 py-2 text-sm text-[#231F20] shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D2BB8A] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}
