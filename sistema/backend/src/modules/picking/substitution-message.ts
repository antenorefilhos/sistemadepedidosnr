/**
 * Mensagem de troca sugerida pelo separador (08/10/2026, etapa 1: WhatsApp).
 *
 * O separador marca o que faltou, sugere o produto que tem na gondola e manda
 * tudo de uma vez pelo WhatsApp da loja, com preco e o total com e sem as
 * trocas. O cliente decide; a mensagem ja vem pronta para ninguem digitar.
 */

export const SUBSTITUTION_REPLY_MINUTES = 15

export type SuggestionLine = {
  originalName: string
  originalSubtotal: number
  suggestion?: { name: string; quantityLabel: string; subtotal: number } | null
}

const brl = (v: number) => `R$ ${(Math.round(v * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

const firstName = (name?: string | null) => {
  const first = String(name || '').trim().split(/\s+/)[0] || ''
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : ''
}

export function buildSubstitutionMessage(input: {
  customerName?: string | null
  pickerName?: string | null
  orderCode: string
  lines: SuggestionLine[]
  totalWithout: number
  totalWith: number
}): string {
  const cliente = firstName(input.customerName)
  const separador = firstName(input.pickerName)
  const comTroca = input.lines.filter((line) => line.suggestion)
  const out: string[] = []

  out.push(`Olá${cliente ? `, ${cliente}` : ''}! ${separador ? `Aqui é ${separador}, do` : 'Aqui é do'} Antenor & Filhos, separando o seu pedido ${input.orderCode}.`)
  out.push('')
  out.push('Não encontramos na loja:')
  for (const line of input.lines) out.push(`• ${line.originalName} (${brl(line.originalSubtotal)})`)

  if (comTroca.length) {
    out.push('')
    out.push('Podemos trocar por:')
    comTroca.forEach((line, i) => {
      const s = line.suggestion!
      const prefixo = comTroca.length > 1 ? `${i + 1}) ` : '• '
      out.push(`${prefixo}${s.quantityLabel ? `${s.quantityLabel} ` : ''}${s.name}: ${brl(s.subtotal)} (no lugar de ${line.originalName})`)
    })
    out.push('')
    out.push(`Com ${comTroca.length === 1 ? 'a troca' : 'as trocas'}, o pedido fica em ${brl(input.totalWith)}.`)
    out.push(`Sem ${comTroca.length === 1 ? 'a troca' : 'as trocas'}, fica em ${brl(input.totalWithout)}.`)
    out.push('')
    if (comTroca.length === 1) {
      out.push('Responda SIM para aceitar a troca ou NÃO para seguir sem ela.')
    } else {
      out.push('Responda SIM para aceitar todas, NÃO para seguir sem elas, ou os números das que aceita (ex.: 1).')
    }
  } else {
    out.push('')
    out.push(`Seguimos sem ${input.lines.length === 1 ? 'esse item' : 'esses itens'}; o pedido fica em ${brl(input.totalWithout)}.`)
  }
  return out.join('\n')
}

/** wa.me com o numero do cliente (DDD + numero, com ou sem o 55). */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  let digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  if (!/^55\d{10,11}$/.test(digits)) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/** "2 un", "220 g", "1,2 kg"; vazio para 1 unidade. Abaixo de 1 kg, em gramas: "0,22 kg" confunde. */
export function quantityLabel(quantity: number, weighed: boolean): string {
  if (weighed && quantity < 1) return `${Math.round(quantity * 1000)} g`
  if (weighed) return `${quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`
  return quantity > 1 ? `${quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} un` : ''
}
