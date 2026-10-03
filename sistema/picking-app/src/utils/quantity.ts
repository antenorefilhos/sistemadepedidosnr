// Quantidade como o separador le: virgula decimal e ate 3 casas (0,108 kg).
export const qtd = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

// Texto do campo de quantidade: mesma virgula do teclado, sem separador de milhar.
export const qtdInput = (v: number) => String(v).replace('.', ',')

// Notas automaticas gravadas pelo proprio app em versoes antigas (sem acento,
// "0.108/0.1"). "Incluido durante separacao" segue gravado assim de proposito:
// o backend e o PickingShared reconhecem o item incluido por esse texto.
export function noteLabel(note?: string | null): string | null {
  const n = String(note || '').trim()
  if (!n) return null
  if (n === 'Marcacao manual') return 'Marcação manual'
  if (n.includes('Incluido durante separacao')) return 'Incluído durante a separação'
  const m = n.match(/^Quantidade corrigida:\s*([\d.,]+)\s*(?:\/|de)\s*([\d.,]+)$/)
  if (m) return `Quantidade corrigida: ${qtd(m[1].replace(',', '.'))} de ${qtd(m[2].replace(',', '.'))}`
  return n
}
