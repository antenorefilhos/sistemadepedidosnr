const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const rootDir = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {
    'evidence-dir': 'artifacts/web-push-homologation',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      options[key] = true
    } else {
      options[key] = next
      index += 1
    }
  }

  return options
}

function resolveInsideRoot(label, value) {
  const resolved = path.resolve(rootDir, String(value || ''))
  if (!resolved.startsWith(`${rootDir}${path.sep}`) && resolved !== rootDir) {
    throw new Error(`${label} deve apontar para dentro de sistema/.`)
  }
  return resolved
}

function relative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/')
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function requireString(value, label) {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${label} ausente no manifesto.`)
  return normalized
}

function requireArtifactPaths(manifest) {
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : []
  if (artifacts.length === 0) throw new Error('Manifesto nao lista artefatos.')

  const artifactPaths = new Set(artifacts.map((artifact) => String(artifact.path || '').replace(/\\/g, '/')))
  for (const requiredArtifact of [
    'web-push-readiness.json',
    'web-push-inspect.json',
    'web-push-dry-run.json',
    'web-push-send.json',
    'web-push-visual-confirmation.json',
    'web-push-homologation-report.md',
  ]) {
    if (![...artifactPaths].some((artifactPath) => artifactPath.endsWith(requiredArtifact))) {
      throw new Error(`Manifesto nao lista artefato obrigatorio: ${requiredArtifact}`)
    }
  }

  return artifacts
}

function verifyArtifact(artifact) {
  const artifactPath = resolveInsideRoot('artifact.path', requireString(artifact.path, 'artifact.path'))
  if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
    throw new Error(`Artefato listado no manifesto nao existe: ${relative(artifactPath)}`)
  }

  const actualBytes = fs.statSync(artifactPath).size
  const expectedBytes = Number(artifact.bytes)
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0) {
    throw new Error(`Tamanho invalido no manifesto para ${relative(artifactPath)}.`)
  }
  if (actualBytes !== expectedBytes) {
    throw new Error(`Tamanho divergente para ${relative(artifactPath)}: esperado ${expectedBytes}, atual ${actualBytes}.`)
  }

  const expectedSha256 = String(artifact.sha256 || '').trim()
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error(`SHA-256 invalido no manifesto para ${relative(artifactPath)}.`)
  }

  const actualSha256 = sha256File(artifactPath)
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Hash divergente para ${relative(artifactPath)}.`)
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const evidenceDir = resolveInsideRoot('--evidence-dir', options['evidence-dir'])
  const manifestPath = path.join(evidenceDir, 'web-push-evidence-manifest.json')
  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
    throw new Error(`Manifesto inexistente: ${relative(manifestPath)}`)
  }

  const manifest = readJson(manifestPath)
  if (manifest.command !== 'finalize-web-push-homologation') {
    throw new Error('Manifesto nao foi gerado pelo finalizador de homologacao Web Push.')
  }
  if (manifest.evidenceDir !== relative(evidenceDir)) {
    throw new Error(`Manifesto aponta para outra pasta de evidencias: ${manifest.evidenceDir || 'ausente'}.`)
  }
  if (manifest.required?.readiness !== true || manifest.required?.send !== true || manifest.required?.visualConfirmation !== true) {
    throw new Error('Manifesto nao registra todos os requisitos finais obrigatorios.')
  }
  if (manifest.report) {
    resolveInsideRoot('manifest.report', manifest.report)
  }

  const artifacts = requireArtifactPaths(manifest)
  for (const artifact of artifacts) {
    verifyArtifact(artifact)
  }

  console.log('Web Push evidence manifest verified.')
  console.log(`- evidenceDir: ${relative(evidenceDir)}`)
  console.log(`- manifest: ${relative(manifestPath)}`)
  console.log(`- artifacts: ${artifacts.length}`)
}

try {
  main()
} catch (error) {
  console.error(`Web Push evidence manifest verification failed: ${error.message}`)
  process.exitCode = 1
}
