/**
 * Aviso com o nome do cliente (02/10/2026): {nome} vira o primeiro nome
 * ("GIOVANA conceição" -> "Giovana"). Sem nome confiavel, a frase sai sem ele
 * ("{nome}, esqueceu algo?" -> "Esqueceu algo?") em vez de "Cliente, ...".
 */
const NOME = /\{\s*nome\s*\}/i

export const hasNamePlaceholder = (text: string | null | undefined) => NOME.test(String(text || ''))

export function firstName(fullName: string | null | undefined): string | null {
  const first = String(fullName || '').trim().split(/\s+/)[0] || ''
  // Nome de verdade: so letras (com acento), apostrofo ou hifen, 2+ letras.
  if (!/^[\p{L}][\p{L}'-]{1,30}$/u.test(first)) return null
  return first.charAt(0).toLocaleUpperCase('pt-BR') + first.slice(1).toLocaleLowerCase('pt-BR')
}

export function personalize(text: string, fullName: string | null | undefined): string {
  if (!hasNamePlaceholder(text)) return text
  const name = firstName(fullName)
  if (name) return text.replace(new RegExp(NOME.source, 'gi'), name)
  const out = text
    .replace(/^\s*\{\s*nome\s*\}\s*[,!:.-]?\s*/i, '') // "{nome}, esqueceu" -> "esqueceu"
    .replace(/\s*,\s*\{\s*nome\s*\}/gi, '') // "Oi, {nome}!" -> "Oi!"
    .replace(/\s*\{\s*nome\s*\}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return out.charAt(0).toLocaleUpperCase('pt-BR') + out.slice(1)
}

/** Nome curto para caber no aviso: "Leite Longa Vida UHT Integral Elege Caixinha 1L" -> 36 letras. */
export function shortProductName(name: string): string {
  const clean = String(name || '').replace(/\s+/g, ' ').trim()
  return clean.length > 36 ? `${clean.slice(0, 35).trimEnd()}…` : clean
}
