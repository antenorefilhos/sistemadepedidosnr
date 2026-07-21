import { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { buttonVariants } from './ui/button'
import { cn } from '../lib/cn'

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  loadingText?: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function LoadingButton({
  isLoading = false,
  loadingText,
  children,
  variant = 'primary',
  className,
  disabled,
  ...rest
}: LoadingButtonProps) {
  const variantMap = {
    primary: 'primary',
    secondary: 'outline',
    ghost: 'ghost',
  } as const

  return (
    <button
      {...rest}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={cn(buttonVariants({ variant: variantMap[variant], size: 'lg' }), className)}
    >
      {isLoading ? (
        <>
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
