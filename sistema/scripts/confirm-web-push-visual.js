const fs = require('fs')
const os = require('os')
const path = require('path')
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

function requiredText(options, key, label) {
  const value = String(options[key] || '').trim()
  if (!value) throw new Error(`${label} é obrigatório.`)
  return value
}

function optionalText(options, key) {
  const value = String(options[key] || '').trim()
  return value || null
}

function maybeRelativeEvidencePath(value) {
  if (!value) return null
  const resolved = resolveInsideRoot('--screenshot', value)
  if (!fs.existsSync(resolved)) {
    throw new Error(`Screenshot informado nao existe: ${relative(resolved)}`)
  }
  return relative(resolved)
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
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const evidenceDir = resolveInsideRoot('--evidence-dir', options['evidence-dir'])
  const outputPath = path.join(evidenceDir, 'web-push-visual-confirmation.json')

  const confirmedBy = requiredText(options, 'confirmed-by', '--confirmed-by')
  const device = requiredText(options, 'device', '--device')
  const browser = requiredText(options, 'browser', '--browser')

  const payload = {
    generatedAt: new Date().toISOString(),
    command: 'confirm-web-push-visual',
    confirmed: true,
    confirmedAt: optionalText(options, 'confirmed-at') || new Date().toISOString(),
    confirmedBy,
    device,
    browser,
    origin: optionalText(options, 'origin') || String(process.env.WEB_PUSH_ORIGIN || process.env.FRONTEND_URL || '').trim() || null,
    note: optionalText(options, 'note'),
    screenshot: maybeRelativeEvidencePath(options.screenshot),
    hostUser: os.userInfo().username || null,
  }

  fs.mkdirSync(evidenceDir, { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Web Push visual confirmation written: ${relative(outputPath)}`)

  if (options.finalize) {
    runStep('Finalizacao do pacote Web Push', 'finalize-web-push-homologation.js', [
      '--evidence-dir',
      relative(evidenceDir),
    ])
  }
}

try {
  main()
} catch (error) {
  console.error(`Web Push visual confirmation failed: ${error.message}`)
  process.exitCode = 1
}
