const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const HANDOFF_PATH = process.argv[2] || process.env.HANDOFF_CSV_PATH
const APPLY_MODE = process.argv.includes('--apply')

const NON_PUBLISHABLE = new Set([
  'REVISAR_NUNCA',
  'NAO_PUBLICAR_INATIVO',
  'NAO_PUBLICAR_INTERNO',
])

const REPORT = {
  timestamp: new Date().toISOString(),
  handoffPath: HANDOFF_PATH,
  applyMode: APPLY_MODE,
  summary: {
    totalRows: 0,
    validRows: 0,
    mappedRows: 0,
    pendingRows: 0,
    notFoundInDb: 0,
    categoriesN1Created: 0,
    categoriesN2Created: 0,
    mappingsUpserted: 0,
    pendingsUpserted: 0,
  },
  samples: {
    mapped: [],
    pending: [],
    notFound: [],
  },
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
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

function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('CSV vazio ou invalido')

  const header = parseCSVLine(lines[0].replace(/^\uFEFF/, '')).map((h) => h.replace(/^"|"$/g, '').trim())
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length !== header.length) continue

    const row = {}
    header.forEach((h, idx) => {
      row[h] = values[idx]?.replace(/^"|"$/g, '')
    })
    rows.push(row)
  }

  return rows
}

async function getOrCreateN1(name, n1ByKey, applyMode) {
  const key = normalizeKey(name)
  if (!key) return null

  if (n1ByKey.has(key)) return n1ByKey.get(key)

  const existingByName = await prisma.category.findFirst({
    where: { name: name.trim() },
    select: { id: true, name: true, parentId: true },
  })

  if (existingByName && !existingByName.parentId) {
    n1ByKey.set(key, existingByName)
    return existingByName
  }

  let candidateName = name.trim()
  if (existingByName && existingByName.parentId) {
    candidateName = `${candidateName} - N1`
  }

  let suffix = 2
  while (true) {
    const conflict = await prisma.category.findFirst({
      where: { name: candidateName },
      select: { id: true },
    })

    if (!conflict) break
    candidateName = `${name.trim()} - N1 ${suffix}`
    suffix += 1
  }

  if (!applyMode) {
    const virtual = { id: `virtual_n1_${key}`, name: candidateName, parentId: null }
    n1ByKey.set(key, virtual)
    return virtual
  }

  const created = await prisma.category.create({
    data: {
      name: candidateName,
      active: true,
      priority: 0,
      parentId: null,
    },
    select: { id: true, name: true, parentId: true },
  })

  REPORT.summary.categoriesN1Created += 1
  n1ByKey.set(key, created)
  return created
}

async function getOrCreateN2(n2Name, parent, n2ByComposite, allByName, applyMode) {
  if (!n2Name) return null
  const base = n2Name.trim()
  if (!base) return null

  const composite = `${parent.id}::${normalizeKey(base)}`
  if (n2ByComposite.has(composite)) return n2ByComposite.get(composite)

  const directKey = normalizeKey(base)
  let candidateName = base

  if (allByName.has(directKey)) {
    const existing = allByName.get(directKey)
    if (existing.parentId === parent.id) {
      n2ByComposite.set(composite, existing)
      return existing
    }

    const withParentSuffix = `${base} - ${parent.name}`
    const withParentKey = normalizeKey(withParentSuffix)

    if (allByName.has(withParentKey)) {
      const existingWithParent = allByName.get(withParentKey)
      n2ByComposite.set(composite, existingWithParent)
      return existingWithParent
    }

    candidateName = withParentSuffix
  }

  if (!applyMode) {
    const virtual = { id: `virtual_n2_${composite}`, name: candidateName, parentId: parent.id }
    allByName.set(normalizeKey(virtual.name), virtual)
    n2ByComposite.set(composite, virtual)
    return virtual
  }

  const created = await prisma.category.create({
    data: {
      name: candidateName,
      parentId: parent.id,
      active: true,
      priority: 0,
    },
    select: { id: true, name: true, parentId: true },
  })

  REPORT.summary.categoriesN2Created += 1
  allByName.set(normalizeKey(created.name), created)
  n2ByComposite.set(composite, created)
  return created
}

async function main() {
  console.log('Handoff apply started...')

  if (!HANDOFF_PATH) {
    console.error('CSV path not provided. Use: node scripts/handoff-apply.js <path.csv> [--apply]')
    process.exit(1)
  }

  if (!fs.existsSync(HANDOFF_PATH)) {
    console.error(`CSV not found: ${HANDOFF_PATH}`)
    process.exit(1)
  }

  const rows = readCSV(HANDOFF_PATH)
  REPORT.summary.totalRows = rows.length

  const dbProducts = await prisma.product.findMany({ select: { ean: true, name: true } })
  const dbByEan = new Map(dbProducts.map((p) => [String(p.ean), p]))

  const allCategories = await prisma.category.findMany({
    select: { id: true, name: true, parentId: true },
  })

  const n1ByKey = new Map()
  const allByName = new Map()
  const n2ByComposite = new Map()

  for (const c of allCategories) {
    const key = normalizeKey(c.name)
    allByName.set(key, c)
    if (!c.parentId) n1ByKey.set(key, c)
  }

  for (const row of rows) {
    const ean = String(row.codigo_ean || '').trim()
    const n1Name = String(row.categoria_ecommerce_n1 || '').trim()
    const n2Name = String(row.categoria_ecommerce_n2 || '').trim()
    const publicacao = String(row.sugestao_publicacao || '').trim()

    if (!ean || !n1Name) continue
    REPORT.summary.validRows += 1

    const dbProduct = dbByEan.get(ean)
    if (!dbProduct) {
      REPORT.summary.notFoundInDb += 1
      if (REPORT.samples.notFound.length < 20) {
        REPORT.samples.notFound.push({ ean, product: row.produto || null, n1: n1Name, n2: n2Name || null })
      }
      continue
    }

    const n1 = await getOrCreateN1(n1Name, n1ByKey, APPLY_MODE)
    if (!n1) continue

    const n2 = await getOrCreateN2(n2Name, n1, n2ByComposite, allByName, APPLY_MODE)

    const isNonPublishable = NON_PUBLISHABLE.has(publicacao)

    if (isNonPublishable) {
      REPORT.summary.pendingRows += 1
      const policyReason = publicacao || 'auto_classify'

      if (APPLY_MODE) {
        await prisma.categoryMappingPending.upsert({
          where: { ean },
          update: {
            productName: dbProduct.name,
            suggestedCategoryN1: n1.name,
            suggestedCategoryN2: n2?.name || null,
            suggestedCategoryId: n1.id,
            reason: policyReason,
            status: 'PENDING',
            notes: `Origem handoff (${publicacao})`,
          },
          create: {
            ean,
            productName: dbProduct.name,
            suggestedCategoryN1: n1.name,
            suggestedCategoryN2: n2?.name || null,
            suggestedCategoryId: n1.id,
            reason: policyReason,
            status: 'PENDING',
            notes: `Origem handoff (${publicacao})`,
          },
        })
        REPORT.summary.pendingsUpserted += 1
      }

      if (REPORT.samples.pending.length < 20) {
        REPORT.samples.pending.push({ ean, product: dbProduct.name, n1: n1.name, n2: n2?.name || null, publicacao })
      }

      continue
    }

    REPORT.summary.mappedRows += 1

    if (APPLY_MODE) {
      await prisma.productCategoryMapping.upsert({
        where: { ean },
        update: {
          categoryId: n1.id,
          subCategoryId: n2?.id || null,
          source: 'handoff',
          priority: 100,
        },
        create: {
          ean,
          categoryId: n1.id,
          subCategoryId: n2?.id || null,
          source: 'handoff',
          priority: 100,
        },
      })
      REPORT.summary.mappingsUpserted += 1
    }

    if (REPORT.samples.mapped.length < 20) {
      REPORT.samples.mapped.push({ ean, product: dbProduct.name, n1: n1.name, n2: n2?.name || null, publicacao })
    }
  }

  const reportPath = path.join(__dirname, `../../../handoff-apply-report-${Date.now()}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(REPORT, null, 2))

  console.log('\nDone.')
  console.log(JSON.stringify(REPORT.summary, null, 2))
  console.log(`\nReport: ${reportPath}`)
}

main()
  .catch((err) => {
    console.error('Apply failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
