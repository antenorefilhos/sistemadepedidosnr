import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * JON-136 (Auditoria 360, High): escapa texto antes de interpolar em uma
 * string HTML crua (document.write, innerHTML). Nome de cliente,
 * observacao de pedido ou nome de produto com HTML sempre foi possivel
 * (cliente digita livremente) -- sem escape, isso vira HTML executavel na
 * origem do admin assim que um operador clica em Imprimir.
 */
export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
