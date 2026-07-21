const fs = require('fs')
const path = require('path')
const dns = require('dns/promises')

const rootDir = path.resolve(__dirname, '..')

const COMMERCIAL_CATEGORY_PRIORITY = [
  'CARNES_DIA_A_DIA',
  'CHURRASCO',
  'HORTIFRUTI',
  'PADARIA',
  'LATICINIOS',
  'MERCEARIA',
  'BEBIDAS',
  'CERVEJAS',
  'VINHOS',
  'CONGELADOS',
  'CONSUMO_RAPIDO',
  'GULOSEIMAS',
  'LIMPEZA',
  'HIGIENE_PESSOAL',
  'PERFUMARIA',
  'BEBE',
  'PET_SHOP',
  'UTILIDADES',
  'ESPACO_GOURMET',
  'SERVICO',
  'PATRIMONIAL',
  'NAO_CLASSIFICADO',
  'GERAL',
]

const collator = new Intl.Collator('pt-BR')

function parseArgs(argv) {
  const options = {
    'api-url': process.env.CATEGORY_TREE_API_URL || process.env.API_URL || 'http://localhost:4001',
    'evidence-dir': null,
    'strict-mercadological-tree': false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue

    const [rawKey, inlineValue] = arg.slice(2).split('=')
    const value = inlineValue === undefined ? argv[index + 1] : inlineValue

    if (rawKey === 'strict-mercadological-tree') {
      options[rawKey] = true
      continue
    }

    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${rawKey}`)
    }

    options[rawKey] = value
    if (inlineValue === undefined) index += 1
  }

  options['api-url'] = String(options['api-url']).replace(/\/+$/, '')
  return options
}

function endpoint(apiUrl, route) {
  return `${apiUrl}/${route.replace(/^\/+/, '')}`
}

function normalizeCategoryCode(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function categoryPriorityIndex(value) {
  const normalized = normalizeCategoryCode(value)
  const index = COMMERCIAL_CATEGORY_PRIORITY.indexOf(normalized)
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}

function commercialComparator(left, right) {
  const leftPriority = Number(left.priority || 0)
  const rightPriority = Number(right.priority || 0)
  if (leftPriority !== rightPriority) return leftPriority - rightPriority

  const leftActive = left.active !== false
  const rightActive = right.active !== false
  if (leftActive !== rightActive) return leftActive ? -1 : 1

  const priorityDiff =
    categoryPriorityIndex(left.code || left.name) - categoryPriorityIndex(right.code || right.name)
  if (priorityDiff !== 0) return priorityDiff

  return collator.compare(String(left.name || ''), String(right.name || ''))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function fetchJson(url) {
  let response
  try {
    response = await fetch(url)
  } catch (error) {
    const reason = error && error.cause && error.cause.message
      ? error.cause.message
      : error.message
    throw new Error(`${url} fetch failed: ${reason}`)
  }

  const text = await response.text()

  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch (error) {
      throw new Error(`${url} returned non-JSON response: ${text.slice(0, 120)}`)
    }
  }

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  return { url, status: response.status, body }
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`)
  return value
}

function assertUniqueIds(items, label) {
  const seen = new Set()
  for (const item of items) {
    assert(item && item.id, `${label} item is missing id`)
    assert(!seen.has(item.id), `${label} has duplicated id ${item.id}`)
    seen.add(item.id)
  }
}

function assertCommercialOrder(items, label) {
  const expected = [...items].sort(commercialComparator)
  const mismatches = []

  for (let index = 0; index < items.length; index += 1) {
    const actual = items[index]
    const sorted = expected[index]
    if ((actual.id || actual.code || actual.name) !== (sorted.id || sorted.code || sorted.name)) {
      mismatches.push({
        index,
        actual: actual.name || actual.code || actual.id,
        expected: sorted.name || sorted.code || sorted.id,
      })
    }
  }

  assert(mismatches.length === 0, `${label} order mismatch: ${JSON.stringify(mismatches.slice(0, 5))}`)
}

function assertPriorityDescending(items, label) {
  for (let index = 1; index < items.length; index += 1) {
    const previous = Number(items[index - 1].priority || 0)
    const current = Number(items[index].priority || 0)
    assert(previous >= current, `${label} priority order mismatch at index ${index}`)
  }
}

function assertHierarchyOrder(roots) {
  assertPriorityDescending(roots, 'category hierarchy roots')
  for (const root of roots) {
    assert(Array.isArray(root.children), `category ${root.name || root.id} children must be an array`)
    assertPriorityDescending(root.children, `category hierarchy children of ${root.name || root.id}`)
    assertUniqueIds(root.children, `children of ${root.name || root.id}`)
  }
}

function assertMercadologicalOrder(nodes, label = 'mercadological tree') {
  const values = nodes.map((item) => String(item.value || ''))
  const expected = [...values].sort((left, right) => collator.compare(left, right))
  assert(
    values.every((value, index) => value === expected[index]),
    `${label} is not ordered alphabetically`
  )

  for (const node of nodes) {
    if (Array.isArray(node.children) && node.children.length > 0) {
      assertMercadologicalOrder(node.children, `${label} > ${node.value}`)
    }
  }
}

function summarizeHierarchy(roots) {
  const children = roots.reduce((total, root) => total + root.children.length, 0)
  return {
    roots: roots.length,
    children,
    rootsWithChildren: roots.filter((root) => root.children.length > 0).length,
    firstRoots: roots.slice(0, 10).map((root) => root.name),
  }
}

function writeEvidence(evidenceDir, report) {
  if (!evidenceDir) return null
  const targetDir = path.resolve(rootDir, evidenceDir)
  fs.mkdirSync(targetDir, { recursive: true })
  const filePath = path.join(targetDir, 'category-tree-validation.json')
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  return filePath
}

function getHostname(apiUrl) {
  try {
    return new URL(apiUrl).hostname
  } catch {
    return null
  }
}

function guessParentDomain(hostname) {
  const parts = String(hostname || '').split('.').filter(Boolean)
  if (parts.length <= 2) return null
  if (parts.length >= 3 && parts[parts.length - 1] === 'br') {
    return parts.slice(-3).join('.')
  }
  return parts.slice(-2).join('.')
}

async function resolveDns(label, hostname) {
  if (!hostname) return null

  const result = { label, hostname, lookup: null, records: null, error: null }

  try {
    result.lookup = await dns.lookup(hostname, { all: true })
  } catch (error) {
    result.error = error.message
  }

  try {
    result.records = await dns.resolveAny(hostname)
  } catch (error) {
    if (!result.error) result.error = error.message
  }

  return result
}

async function collectDiagnostics(apiUrl) {
  const hostname = getHostname(apiUrl)
  const parentDomain = guessParentDomain(hostname)
  const dnsResults = []

  const hostDns = await resolveDns('api-host', hostname)
  if (hostDns) dnsResults.push(hostDns)

  if (parentDomain && parentDomain !== hostname) {
    const parentDns = await resolveDns('parent-domain', parentDomain)
    if (parentDns) dnsResults.push(parentDns)
  }

  return {
    hostname,
    parentDomain,
    dns: dnsResults,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const generatedAt = new Date().toISOString()

  const [health, cmsCategories, commercial, mercadological, hierarchy] = await Promise.all([
    fetchJson(endpoint(options['api-url'], 'health')),
    fetchJson(endpoint(options['api-url'], 'cms/categories')),
    fetchJson(endpoint(options['api-url'], 'cms/categories/commercial')),
    fetchJson(endpoint(options['api-url'], 'products/mercadological-tree')),
    fetchJson(endpoint(options['api-url'], 'api/categories/hierarchy')),
  ])

  assert(health.body && health.body.status === 'ok', 'health endpoint did not return status ok')

  const cmsItems = assertArray(cmsCategories.body, 'cms/categories')
  const commercialItems = assertArray(commercial.body, 'cms/categories/commercial')
  const mercadologicalItems = assertArray(mercadological.body && mercadological.body.data, 'products/mercadological-tree data')
  const hierarchyRoots = assertArray(hierarchy.body && hierarchy.body.data, 'api/categories/hierarchy data')

  assert(cmsItems.length > 0, 'cms/categories returned no categories')
  assert(commercialItems.length > 0, 'cms/categories/commercial returned no categories')
  assert(hierarchyRoots.length > 0, 'api/categories/hierarchy returned no root categories')

  assertUniqueIds(cmsItems.filter((item) => item.id), 'cms/categories')
  assertUniqueIds(commercialItems.filter((item) => item.id), 'cms/categories/commercial')
  assertUniqueIds(hierarchyRoots, 'api/categories/hierarchy roots')

  assertCommercialOrder(cmsItems, 'cms/categories')
  assertCommercialOrder(commercialItems, 'cms/categories/commercial')
  assertHierarchyOrder(hierarchyRoots)

  if (mercadologicalItems.length > 0) {
    assertMercadologicalOrder(mercadologicalItems)
  } else if (options['strict-mercadological-tree']) {
    throw new Error('products/mercadological-tree returned no roots')
  }

  const activeCmsRoots = cmsItems.filter((item) => item.active !== false && item.parentId === null)
  const warnings = []
  if (activeCmsRoots.length > 0 && activeCmsRoots.length !== hierarchyRoots.length) {
    warnings.push(
      `active CMS root count (${activeCmsRoots.length}) differs from hierarchy roots (${hierarchyRoots.length})`
    )
  }
  if (mercadologicalItems.length === 0) {
    warnings.push('products/mercadological-tree is empty; staging products may not have classification01..04 filled')
  }

  const report = {
    generatedAt,
    apiUrl: options['api-url'],
    status: 'ok',
    endpoints: {
      health: { url: health.url, status: health.status },
      cmsCategories: { url: cmsCategories.url, status: cmsCategories.status },
      commercialTaxonomy: { url: commercial.url, status: commercial.status },
      mercadologicalTree: { url: mercadological.url, status: mercadological.status },
      categoryHierarchy: { url: hierarchy.url, status: hierarchy.status },
    },
    summary: {
      cmsCategories: cmsItems.length,
      commercialCategories: commercialItems.length,
      hierarchy: summarizeHierarchy(hierarchyRoots),
      mercadologicalRoots: mercadologicalItems.length,
    },
    checks: {
      healthOk: true,
      cmsCategoriesLoaded: true,
      commercialTaxonomyLoaded: true,
      hierarchyLoaded: true,
      cmsOrder: 'ok',
      commercialOrder: 'ok',
      hierarchyPriorityOrder: 'ok',
      mercadologicalOrder: mercadologicalItems.length > 0 ? 'ok' : 'not-applicable-empty',
    },
    warnings,
  }

  const evidencePath = writeEvidence(options['evidence-dir'], report)

  console.log('Category tree validation OK')
  console.log(`API: ${options['api-url']}`)
  console.log(`CMS categories: ${cmsItems.length}`)
  console.log(`Commercial categories: ${commercialItems.length}`)
  console.log(`Hierarchy roots: ${report.summary.hierarchy.roots}`)
  console.log(`Hierarchy children: ${report.summary.hierarchy.children}`)
  console.log(`Mercadological roots: ${mercadologicalItems.length}`)
  if (warnings.length > 0) {
    console.log(`Warnings: ${warnings.join('; ')}`)
  }
  if (evidencePath) {
    console.log(`Evidence: ${evidencePath}`)
  }
}

main().catch(async (error) => {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options['evidence-dir']) {
      const report = {
        generatedAt: new Date().toISOString(),
        apiUrl: options['api-url'],
        status: 'failed',
        error: error.message,
        diagnostics: await collectDiagnostics(options['api-url']),
      }
      const evidencePath = writeEvidence(options['evidence-dir'], report)
      if (evidencePath) {
        console.error(`Evidence: ${evidencePath}`)
      }
    }
  } catch {
    // If argument parsing itself failed, print the original error only.
  }
  console.error('Category tree validation failed:')
  console.error(error.message)
  process.exit(1)
})
