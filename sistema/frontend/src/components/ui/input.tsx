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
        // JON-160/JON-167 (Auditoria 360): placeholder e anel de foco antigos
        // nao alcancavam contraste AA (2,37:1 e 1,87:1) contra o fundo
        // branco -- #5D4F33 mede 7,98:1 (texto, exige 4,5:1), #5D082A mede
        // 13,69:1 (nao-textual, exige 3:1).
        'placeholder:text-[#5D4F33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D082A] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
})
