/**
 * Ficha do vinho (03/10/2026): o que o rotulo diz, para filtros da Adega e a
 * pagina do produto, do cliente novato ao experiente. So do site (o sync nao
 * mexe). Preenchida pela curadoria (pesquisa por rotulo) e editavel no admin.
 *
 * Regra da curadoria: nao inventar. Campo sem fonte fica vazio.
 */
export const WINE_TYPES = ['tinto', 'branco', 'rosé', 'espumante', 'fortificado', 'sobremesa'] as const
export const WINE_STYLES = ['seco', 'meio-seco', 'suave', 'brut', 'extra-brut', 'nature', 'demi-sec', 'sem álcool'] as const

const TEXT_FIELDS = {
  nomeRotulo: 160,
  produtor: 120,
  marcaLinha: 120,
  pais: 60,
  regiaoDenominacao: 160,
  classificacao: 80,
  teorAlcoolico: 20,
  volume: 20,
  descricaoCurta: 600,
  notasDegustacao: 1200,
  harmonizacao: 600,
  temperaturaServico: 60,
  guarda: 120,
  confianca: 10,
} as const

export type WineProfile = Partial<Record<keyof typeof TEXT_FIELDS, string>> & {
  tipo?: (typeof WINE_TYPES)[number]
  estilo?: (typeof WINE_STYLES)[number]
  uvas?: string[]
  fontes?: string[]
}

const clean = (v: unknown, max: number) => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : typeof v === 'number' ? String(v) : ''
  return s ? s.slice(0, max) : undefined
}

/** Aceita so os campos conhecidos, com tamanho limitado. Ficha vazia vira null. */
export function sanitizeWineProfile(input: unknown): WineProfile | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const raw = input as Record<string, unknown>
  const out: WineProfile = {}
  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    const value = clean(raw[key], max)
    if (value) (out as Record<string, string>)[key] = value
  }
  const tipo = clean(raw.tipo, 20)?.toLowerCase()
  if (tipo && (WINE_TYPES as readonly string[]).includes(tipo)) out.tipo = tipo as WineProfile['tipo']
  const estilo = clean(raw.estilo, 20)?.toLowerCase()
  if (estilo && (WINE_STYLES as readonly string[]).includes(estilo)) out.estilo = estilo as WineProfile['estilo']
  const list = (v: unknown, max: number, len: number) =>
    (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;/]/) : [])
      .map((x) => clean(x, len))
      .filter((x): x is string => Boolean(x))
      .slice(0, max)
  const uvas = list(raw.uvas, 8, 60)
  if (uvas.length) out.uvas = uvas
  const fontes = list(raw.fontes, 8, 300).filter((u) => /^https?:\/\//i.test(u))
  if (fontes.length) out.fontes = fontes
  return Object.keys(out).length ? out : null
}
