const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')

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

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function artifactInfo(name, filePath) {
  const stats = fs.statSync(filePath)
  return {
    name,
    path: relative(filePath),
    sha256: sha256File(filePath),
    bytes: stats.size,
  }
}

function writeEvidenceManifest(evidenceDir, reportPath) {
  const manifestPath = path.join(evidenceDir, 'web-push-evidence-manifest.json')
  const artifactEntries = [
    ['readiness', path.join(evidenceDir, 'web-push-readiness.json')],
    ['inspection', path.join(evidenceDir, 'web-push-inspect.json')],
    ['dry-run', path.join(evidenceDir, 'web-push-dry-run.json')],
    ['send', path.join(evidenceDir, 'web-push-send.json')],
    ['visual-confirmation', path.join(evidenceDir, 'web-push-visual-confirmation.json')],
    ['report', reportPath],
  ]

  const windowsNotificationHistoryPath = path.join(evidenceDir, 'web-push-windows-notification-history.json')
  if (fs.existsSync(windowsNotificationHistoryPath)) {
    artifactEntries.push(['windows-notification-history', windowsNotificationHistoryPath])
  }

  const artifacts = artifactEntries.map(([name, filePath]) => artifactInfo(name, filePath))

  const manifest = {
    generatedAt: new Date().toISOString(),
    command: 'finalize-web-push-homologation',
    evidenceDir: relative(evidenceDir),
    report: relative(reportPath),
    required: {
      readiness: true,
      send: true,
      visualConfirmation: true,
    },
    artifacts,
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifestPath
}

function runStep(label, script, args) {
  console.log(`\n> ${label}`)
  const result = spawnSync(process.execPath, [path.join('scripts', script), ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })

  if (result.error) throw result.error
  if (result.stdout.trim()) console.log(result.stdout.trim())
  if (result.stderr.trim()) console.error(result.stderr.trim())
  if (result.status !== 0) {
    throw new Error(`${label} falhou com exit code ${result.status}.`)
  }

  return result.stdout.trim()
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const evidenceDir = resolveInsideRoot('--evidence-dir', options['evidence-dir'])
  if (!fs.existsSync(evidenceDir) || !fs.statSync(evidenceDir).isDirectory()) {
    throw new Error(`Pasta de evidencias inexistente: ${relative(evidenceDir)}`)
  }

  const output = options.output ? resolveInsideRoot('--output', options.output) : null
  const requiredFlags = ['--require-readiness', '--require-send', '--require-visual-confirmation']
  const evidenceArgs = ['--evidence-dir', relative(evidenceDir), ...requiredFlags]

  runStep('Validacao final do pacote Web Push', 'validate-web-push-evidence.js', evidenceArgs)

  const reportArgs = [...evidenceArgs]
  if (output) reportArgs.push('--output', relative(output))
  runStep('Relatorio final de homologacao Web Push', 'generate-web-push-homologation-report.js', reportArgs)

  const reportPath = output || path.join(evidenceDir, 'web-push-homologation-report.md')
  const manifestPath = writeEvidenceManifest(evidenceDir, reportPath)
  runStep('Verificacao de integridade do manifesto Web Push', 'verify-web-push-evidence-manifest.js', [
    '--evidence-dir',
    relative(evidenceDir),
  ])

  console.log('\nWeb Push homologation finalized.')
  console.log(`- evidenceDir: ${relative(evidenceDir)}`)
  console.log(`- report: ${relative(reportPath)}`)
  console.log(`- manifest: ${relative(manifestPath)}`)
  console.log('- required: readiness, send, visual confirmation')
}

try {
  main()
} catch (error) {
  console.error(`Web Push homologation finalization failed: ${error.message}`)
  process.exitCode = 1
}
