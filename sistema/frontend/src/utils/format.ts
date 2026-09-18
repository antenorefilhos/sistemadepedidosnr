import type { CartItem } from '../types'

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price)
}

export function formatPriceParts(price: number): { currencySymbol: string; value: string } {
  const formatted = formatPrice(price)

  return {
    currencySymbol: 'R$',
    value: formatted.replace(/^R\$\s?/, ''),
  }
}

export function formatPriceValue(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function formatWhatsApp(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
}

export function formatCEP(cep: string): string {
  return cep.replace(/(\d{5})(\d{3})/, '$1-$2')
}

const LOWERCASE_WORDS = new Set([
  'a', 'as', 'o', 'os', 'de', 'da', 'das', 'do', 'dos', 'e', 'em', 'com', 'sem', 'para', 'por',
])

const UNIT_WORDS = new Set(['kg', 'g', 'mg', 'ml', 'l', 'lt', 'un', 'pct', 'cx', 'bdj', 'pet', 'gf'])

export function formatProductTitle(name: string): string {
  if (!name) return ''

  const normalized = name.toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ')

  return normalized
    .split(' ')
    .map((word, index) => {
      if (UNIT_WORDS.has(word)) return word
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word

      return word
        .split(/([-/])/)
        .map((part) => {
          if (part === '-' || part === '/') return part
          if (!part) return part
          return part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1)
        })
        .join('')
    })
    .join(' ')
}

// JON-194: titulo/eyebrow de vitrine vem da AntenorApi (Motor de Vitrines
// Inteligentes) com emoji embutido no texto -- some com o icone lucide que
// ProductShelf ja desenha ao lado, ficando icone + emoji duplicados. Faixa
// unicode cobre os blocos de emoji mais comuns (emoticons, simbolos/pictogramas,
// transporte, bandeiras, dingbats, variation selector e ZWJ de sequencia).
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu

export function stripEmoji(text: string): string {
  if (!text) return ''
  return text.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim()
}

export function getCartFromStorage(): CartItem[] {
  const cart = localStorage.getItem('cart')
  return cart ? (JSON.parse(cart) as CartItem[]) : []
}

export function saveCartToStorage(cart: CartItem[]): void {
  localStorage.setItem('cart', JSON.stringify(cart))
}
