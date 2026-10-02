// Mesma regra do servidor (backend/src/common/personalize.ts e
// cart-reminder.service.ts), so para a previa mostrar o que o cliente recebe.
// Quem decide o texto enviado e sempre o servidor.

export const SAMPLE_NAME = 'Giovana'

export function firstName(fullName: string | null | undefined): string | null {
  const first = String(fullName || '').trim().split(/\s+/)[0] || ''
  if (!/^[\p{L}][\p{L}'-]{1,30}$/u.test(first)) return null
  return first.charAt(0).toLocaleUpperCase('pt-BR') + first.slice(1).toLocaleLowerCase('pt-BR')
}

export function personalize(text: string, fullName: string | null | undefined): string {
  if (!/\{\s*nome\s*\}/i.test(text)) return text
  const name = firstName(fullName)
  if (name) return text.replace(/\{\s*nome\s*\}/gi, name)
  const out = text
    .replace(/^\s*\{\s*nome\s*\}\s*[,!:.-]?\s*/i, '')
    .replace(/\s*,\s*\{\s*nome\s*\}/gi, '')
    .replace(/\s*\{\s*nome\s*\}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return out.charAt(0).toLocaleUpperCase('pt-BR') + out.slice(1)
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ')

export function renderCartTemplate(template: string, ctx: { name?: string | null; product: string; itemCount: number; subtotal: number }) {
  const others = ctx.itemCount - 1
  const itens = others > 0 ? `${ctx.product} e mais ${others} ${others === 1 ? 'item' : 'itens'}` : ctx.product
  const filled = String(template || '')
    .replace(/\{\s*produto\s*\}/gi, ctx.product)
    .replace(/\{\s*itens\s*\}/gi, itens)
    .replace(/\{\s*total\s*\}/gi, brl(ctx.subtotal))
  return personalize(filled, ctx.name).replace(/\s{2,}/g, ' ').trim()
}

/** Insere um marcador onde o cursor esta (ou no fim), devolvendo o texto novo. */
export function insertAtCursor(el: HTMLInputElement | HTMLTextAreaElement | null, value: string, token: string) {
  if (!el || el.selectionStart == null) return `${value}${value && !value.endsWith(' ') ? ' ' : ''}${token}`
  const start = el.selectionStart
  const end = el.selectionEnd ?? start
  return value.slice(0, start) + token + value.slice(end)
}
