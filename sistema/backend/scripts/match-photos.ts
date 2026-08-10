/**
 * Ferramenta de casamento automatico de fotos por nome.
 *
 * Casa arquivos de imagem de uma pasta com produtos do catalogo, por EAN no
 * nome do arquivo (alta confianca) ou por similaridade de nome (fuzzy, com
 * limiar). Por padrao roda em modo dry-run e so escreve os 3 CSVs de
 * relatorio; passe --apply para de fato gravar as fotos casadas em
 * uploads/products/{ean}.webp (mesmo pipeline do upload manual: resize
 * 800x800, webp qualidade 80).
 *
 * Uso:
 *   npx ts-node scripts/match-photos.ts <pasta-com-fotos> [--apply] [--overwrite] [--out <pasta-saida>]
 *
 * Algoritmo (mesmo validado manualmente na importacao inicial, que levou a
 * cobertura de fotos do catalogo de 13% para 27%):
 *   1. EAN exato no nome do arquivo (prefixo de 8-14 digitos que bate com
 *      algum EAN do catalogo) -> match direto, score 1.0.
 *   2. Caso contrario, normaliza o nome do arquivo e do produto (sem acento,
 *      maiusculo, so alfanumerico) e compara por Jaccard de tokens + razao
 *      de sequencia (media 50/50). Score >= 0.86 E margem >= 0.05 sobre o
 *      segundo colocado -> match automatico. Do contrario cai em "revisao".
 */
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { PrismaClient } from '@prisma/client'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const FUZZY_SCORE_THRESHOLD = 0.86
const FUZZY_MARGIN_THRESHOLD = 0.05
const EAN_PREFIX_RE = /^(\d{8,14})([-_].*)?$/

function stripAccents(value: string) {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '')
}

function normalize(value: string) {
  return stripAccents(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string) {
  return new Set(value.split(' ').filter(Boolean))
}

function stripPhotoSuffixes(stem: string) {
  return stem.replace(/(_Easy-?Resize\.com.*)$/i, '').replace(/(-\d+)$/, '')
}

/** Distancia de edicao normalizada (~equivalente ao difflib.SequenceMatcher.ratio do Python). */
function sequenceRatio(a: string, b: string) {
  if (!a.length && !b.length) return 1
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  const lcs = dp[a.length][b.length]
  return (2 * lcs) / (a.length + b.length || 1)
}

type ProductRow = { ean: string; display: string; norm: string; tokens: Set<string> }
type MatchedRow = { file: string; ean: string; product: string; score: number; method: 'ean_exact' | 'fuzzy' }
type ReviewRow = { file: string; candidates: Array<{ score: number; ean: string; product: string }> }
type UnmatchedRow = { file: string; reason: string }

function csvEscape(value: string | number) {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function writeCsv(filePath: string, header: string[], rows: Array<Array<string | number>>) {
  const lines = [header.join(','), ...rows.map((r) => r.map(csvEscape).join(','))]
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8')
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const overwrite = args.includes('--overwrite')
  const outIdx = args.indexOf('--out')
  const outDir = outIdx >= 0 ? args[outIdx + 1] : process.cwd()
  const photoDir = args.find((a) => !a.startsWith('--') && a !== args[outIdx + 1])

  if (!photoDir) {
    console.error('Uso: npx ts-node scripts/match-photos.ts <pasta-com-fotos> [--apply] [--overwrite] [--out <pasta-saida>]')
    process.exit(1)
  }
  if (!fs.existsSync(photoDir)) {
    console.error(`Pasta nao encontrada: ${photoDir}`)
    process.exit(1)
  }

  const prisma = new PrismaClient()
  const dbProducts = await prisma.product.findMany({
    where: { active: true },
    select: { ean: true, name: true, titleMask: true },
  })
  await prisma.$disconnect()

  const products: ProductRow[] = dbProducts.map((p) => {
    const display = p.titleMask || p.name
    const norm = normalize(display)
    return { ean: p.ean, display, norm, tokens: tokenize(norm) }
  })
  const eanSet = new Set(products.map((p) => p.ean))

  const invIndex = new Map<string, number[]>()
  products.forEach((p, idx) => {
    p.tokens.forEach((t) => {
      if (!invIndex.has(t)) invIndex.set(t, [])
      invIndex.get(t)!.push(idx)
    })
  })

  const files = fs
    .readdirSync(photoDir)
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map((f) => path.join(photoDir, f))

  const matched: MatchedRow[] = []
  const review: ReviewRow[] = []
  const unmatched: UnmatchedRow[] = []

  for (const filePath of files) {
    const fname = path.basename(filePath)
    const stem = stripPhotoSuffixes(path.parse(fname).name)

    const eanMatch = stem.match(EAN_PREFIX_RE)
    if (eanMatch && eanSet.has(eanMatch[1])) {
      const ean = eanMatch[1]
      const product = products.find((p) => p.ean === ean)!
      matched.push({ file: filePath, ean, product: product.display, score: 1, method: 'ean_exact' })
      continue
    }

    const namePart = stem.replace(/^\d{8,14}[-_]/, '')
    const normFile = normalize(namePart)
    const fileTokens = tokenize(normFile)
    if (!fileTokens.size) {
      unmatched.push({ file: filePath, reason: 'sem_tokens' })
      continue
    }

    const candidateIdx = new Set<number>()
    fileTokens.forEach((t) => (invIndex.get(t) || []).forEach((idx) => candidateIdx.add(idx)))
    if (!candidateIdx.size) {
      unmatched.push({ file: filePath, reason: 'sem_candidatos' })
      continue
    }

    const scored = Array.from(candidateIdx)
      .map((idx) => {
        const p = products[idx]
        const intersection = new Set([...fileTokens].filter((t) => p.tokens.has(t)))
        const union = new Set([...fileTokens, ...p.tokens])
        const jaccard = intersection.size / (union.size || 1)
        const ratio = sequenceRatio(normFile, p.norm)
        return { score: 0.5 * jaccard + 0.5 * ratio, ean: p.ean, product: p.display }
      })
      .sort((a, b) => b.score - a.score)

    const best = scored[0]
    const second = scored[1]
    if (best.score >= FUZZY_SCORE_THRESHOLD && best.score - (second?.score || 0) >= FUZZY_MARGIN_THRESHOLD) {
      matched.push({ file: filePath, ean: best.ean, product: best.product, score: Number(best.score.toFixed(3)), method: 'fuzzy' })
    } else {
      review.push({ file: filePath, candidates: scored.slice(0, 3).map((s) => ({ ...s, score: Number(s.score.toFixed(3)) })) })
    }
  }

  console.log(`Total de fotos analisadas: ${files.length}`)
  console.log(`Casadas automaticamente: ${matched.length}`)
  console.log(`  - por EAN exato: ${matched.filter((m) => m.method === 'ean_exact').length}`)
  console.log(`  - por nome (fuzzy >= ${FUZZY_SCORE_THRESHOLD}): ${matched.filter((m) => m.method === 'fuzzy').length}`)
  console.log(`Para revisao manual (ambiguo/baixa confianca): ${review.length}`)
  console.log(`Sem candidato algum: ${unmatched.length}`)

  writeCsv(
    path.join(outDir, 'photo_match_matched.csv'),
    ['file', 'ean', 'product', 'score', 'method'],
    matched.map((m) => [m.file, m.ean, m.product, m.score, m.method]),
  )
  writeCsv(
    path.join(outDir, 'photo_match_review.csv'),
    ['file', 'candidate1', 'ean1', 'name1', 'candidate2', 'ean2', 'name2', 'candidate3', 'ean3', 'name3'],
    review.map((r) => {
      const row: Array<string | number> = [r.file]
      for (let i = 0; i < 3; i++) {
        const c = r.candidates[i]
        row.push(c?.score ?? '', c?.ean ?? '', c?.product ?? '')
      }
      return row
    }),
  )
  writeCsv(
    path.join(outDir, 'photo_match_unmatched.csv'),
    ['file', 'reason'],
    unmatched.map((u) => [u.file, u.reason]),
  )
  console.log(`\nRelatorios gravados em: ${outDir}`)

  if (!apply) {
    console.log('\nModo dry-run (padrao). Rode de novo com --apply para gravar as fotos casadas em uploads/products/.')
    return
  }

  const uploadsDir = path.join(__dirname, '..', 'uploads', 'products')
  fs.mkdirSync(uploadsDir, { recursive: true })

  let written = 0
  let skipped = 0
  const failed: Array<{ file: string; ean: string; error: string }> = []
  for (const m of matched) {
    const destPath = path.join(uploadsDir, `${m.ean}.webp`)
    if (!overwrite && fs.existsSync(destPath)) {
      skipped++
      continue
    }
    try {
      await sharp(m.file)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(destPath)
      written++
    } catch (err) {
      failed.push({ file: m.file, ean: m.ean, error: err instanceof Error ? err.message : String(err) })
    }
  }
  console.log(`\nFotos gravadas: ${written}`)
  console.log(`Puladas (ja tinham foto, use --overwrite para substituir): ${skipped}`)
  if (failed.length) {
    console.log(`Falharam (arquivo pode estar corrompido/formato inesperado): ${failed.length}`)
    writeCsv(
      path.join(outDir, 'photo_match_failed.csv'),
      ['file', 'ean', 'error'],
      failed.map((f) => [f.file, f.ean, f.error]),
    )
    console.log(`Detalhes em: ${path.join(outDir, 'photo_match_failed.csv')}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
