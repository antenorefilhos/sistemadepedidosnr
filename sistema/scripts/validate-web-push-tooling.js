const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const rootDir = path.resolve(__dirname, '..')
const tempPrefix = path.join(rootDir, '.tmp-web-push-tooling-')

function parseArgs(argv) {
  const options = {}

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

function relative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/')
}

function runNode(script, args = []) {
  const output = execFileSync(process.execPath, [path.join(rootDir, 'scripts', script), ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return output.trim()
}

function expectRunNodeFailure(script, args = [], expectedText, forbiddenText = null) {
  try {
    runNode(script, args)
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n')
    assert(output.includes(expectedText), `Expected failure containing "${expectedText}", got: ${output}`)
    if (forbiddenText) {
      assert(!output.includes(forbiddenText), `Failure output must not contain "${forbiddenText}", got: ${output}`)
    }
    return
  }

  throw new Error(`${script} should have failed.`)
}

function parseEnvFile(filePath) {
  const values = new Map()
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match) values.set(match[1], match[2])
  }
  return values
}

function requireEnv(values, key) {
  const value = String(values.get(key) || '').trim()
  if (!value) throw new Error(`${key} was not written.`)
  return value
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function prepareArgs(outputPath, extraArgs = []) {
  return [
    '--output',
    relative(outputPath),
    '--staging',
    '--origin',
    'http://localhost:4000',
    '--admin-origin',
    'http://localhost:4002',
    '--subject',
    'mailto:qa@antenor.com.br',
    ...extraArgs,
  ]
}

function validateReadiness(envPath, jsonOutputPath) {
  const args = ['--env-file', relative(envPath)]
  if (jsonOutputPath) args.push('--json-output', relative(jsonOutputPath))
  const output = runNode('validate-web-push-readiness.js', args)
  assert(output.includes('Web Push readiness OK'), `Readiness did not pass for ${relative(envPath)}.`)
  if (jsonOutputPath) {
    assert(fs.existsSync(jsonOutputPath), 'Readiness JSON output was not written.')
    const payload = JSON.parse(fs.readFileSync(jsonOutputPath, 'utf8'))
    assert(payload.command === 'validate-web-push-readiness', 'Readiness JSON command mismatch.')
    assert(payload.result?.ok === true, 'Readiness JSON did not record ok=true.')
    assert(payload.vapid?.publicKeyMatchesFrontend === true, 'Readiness JSON did not record VAPID parity.')
  }
}

function validateGeneratedEnv(tempDir) {
  const envPath = path.join(tempDir, 'generated.env')
  const readinessJsonPath = path.join(tempDir, 'generated-readiness.json')
  runNode('prepare-web-push-env.js', prepareArgs(envPath, ['--force']))
  validateReadiness(envPath, readinessJsonPath)

  const values = parseEnvFile(envPath)
  requireEnv(values, 'STAGING_VAPID_PUBLIC_KEY')
  requireEnv(values, 'STAGING_VAPID_PRIVATE_KEY')
  assert(
    requireEnv(values, 'STAGING_VAPID_PUBLIC_KEY') === requireEnv(values, 'VITE_VAPID_PUBLIC_KEY'),
    'VITE_VAPID_PUBLIC_KEY must match STAGING_VAPID_PUBLIC_KEY.',
  )

  return envPath
}

function validateFromEnv(tempDir, sourceEnvPath) {
  const envPath = path.join(tempDir, 'from-env.env')
  runNode('prepare-web-push-env.js', prepareArgs(envPath, [
    '--vapid-from-env',
    '--env-file',
    relative(sourceEnvPath),
    '--force',
  ]))
  validateReadiness(envPath)

  const source = parseEnvFile(sourceEnvPath)
  const target = parseEnvFile(envPath)
  const sourcePublicHash = hashValue(requireEnv(source, 'STAGING_VAPID_PUBLIC_KEY'))
  const sourcePrivateHash = hashValue(requireEnv(source, 'STAGING_VAPID_PRIVATE_KEY'))
  const targetPublicHash = hashValue(requireEnv(target, 'STAGING_VAPID_PUBLIC_KEY'))
  const targetPrivateHash = hashValue(requireEnv(target, 'STAGING_VAPID_PRIVATE_KEY'))

  assert(sourcePublicHash === targetPublicHash, '--vapid-from-env did not preserve the public key.')
  assert(sourcePrivateHash === targetPrivateHash, '--vapid-from-env did not preserve the private key.')
}

function validateMergeExisting(tempDir) {
  const envPath = path.join(tempDir, 'merge.env')
  fs.writeFileSync(envPath, [
    '# Existing staging env',
    'NODE_ENV=staging',
    'CUSTOM_KEEP=nao-apagar',
    'STAGING_VAPID_PUBLIC_KEY=old-public',
    'STAGING_VAPID_PRIVATE_KEY=old-private',
    'STAGING_VAPID_SUBJECT=mailto:old@antenor.com.br',
    '',
  ].join('\n'), 'utf8')

  runNode('prepare-web-push-env.js', prepareArgs(envPath, ['--merge-existing']))
  validateReadiness(envPath)

  const values = parseEnvFile(envPath)
  assert(values.get('NODE_ENV') === 'staging', '--merge-existing did not preserve NODE_ENV.')
  assert(values.get('CUSTOM_KEEP') === 'nao-apagar', '--merge-existing did not preserve CUSTOM_KEEP.')
  assert(requireEnv(values, 'STAGING_VAPID_PUBLIC_KEY') !== 'old-public', '--merge-existing did not replace the public key.')
  assert(requireEnv(values, 'STAGING_VAPID_PRIVATE_KEY') !== 'old-private', '--merge-existing did not replace the private key.')
  assert(requireEnv(values, 'STAGING_VAPID_SUBJECT') === 'mailto:qa@antenor.com.br', '--merge-existing did not update the subject.')
}

function validateHomologateOriginOverride(tempDir, envPath) {
  const evidenceDir = path.join(tempDir, 'homologate-origin')
  runNode('homologate-web-push.js', [
    '--env-file',
    relative(envPath),
    '--origin',
    'http://localhost:4010',
    '--readiness-only',
    '--evidence-dir',
    relative(evidenceDir),
  ])
  const readinessPath = path.join(evidenceDir, 'web-push-readiness.json')
  assert(fs.existsSync(readinessPath), 'Homologate readiness evidence was not written.')
  const readiness = JSON.parse(fs.readFileSync(readinessPath, 'utf8'))
  assert(readiness.origin === 'http://localhost:4010', '--origin did not override homologate readiness origin.')
}

function validateExternalReadinessFailure(envPath) {
  expectRunNodeFailure('validate-web-push-readiness.js', [
    '--external',
    '--live',
    '--env-file',
    relative(envPath),
    '--origin',
    'http://127.0.0.1:9',
  ], 'External Web Push validation requires an HTTPS storefront origin.', 'Assertion failed')
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function validateEvidenceManifest(evidenceDir) {
  const manifestPath = path.join(evidenceDir, 'web-push-evidence-manifest.json')
  assert(fs.existsSync(manifestPath), 'Final evidence manifest was not generated.')

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert(manifest.command === 'finalize-web-push-homologation', 'Manifest command mismatch.')
  assert(manifest.required?.readiness === true, 'Manifest did not require readiness.')
  assert(manifest.required?.send === true, 'Manifest did not require send.')
  assert(manifest.required?.visualConfirmation === true, 'Manifest did not require visual confirmation.')
  assert(Array.isArray(manifest.artifacts), 'Manifest artifacts must be an array.')

  const artifactPaths = manifest.artifacts.map((artifact) => artifact.path)
  for (const requiredArtifact of [
    'web-push-homologation-report.md',
    'web-push-send.json',
    'web-push-visual-confirmation.json',
  ]) {
    assert(
      artifactPaths.some((artifactPath) => artifactPath.endsWith(requiredArtifact)),
      `Manifest is missing ${requiredArtifact}.`,
    )
  }

  for (const artifact of manifest.artifacts) {
    assert(/^[a-f0-9]{64}$/.test(String(artifact.sha256 || '')), `Invalid manifest hash for ${artifact.path}.`)
    assert(Number(artifact.bytes) > 0, `Invalid manifest byte size for ${artifact.path}.`)
  }
}

function validateVisualConfirmationEvidence(tempDir) {
  const evidenceDir = path.join(tempDir, 'visual-evidence')
  fs.mkdirSync(evidenceDir, { recursive: true })
  const timestamps = {
    readiness: '2026-06-06T12:00:00.000Z',
    inspect: '2026-06-06T12:01:00.000Z',
    dryRun: '2026-06-06T12:02:00.000Z',
    send: '2026-06-06T12:03:00.000Z',
    visual: '2026-06-06T12:04:00.000Z',
  }
  const baseTarget = {
    subscriptionId: 'sub-visual',
    customerId: 'customer-visual',
    tenantId: 'tenant_default',
    endpoint: 'https://fcm.googleapis.com/fcm/send/masked',
    removed: false,
  }

  writeJson(path.join(evidenceDir, 'web-push-inspect.json'), {
    generatedAt: timestamps.inspect,
    command: 'inspect-web-push-subscriptions',
    origin: 'https://loja.example.com',
    filters: { limit: 1, requireReady: true },
    result: { total: 1, complete: 1, incomplete: 0, shown: 1, ready: true },
    providers: { 'fcm.googleapis.com': 1 },
    customers: { 'customer-visual': 1 },
    subscriptions: [
      {
        id: 'sub-visual',
        customerId: 'customer-visual',
        tenantId: 'tenant_default',
        status: 'complete',
        provider: 'fcm.googleapis.com',
        ageDays: 0,
        endpoint: baseTarget.endpoint,
      },
    ],
  })

  const payload = {
    title: 'Antenor & Filhos',
    body: 'Prova Web Push recebida',
    icon: '/branding/logo-branco.png',
    url: '/',
  }

  writeJson(path.join(evidenceDir, 'web-push-readiness.json'), {
    generatedAt: timestamps.readiness,
    command: 'validate-web-push-readiness',
    modes: { external: true, live: true },
    origin: 'https://loja.example.com',
    subject: 'mailto:qa@antenor.com.br',
    vapid: {
      publicKeySha256: 'fixture-public-key-sha256',
      frontendKeySha256: 'fixture-public-key-sha256',
      publicKeyMatchesFrontend: true,
    },
    result: { ok: true, warnings: 0, failures: 0 },
    warnings: [],
    failures: [],
    liveChecks: [
      { label: 'Storefront home', url: 'https://loja.example.com/', status: 200, ok: true },
      { label: 'Live manifest.webmanifest', url: 'https://loja.example.com/manifest.webmanifest', status: 200, ok: true },
      { label: 'Live service-worker.js', url: 'https://loja.example.com/service-worker.js', status: 200, ok: true },
    ],
  })

  writeJson(path.join(evidenceDir, 'web-push-dry-run.json'), {
    generatedAt: timestamps.dryRun,
    command: 'prove-web-push-delivery',
    origin: 'https://loja.example.com',
    dryRun: true,
    filters: { limit: 1 },
    cleanup: { cleanupExpired: false, cleanupIncomplete: false },
    payload,
    result: { sent: 0, failed: 0, dryRunTargets: 1, expiredRemoved: 0, incompleteRemoved: 0 },
    failures: [],
    targets: [{ ...baseTarget, status: 'dry-run' }],
  })

  writeJson(path.join(evidenceDir, 'web-push-send.json'), {
    generatedAt: timestamps.send,
    command: 'prove-web-push-delivery',
    origin: 'https://loja.example.com',
    dryRun: false,
    filters: { limit: 1 },
    cleanup: { cleanupExpired: false, cleanupIncomplete: false },
    payload,
    result: { sent: 1, failed: 0, dryRunTargets: 0, expiredRemoved: 0, incompleteRemoved: 0 },
    failures: [],
    targets: [{ ...baseTarget, status: 'sent' }],
  })

  const visualConfirmationOutput = runNode('confirm-web-push-visual.js', [
    '--evidence-dir',
    relative(evidenceDir),
    '--confirmed-by',
    'QA Antenor',
    '--device',
    'Windows Chrome',
    '--browser',
    'Chrome PWA',
    '--origin',
    'https://loja.example.com',
    '--confirmed-at',
    timestamps.visual,
    '--note',
    'Confirmacao visual fixture.',
    '--finalize',
  ])
  assert(
    visualConfirmationOutput.includes('Web Push visual confirmation written:'),
    'Visual confirmation command did not write evidence.',
  )
  assert(
    visualConfirmationOutput.includes('Web Push homologation finalized.'),
    'Visual confirmation command did not finalize the package.',
  )
  assert(
    visualConfirmationOutput.includes('Web Push evidence manifest verified.'),
    'Visual confirmation command did not verify the final manifest.',
  )

  const validationOutput = runNode('validate-web-push-evidence.js', [
    '--evidence-dir',
    relative(evidenceDir),
    '--require-readiness',
    '--require-send',
    '--require-visual-confirmation',
  ])
  assert(validationOutput.includes('visual confirmation: confirmed by QA Antenor'), 'Visual confirmation was not validated.')

  const finalizedReportPath = path.join(evidenceDir, 'web-push-homologation-report.md')
  assert(
    fs.existsSync(finalizedReportPath),
    'Final homologation report was not generated.',
  )
  assert(
    visualConfirmationOutput.includes('web-push-evidence-manifest.json'),
    'Finalization command did not print manifest path.',
  )
  validateEvidenceManifest(evidenceDir)
  const manifestVerificationOutput = runNode('verify-web-push-evidence-manifest.js', [
    '--evidence-dir',
    relative(evidenceDir),
  ])
  assert(
    manifestVerificationOutput.includes('Web Push evidence manifest verified.'),
    'Final evidence manifest verification did not pass.',
  )

  const reportPath = path.join(evidenceDir, 'web-push-homologation-report.md')
  const reportContent = fs.readFileSync(reportPath, 'utf8')
  fs.writeFileSync(reportPath, `${reportContent}\nAlteracao indevida pos-finalizacao.\n`, 'utf8')
  expectRunNodeFailure('verify-web-push-evidence-manifest.js', [
    '--evidence-dir',
    relative(evidenceDir),
  ], 'divergente')
  fs.writeFileSync(reportPath, reportContent, 'utf8')

  const sendPath = path.join(evidenceDir, 'web-push-send.json')
  const sendEvidence = JSON.parse(fs.readFileSync(sendPath, 'utf8'))
  writeJson(sendPath, {
    ...sendEvidence,
    targets: [{ ...sendEvidence.targets[0], subscriptionId: 'sub-outro-pacote' }],
  })
  expectRunNodeFailure('validate-web-push-evidence.js', [
    '--evidence-dir',
    relative(evidenceDir),
    '--require-readiness',
    '--require-send',
    '--require-visual-confirmation',
  ], 'Alvo enviado nao apareceu no dry-run do pacote')
  writeJson(sendPath, sendEvidence)

  const visualPath = path.join(evidenceDir, 'web-push-visual-confirmation.json')
  const visualConfirmation = JSON.parse(fs.readFileSync(visualPath, 'utf8'))
  writeJson(visualPath, {
    ...visualConfirmation,
    origin: 'https://outra-loja.example.com',
  })
  expectRunNodeFailure('validate-web-push-evidence.js', [
    '--evidence-dir',
    relative(evidenceDir),
    '--require-readiness',
    '--require-send',
    '--require-visual-confirmation',
  ], 'Origens inconsistentes no pacote de evidencias')

  writeJson(visualPath, {
    ...visualConfirmation,
    origin: 'https://loja.example.com',
    confirmedAt: '2026-06-06T12:02:30.000Z',
  })
  expectRunNodeFailure('validate-web-push-evidence.js', [
    '--evidence-dir',
    relative(evidenceDir),
    '--require-readiness',
    '--require-send',
    '--require-visual-confirmation',
  ], 'Cronologia invalida no pacote de evidencias')
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const tempDir = fs.mkdtempSync(tempPrefix)

  try {
    const generatedEnv = validateGeneratedEnv(tempDir)
    validateFromEnv(tempDir, generatedEnv)
    validateMergeExisting(tempDir)
    validateHomologateOriginOverride(tempDir, generatedEnv)
    validateExternalReadinessFailure(generatedEnv)
    validateVisualConfirmationEvidence(tempDir)

    console.log('Web Push tooling validation OK.')
    console.log('- generated env: readiness OK')
    console.log('- vapid-from-env: keys preserved and readiness OK')
    console.log('- merge-existing: custom values preserved and readiness OK')
    console.log('- homologate origin override: readiness evidence OK')
    console.log('- invalid external readiness: clean expected failure OK')
    console.log('- visual confirmation evidence: validation/finalization/manifest verification/origin/target/chronology OK')

    if (options['keep-temp']) {
      console.log(`Temp files kept at: ${relative(tempDir)}`)
    }
  } finally {
    if (!options['keep-temp']) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }
}

try {
  main()
} catch (error) {
  console.error(`Web Push tooling validation failed: ${error.message}`)
  process.exitCode = 1
}
