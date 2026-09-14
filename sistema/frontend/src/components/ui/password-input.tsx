import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Input } from './input'

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement>

/** Input de senha com botão de mostrar/ocultar (ícone de olho). */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      {/* JON-165 (Auditoria 360): tabIndex=-1 tirava o botao da navegacao por
          teclado -- quem usa teclado nao tinha como revisar a senha digitada.
          min-h/w-11 (44px) tambem cobre o alvo de toque minimo. */}
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-[#8A6A3A]/60 transition-colors hover:text-[#5D082A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D082A]"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
})
