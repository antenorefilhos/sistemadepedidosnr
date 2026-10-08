import type { RecipeIngredient, RecipeProduct, RecipeStep } from '../types'

// Receitas refeitas em 07/10/2026 (revisao de UI/UX do storefront, celular
// primeiro): regras puras das paginas /receitas e /receitas/:slug.

export const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Médio',
  HARD: 'Difícil',
}

/** "45 min", "1 h", "1h30", "5 h": "300 min" ninguem le de bate-pronto. */
export function formatDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h} h`
}

/** "2 xícaras (320 g)", "a gosto", "4". Antes, sem quantidade a unidade sumia ("a gosto"). */
export function ingredientAmount(ingredient: Pick<RecipeIngredient, 'quantity' | 'unit'>): string {
  return [ingredient.quantity, ingredient.unit].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
}

export type RecipeNote = { kind: 'tip' | 'pairing'; text: string }

const NOTE_PREFIX = /^\s*(dica|harmoniza[cç][aã]o)\s*:\s*/i

/**
 * O cadastro guarda "Dica: ..." e "Harmonização: ..." como os ultimos passos
 * do preparo. Na tela eles saem da contagem ("passo 10: Harmonização") e
 * viram quadros proprios -- o da harmonizacao com o vinho para comprar.
 */
export function splitSteps<T extends Pick<RecipeStep, 'content'>>(steps: T[]): { steps: T[]; notes: RecipeNote[] } {
  const kept: T[] = []
  const notes: RecipeNote[] = []
  for (const step of steps) {
    const match = step.content.match(NOTE_PREFIX)
    if (!match) {
      kept.push(step)
      continue
    }
    const text = step.content.slice(match[0].length).trim()
    if (text) notes.push({ kind: /^dica$/i.test(match[1]) ? 'tip' : 'pairing', text })
  }
  return { steps: kept, notes }
}

export type RecipeProductRole = 'main' | 'optional' | 'pairing'

/**
 * Papel do produto na lista de compra, pela observacao do cadastro:
 * - "para harmonizar" (sem ser usado no preparo) -> vinho sugerido, fora do
 *   "colocar tudo": um Catena de R$ 229,90 nao entra no total sem o cliente pedir;
 * - "opcional" / "sem tempo? ..." (alternativa, como o kit feijoada) ->
 *   aparece desmarcado, para nao comprar duas vezes a mesma coisa;
 * - o resto -> ingrediente, ja marcado.
 */
export function recipeProductRole(rp: Pick<RecipeProduct, 'note'>): RecipeProductRole {
  const note = String(rp.note || '')
  if (/harmoniz/i.test(note) && !/cozinh|molho|preparo|receita/i.test(note)) return 'pairing'
  if (/opcional|sem tempo|alternativ/i.test(note)) return 'optional'
  return 'main'
}

/** Receita do dia: a mesma o dia inteiro para todo mundo, outra amanha. */
export function pickOfTheDay<T>(items: T[], date = new Date()): T | undefined {
  if (!items.length) return undefined
  const key = date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return items[hash % items.length]
}
