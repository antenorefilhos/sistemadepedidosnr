// Peso falado como o separador entende (08/10/2026). "0,22 kg" confundia:
// o pedido era 220 gramas de pepino. Tudo que e peso no app passa por aqui:
// mostrar, comparar com a etiqueta da balanca e ler o que ele digita.

const grams = (kg: number) => Math.round(kg * 1000)

/** "220 g", "1 kg", "1 kg e 588 g" -- curto, para listas. */
export function weightShort(kg: number | string | null | undefined): string {
  const g = grams(Number(kg) || 0)
  if (g < 1000) return `${g} g`
  const whole = Math.floor(g / 1000)
  const rest = g % 1000
  return rest ? `${whole} kg e ${rest} g` : `${whole} kg`
}

/** "220 gramas", "1 quilo", "1 quilo e 588 gramas" -- por extenso, no destaque. */
export function weightLong(kg: number | string | null | undefined): string {
  const g = grams(Number(kg) || 0)
  if (g < 1000) return `${g} ${g === 1 ? 'grama' : 'gramas'}`
  const whole = Math.floor(g / 1000)
  const rest = g % 1000
  const kilos = `${whole} ${whole === 1 ? 'quilo' : 'quilos'}`
  return rest ? `${kilos} e ${rest} ${rest === 1 ? 'grama' : 'gramas'}` : kilos
}

/** "0,220 kg" -- do jeito que sai impresso na etiqueta da balanca. */
export function weightOnScale(kg: number | string | null | undefined): string {
  return `${(Number(kg) || 0).toFixed(3).replace('.', ',')} kg`
}

/**
 * Le o peso que o separador digitou, do jeito que vier:
 * - com virgula ou ponto e menor que 50 -> quilos ("0,268", "1,25", "1.5");
 * - sem virgula e a partir de 20 -> gramas ("268" = 268 g);
 * - sem virgula e abaixo de 20 -> quilos ("2" = 2 kg);
 * - com virgula e 50 ou mais -> gramas ("268,5" = 268,5 g).
 * Ninguem compra 268 kg de pepino nem 2 gramas de banana: o tamanho do numero
 * decide, e a tela mostra por extenso o que entendeu antes de confirmar.
 */
export function parseWeightInput(text: string): { kg: number; read: 'g' | 'kg' } | null {
  const clean = String(text || '').trim().replace(/\s|kg|g/gi, '')
  if (!clean) return null
  const hasDecimal = /[.,]/.test(clean)
  const value = Number(clean.replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return null
  if (hasDecimal) return value >= 50 ? { kg: round3(value / 1000), read: 'g' } : { kg: round3(value), read: 'kg' }
  return value >= 20 ? { kg: round3(value / 1000), read: 'g' } : { kg: round3(value), read: 'kg' }
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

/** Diferenca grande do pedido (mais de 50% para cima ou para baixo): pede conferencia. */
export function weightLooksOff(pickedKg: number, requestedKg: number): boolean {
  if (!(requestedKg > 0) || !(pickedKg > 0)) return false
  const ratio = pickedKg / requestedKg
  return ratio > 1.5 || ratio < 0.5
}
