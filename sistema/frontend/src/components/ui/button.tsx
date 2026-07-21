import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#5D082A] text-white shadow-sm hover:bg-[#4a0621] focus-visible:ring-[#5D082A]/30',
  secondary: 'bg-[#D2BB8A] text-[#231F20] shadow-sm hover:bg-[#c1a978] focus-visible:ring-[#D2BB8A]/40',
  outline: 'border border-[#D2BB8A] bg-white text-[#5D082A] hover:bg-[#F8F4EA] focus-visible:ring-[#D2BB8A]/40',
  ghost: 'text-[#5D082A] hover:bg-[#F8F4EA] focus-visible:ring-[#D2BB8A]/40',
  subtle: 'bg-[#F8F4EA] text-[#5D082A] hover:bg-[#E8D7B0]/60 focus-visible:ring-[#D2BB8A]/40',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
  icon: 'h-9 w-9 p-0',
}

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60',
    'active:scale-[0.98]',
    variantClasses[variant],
    sizeClasses[size],
    className,
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
}
