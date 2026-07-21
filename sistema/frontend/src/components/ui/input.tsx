import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-10 w-full rounded-md border border-[#D2BB8A]/70 bg-white px-3 py-2 text-sm text-[#231F20] shadow-sm',
        'placeholder:text-[#8A6A3A]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D2BB8A] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
})
