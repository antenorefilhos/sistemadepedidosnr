const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Pode ser passado como argumento ou variável de ambiente
const HANDOFF_PATH = process.argv[2] || process.env.HANDOFF_CSV_PATH

// Configs
const PUBLICACAO_RULES = {
  'PUBLICAR': { publish: true, reason: 'Publicar imediatamente' },
  'PUBLICAR_QUANDO_HOUVER_ESTOQUE': { publish: 'depends_stock', reason: 'Publicar apenas com estoque' },
  'REVISAR_NUNCA': { publish: false, reason: 'Revisar manualmente — não publicar automaticamente' },
  'NAO_PUBLICAR_INATIVO': { publish: false, reason: 'Nunca publicar — inativo no ERP' },
  'NAO_PUBLICAR_INTERNO': { publish: false, reason: 'Nunca publicar — uso interno' }
}

const TIPO_INTEGRACAO_RULES = {
  'ESTOQUE': { visibility: 'stock_gated', reason: 'Visível apenas com estoque' },
  'SEMPRE': { visibility: 'always', reason: 'Sempre visível' },
  'NUNCA': { visibility: 'hidden', reason: 'Nunca visível' }
}

const DRY_RUN_REPORT = {
  timestamp: new Date().toISOString(),
  summary: {
    total_rows: 0,
    categories_n1: 0,
    categories_n2: 0,
    products_mapped: 0,
    products_pending: 0,
    products_ignored: 0,
    products_not_found_in_db: 0
  },
  categories: {
    n1: [],
    n2_by_n1: {}
  },
  validations: {
    errors: [],
    warnings: []
  },
  products: {
    mapped: [],
    pending: [],
    ignored: [],
    not_found: []
  }
}

async function dryRun() {
  console.log('🔍 Iniciando dry-run do handoff ecommerce...\n')

  if (!HANDOFF_PATH) {
    console.error('❌ Caminho do CSV não fornecido')
    console.log('   Use: node scripts/handoff-dry-run.js /caminho/para/handoff.csv')
    process.exit(1)
  }

  if (!fs.existsSync(HANDOFF_PATH)) {
    console.error(`❌ Arquivo não encontrado: ${HANDOFF_PATH}`)
    process.exit(1)
  }

  try {
    // Lê CSV
    const rows = readCSV(HANDOFF_PATH)
    DRY_RUN_REPORT.summary.total_rows = rows.length
    console.log(`✓ ${rows.length} linhas lidas do CSV`)

    // Analisa estrutura N1/N2
    const n1Set = new Set()
    const n2ByN1 = {}

    for (const row of rows) {
      const n1 = row.categoria_ecommerce_n1?.trim()
      const n2 = row.categoria_ecommerce_n2?.trim()

      if (!n1) {
        DRY_RUN_REPORT.validations.errors.push(`Linha sem N1: EAN ${row.codigo_ean}`)
        continue
      }

      n1Set.add(n1)

      if (n2) {
        if (!n2ByN1[n1]) n2ByN1[n1] = new Set()
        n2ByN1[n1].add(n2)
      }
    }

    DRY_RUN_REPORT.summary.categories_n1 = n1Set.size
    DRY_RUN_REPORT.categories.n1 = Array.from(n1Set).sort()

    for (const [n1, n2Set] of Object.entries(n2ByN1)) {
      DRY_RUN_REPORT.categories.n2_by_n1[n1] = Array.from(n2Set).sort()
      DRY_RUN_REPORT.summary.categories_n2 += n2Set.size
    }

    console.log(`✓ ${DRY_RUN_REPORT.summary.categories_n1} categorias N1 detectadas`)
    console.log(`✓ ${DRY_RUN_REPORT.summary.categories_n2} categorias N2 detectadas\n`)

    // Busca produtos no DB
    console.log('🔎 Consultando banco de dados...')
    const dbProducts = await prisma.product.findMany({
      select: { id: true, ean: true, name: true, active: true }
    })
    const dbProductsByEan = new Map(dbProducts.map(p => [p.ean, p]))
    console.log(`✓ ${dbProducts.length} produtos em banco\n`)

    // Processa cada linha do handoff
    console.log('📊 Analisando mapeamentos...')
    for (const row of rows) {
      const ean = row.codigo_ean?.trim()
      const n1 = row.categoria_ecommerce_n1?.trim()
      const n2 = row.categoria_ecommerce_n2?.trim()
      const publicacao = row.sugestao_publicacao?.trim()
      const tipoIntegracao = row.tipoIntegracao?.trim()

      if (!ean || !n1) {
        DRY_RUN_REPORT.summary.products_ignored++
        continue
      }

      const dbProduct = dbProductsByEan.get(ean)

      // Produto não existe no BD
      if (!dbProduct) {
        DRY_RUN_REPORT.products.not_found.push({
          ean,
          produto: row.produto?.substring(0, 60),
          n1,
          n2: n2 || null
        })
        DRY_RUN_REPORT.summary.products_not_found_in_db++
        continue
      }

      // Verifica regra de publicação
      const pubRule = PUBLICACAO_RULES[publicacao]
      if (!pubRule || publicacao === 'REVISAR_NUNCA' || publicacao === 'NAO_PUBLICAR_INATIVO' || publicacao === 'NAO_PUBLICAR_INTERNO') {
        DRY_RUN_REPORT.products.pending.push({
          ean,
          produto: dbProduct.name.substring(0, 60),
          n1,
          n2: n2 || null,
          reason: pubRule?.reason || `Sugestão desconhecida: ${publicacao}`,
          tipoIntegracao
        })
        DRY_RUN_REPORT.summary.products_pending++
        continue
      }

      // Produto mapeável
      DRY_RUN_REPORT.products.mapped.push({
        ean,
        produto: dbProduct.name.substring(0, 60),
        n1,
        n2: n2 || null,
        publicacao,
        tipoIntegracao,
        visibility: TIPO_INTEGRACAO_RULES[tipoIntegracao]?.visibility || 'unknown'
      })
      DRY_RUN_REPORT.summary.products_mapped++
    }

    // Valida N2 sem N1
    for (const row of rows) {
      const n1 = row.categoria_ecommerce_n1?.trim()
      const n2 = row.categoria_ecommerce_n2?.trim()
      if (n2 && !n1) {
        DRY_RUN_REPORT.validations.errors.push(`N2 sem N1: "${n2}"`)
      }
    }

    // Gera relatório
    console.log(`\n✅ Dry-run concluído!\n`)
    console.log('📋 Resumo:')
    console.log(`  - Total de linhas: ${DRY_RUN_REPORT.summary.total_rows}`)
    console.log(`  - Categorias N1: ${DRY_RUN_REPORT.summary.categories_n1}`)
    console.log(`  - Categorias N2: ${DRY_RUN_REPORT.summary.categories_n2}`)
    console.log(`  - Produtos mapeáveis: ${DRY_RUN_REPORT.summary.products_mapped}`)
    console.log(`  - Produtos pendentes: ${DRY_RUN_REPORT.summary.products_pending}`)
    console.log(`  - Produtos ignorados: ${DRY_RUN_REPORT.summary.products_ignored}`)
    console.log(`  - EANs não encontrados no BD: ${DRY_RUN_REPORT.summary.products_not_found_in_db}`)

    if (DRY_RUN_REPORT.validations.errors.length > 0) {
      console.log(`\n⚠️  Erros encontrados: ${DRY_RUN_REPORT.validations.errors.length}`)
      DRY_RUN_REPORT.validations.errors.slice(0, 5).forEach(e => console.log(`   - ${e}`))
      if (DRY_RUN_REPORT.validations.errors.length > 5) {
        console.log(`   ... e ${DRY_RUN_REPORT.validations.errors.length - 5} mais`)
      }
    }

    // Salva relatório
    const reportPath = path.join(__dirname, `../../../handoff-dry-run-${Date.now()}.json`)
    fs.writeFileSync(reportPath, JSON.stringify(DRY_RUN_REPORT, null, 2))
    console.log(`\n📁 Relatório salvo: ${reportPath}`)

    return DRY_RUN_REPORT
  } catch (error) {
    console.error('❌ Erro durante dry-run:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) throw new Error('CSV vazio ou inválido')

  // Parse header
  const headerLine = lines[0]
  // Remove BOM se existir
  const header = headerLine.replace(/^\uFEFF/, '').split(',').map(h => h.trim().replace(/^"|"$/g, ''))

  // Parse rows
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length !== header.length) continue

    const row = {}
    header.forEach((h, idx) => {
      row[h] = values[idx]
    })
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result
}

dryRun()
