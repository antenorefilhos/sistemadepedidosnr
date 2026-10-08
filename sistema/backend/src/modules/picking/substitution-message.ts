/**
 * Mensagem de troca sugerida pelo separador (08/10/2026, etapa 1: WhatsApp).
 *
 * O separador marca o que faltou, sugere o produto que tem na gondola e manda
 * tudo de uma vez pelo WhatsApp da loja, com preco e o total com e sem as
 * trocas. O cliente decide pelo WhatsApp (o separador registra) ou pelo site,
 * em Minha conta; os dois caminhos gravam na mesma sugestao.
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

// Nome de produto entra entre marcadores do WhatsApp (*negrito*, `codigo`):
// um asterisco ou crase no proprio nome quebraria a formatacao da linha.
const plain = (text: string) => text.replace(/[*`_~]/g, '').trim()

export function buildSubstitutionMessage(input: {
  customerName?: string | null
  /** O numero que o cliente conhece: o DAV, ou o codigo curto sem DAV. */
  orderCode: string
  lines: SuggestionLine[]
  totalWithout: number
  totalWith: number
  /** Minha conta no site, onde o cliente tambem pode escolher (etapa 2). */
  accountUrl?: string | null
}): string {
  // Texto do Jonathan (08/10/2026): direto, sem apresentacao. Itens em lista
  // ("* " vira marcador no WhatsApp); cada troca numa linha so, produto e
  // preco em negrito, o item substituido em `codigo` (fonte diferente) -- sem
  // numero, que parecia quantidade, e sem hifen antes do preco. O link do
  // site fica numa linha propria.
  const cliente = firstName(input.customerName)
  const comTroca = input.lines.filter((line) => line.suggestion)
  const umItem = input.lines.length === 1
  const umaTroca = comTroca.length === 1
  const out: string[] = []

  const abertura = `durante a separação do seu pedido ${input.orderCode} não encontramos ${umItem ? 'o seguinte item' : 'os seguintes itens'}:`
  out.push(cliente ? `${cliente}, ${abertura}` : abertura.charAt(0).toUpperCase() + abertura.slice(1))
  out.push('')
  for (const line of input.lines) out.push(`* ${plain(line.originalName)}`)

  if (comTroca.length) {
    out.push('')
    out.push('Podemos trocar por:')
    for (const line of comTroca) {
      const s = line.suggestion!
      out.push(`* *${plain(s.name)}${s.quantityLabel ? ` (${s.quantityLabel})` : ''} ${brl(s.subtotal)}* \`no lugar de ${plain(line.originalName)}\``)
    }
    out.push('')
    out.push(`Com ${umaTroca ? 'a troca' : 'as trocas'}, o pedido fica em ${brl(input.totalWith)}`)
    out.push(`Sem ${umaTroca ? 'a troca' : 'as trocas'}, fica em ${brl(input.totalWithout)}`)
  } else {
    out.push('')
    out.push(`Sem ${umItem ? 'esse item' : 'esses itens'}, o pedido fica em ${brl(input.totalWithout)}`)
  }
  out.push('')
  out.push('Aguardo sua resposta para darmos continuidade.')
  if (comTroca.length && input.accountUrl) {
    out.push('')
    out.push('Se preferir, escolha pelo site, em Minha conta:')
    out.push(input.accountUrl)
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
