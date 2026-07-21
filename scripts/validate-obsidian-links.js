const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const vaultRoot = path.join(repoRoot, 'arquivos-projeto', 'md')
const includeSessions = process.argv.includes('--include-sessions')

const ignoredSchemes = /^(https?:|mailto:|tel:|obsidian:|file:|#)/i

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(fullPath))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files
}

function shouldSkipFile(file) {
  if (includeSessions) return false
  const relative = normalizeSlashes(path.relative(vaultRoot, file))
  return relative.startsWith('06 - Sessões/')
}

function normalizeSlashes(value) {
  return value.replace(/\\/g, '/')
}

function stripAnchor(value) {
  const hashIndex = value.indexOf('#')
  return hashIndex >= 0 ? value.slice(0, hashIndex) : value
}

function stripQuery(value) {
  const queryIndex = value.indexOf('?')
  return queryIndex >= 0 ? value.slice(0, queryIndex) : value
}

function cleanTarget(value) {
  return stripAnchor(stripQuery(value.trim()))
}

function candidatePaths(baseDir, target) {
  const decoded = decodeURIComponent(target)
  const candidates = []
  const rawPath = path.resolve(baseDir, decoded)
  candidates.push(rawPath)

  if (!path.extname(rawPath)) {
    candidates.push(`${rawPath}.md`)
  }

  return candidates
}

function buildIndex(files) {
  const byStem = new Map()
  const byRelative = new Map()

  for (const file of files) {
    const relative = normalizeSlashes(path.relative(vaultRoot, file))
    const stem = path.basename(file, '.md')
    const stemKey = stem.toLowerCase()
    const relativeKey = relative.toLowerCase()
    const noExtKey = relative.replace(/\.md$/i, '').toLowerCase()

    if (!byStem.has(stemKey)) byStem.set(stemKey, [])
    byStem.get(stemKey).push(file)
    byRelative.set(relativeKey, file)
    byRelative.set(noExtKey, file)
  }

  return { byStem, byRelative }
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
}

function resolveWikilink(currentFile, rawTarget, index) {
  const target = cleanTarget(rawTarget)
  if (!target || ignoredSchemes.test(target)) return { ok: true, skipped: true }

  const baseDir = path.dirname(currentFile)
  const normalized = normalizeSlashes(target)

  if (normalized.startsWith('./') || normalized.startsWith('../')) {
    const candidates = candidatePaths(baseDir, normalized)
    const match = candidates.find(fileExists)
    return match ? { ok: true, target: match } : { ok: false, reason: 'relative target not found' }
  }

  if (normalized.includes('/')) {
    const key = normalized.replace(/\.md$/i, '').toLowerCase()
    const direct = index.byRelative.get(key) || index.byRelative.get(`${key}.md`)
    if (direct) return { ok: true, target: direct }

    const candidates = candidatePaths(vaultRoot, normalized)
    const match = candidates.find(fileExists)
    return match ? { ok: true, target: match } : { ok: false, reason: 'vault path not found' }
  }

  const stem = path.basename(normalized, '.md').toLowerCase()
  const matches = index.byStem.get(stem) || []
  if (matches.length === 1) return { ok: true, target: matches[0] }
  if (matches.length > 1) return { ok: true, ambiguous: true, matches }
  return { ok: false, reason: 'wikilink target not found' }
}

function resolveMarkdownLink(currentFile, rawTarget) {
  const target = cleanTarget(rawTarget)
  if (!target || ignoredSchemes.test(target)) return { ok: true, skipped: true }
  if (target.startsWith('data:')) return { ok: true, skipped: true }

  const candidates = candidatePaths(path.dirname(currentFile), target)
  const match = candidates.find(fileExists)
  return match ? { ok: true, target: match } : { ok: false, reason: 'markdown target not found' }
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length
}

function findLinks(file, content, index) {
  const issues = []
  const warnings = []

  const wikilinkPattern = /!?\[\[([^\]]+)\]\]/g
  let wikilinkMatch
  while ((wikilinkMatch = wikilinkPattern.exec(content)) !== null) {
    const body = wikilinkMatch[1]
    const target = body.split('|')[0].trim()
    const result = resolveWikilink(file, target, index)
    const line = lineNumberAt(content, wikilinkMatch.index)

    if (!result.ok) {
      issues.push({ file, line, type: 'wikilink', target, reason: result.reason })
    } else if (result.ambiguous) {
      warnings.push({
        file,
        line,
        type: 'wikilink',
        target,
        reason: `ambiguous target (${result.matches.length} matches)`,
      })
    }
  }

  const markdownPattern = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g
  let markdownMatch
  while ((markdownMatch = markdownPattern.exec(content)) !== null) {
    const target = markdownMatch[1].trim().replace(/^<|>$/g, '')
    const result = resolveMarkdownLink(file, target)
    const line = lineNumberAt(content, markdownMatch.index)

    if (!result.ok) {
      issues.push({ file, line, type: 'markdown', target, reason: result.reason })
    }
  }

  return { issues, warnings }
}

function formatLocation(file, line) {
  return `${normalizeSlashes(path.relative(repoRoot, file))}:${line}`
}

function main() {
  if (!fs.existsSync(vaultRoot)) {
    throw new Error(`Vault root not found: ${vaultRoot}`)
  }

  const allFiles = walk(vaultRoot)
  const files = allFiles.filter((file) => !shouldSkipFile(file))
  const index = buildIndex(files)
  const issues = []
  const warnings = []

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    const result = findLinks(file, content, index)
    issues.push(...result.issues)
    warnings.push(...result.warnings)
  }

  const skipped = allFiles.length - files.length
  console.log(`Obsidian links scanned: files=${files.length}${skipped ? ` skipped=${skipped}` : ''}`)

  if (warnings.length > 0) {
    console.warn(`Warnings: ${warnings.length}`)
    for (const warning of warnings) {
      console.warn(`- ${formatLocation(warning.file, warning.line)} ${warning.type} [[${warning.target}]]: ${warning.reason}`)
    }
  }

  if (issues.length > 0) {
    console.error(`Broken links: ${issues.length}`)
    for (const issue of issues) {
      console.error(`- ${formatLocation(issue.file, issue.line)} ${issue.type} ${issue.target}: ${issue.reason}`)
    }
    process.exit(1)
  }

  console.log('Obsidian links OK.')
}

main()
