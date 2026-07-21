import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-5 w-5 shrink-0 rounded border-[#D2BB8A] text-[#5D082A] focus:ring-[#D2BB8A]',
        className,
      )}
      {...props}
    />
  )
}
