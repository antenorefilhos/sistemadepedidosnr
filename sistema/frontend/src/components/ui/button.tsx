import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

// JON-167 (Auditoria 360): anel de foco em #D2BB8A (com ou sem opacidade
// reduzida) mede ~1,87-1,9:1 contra branco -- abaixo do 3:1 exigido pra
// indicador nao-textual (1.4.11). #5D082A solido mede 13,69:1 em qualquer
// variante; unico token de anel a partir de agora.
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#5D082A] text-white shadow-sm hover:bg-[#4a0621] focus-visible:ring-[#5D082A]',
  secondary: 'bg-[#D2BB8A] text-[#231F20] shadow-sm hover:bg-[#c1a978] focus-visible:ring-[#5D082A]',
  outline: 'border border-[#D2BB8A] bg-white text-[#5D082A] hover:bg-[#F8F4EA] focus-visible:ring-[#5D082A]',
  ghost: 'text-[#5D082A] hover:bg-[#F8F4EA] focus-visible:ring-[#5D082A]',
  subtle: 'bg-[#F8F4EA] text-[#5D082A] hover:bg-[#E8D7B0]/60 focus-visible:ring-[#5D082A]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
  // JON-168 (Auditoria 360): 36x36 ficava abaixo do alvo minimo de 44x44.
  icon: 'h-11 w-11 p-0',
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
