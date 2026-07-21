const fs = require('fs')
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function validateEvidence(evidenceDir, requireReadiness, requireSend, requireVisualConfirmation) {
  const args = [
    path.join('scripts', 'validate-web-push-evidence.js'),
    '--evidence-dir',
    relative(evidenceDir),
  ]
  if (requireReadiness) args.push('--require-readiness')
  if (requireSend) args.push('--require-send')
  if (requireVisualConfirmation) args.push('--require-visual-confirmation')

  const result = spawnSync(process.execPath, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`Pacote de evidencias invalido.${details ? `\n${details}` : ''}`)
  }

  return result.stdout.trim()
}

function statusLine(ok) {
  return ok ? 'OK' : 'PENDENTE'
}

function targetSummary(targets = []) {
  const counts = new Map()
  for (const target of targets) {
    const status = String(target.status || 'unknown')
    counts.set(status, (counts.get(status) || 0) + 1)
  }
  return [...counts.entries()].map(([key, value]) => `${key}=${value}`).join(', ') || 'sem alvos'
}

function buildReport({
  evidenceDir,
  readiness,
  inspect,
  dryRun,
  send,
  visualConfirmation,
  requireReadiness,
  requireSend,
  requireVisualConfirmation,
  validationOutput,
}) {
  const readinessRequired = Boolean(requireReadiness)
  const sendRequired = Boolean(requireSend)
  const visualRequired = Boolean(requireVisualConfirmation)
  const sendPresent = Boolean(send)
  const visualPresent = Boolean(visualConfirmation)
  const generatedAt = new Date().toISOString()
  const validationFlags = [
    readinessRequired ? '--require-readiness' : null,
    sendRequired ? '--require-send' : null,
    visualRequired ? '--require-visual-confirmation' : null,
  ].filter(Boolean)
  const validationCommand = `validate:web-push-evidence${validationFlags.length ? ` -- ${validationFlags.join(' ')}` : ''}`
  const lines = [
    '# Relatorio de Homologacao Web Push',
    '',
    `Gerado em: ${generatedAt}`,
    `Pasta de evidencias: \`${relative(evidenceDir)}\``,
    `Envio real exigido: ${sendRequired ? 'sim' : 'nao'}`,
    '',
    '## Resultado',
    '',
    readiness
      ? `- Preflight: ${statusLine(readiness.result?.ok === true)} (origin=${readiness.origin || ''}, external=${Boolean(readiness.modes?.external)}, live=${Boolean(readiness.modes?.live)})`
      : '- Preflight: nao registrado neste pacote',
    `- Inspecao: ${statusLine(inspect.result.ready)} (total=${inspect.result.total}, complete=${inspect.result.complete}, incomplete=${inspect.result.incomplete})`,
    `- Dry-run: ${statusLine(Number(dryRun.result.dryRunTargets) >= 1 && Number(dryRun.result.failed) === 0)} (targets=${dryRun.result.dryRunTargets}, failed=${dryRun.result.failed})`,
    sendPresent
      ? `- Envio real: ${statusLine(Number(send.result.sent) >= 1 && Number(send.result.failed) === 0)} (sent=${send.result.sent}, failed=${send.result.failed})`
      : '- Envio real: nao executado neste pacote',
    visualPresent
      ? `- Confirmacao visual: OK (${visualConfirmation.confirmedBy}, ${visualConfirmation.device}, ${visualConfirmation.browser})`
      : '- Confirmacao visual: nao registrada neste pacote',
    '',
    '## Alvos',
    '',
    `- Dry-run: ${targetSummary(dryRun.targets)}`,
    sendPresent ? `- Envio real: ${targetSummary(send.targets)}` : '- Envio real: sem arquivo `web-push-send.json`',
    '',
    '## Payload',
    '',
    `- Titulo: ${dryRun.payload?.title || ''}`,
    `- Corpo: ${dryRun.payload?.body || ''}`,
    `- URL: ${dryRun.payload?.url || ''}`,
    `- Icone: ${dryRun.payload?.icon || ''}`,
    '',
    '## Preflight',
    '',
    readiness ? `- Origem: ${readiness.origin || ''}` : '- Origem: pendente',
    `- Origem da inspecao: ${inspect.origin || 'nao registrada'}`,
    readiness ? `- Modo externo: ${Boolean(readiness.modes?.external) ? 'sim' : 'nao'}` : '- Modo externo: pendente',
    readiness ? `- Checagem live: ${Boolean(readiness.modes?.live) ? 'sim' : 'nao'}` : '- Checagem live: pendente',
    readiness ? `- Warnings: ${readiness.result?.warnings || 0}` : '- Warnings: pendente',
    readiness ? `- Live checks: ${(readiness.liveChecks || []).map((item) => `${item.label} ${item.status || 'erro'}`).join(', ') || 'nao executado'}` : '- Live checks: pendente',
    '',
    '## Confirmacao Visual',
    '',
    visualPresent ? `- Confirmado por: ${visualConfirmation.confirmedBy}` : '- Confirmado por: pendente',
    visualPresent ? `- Dispositivo: ${visualConfirmation.device}` : '- Dispositivo: pendente',
    visualPresent ? `- Navegador/PWA: ${visualConfirmation.browser}` : '- Navegador/PWA: pendente',
    visualPresent ? `- Origem: ${visualConfirmation.origin || ''}` : '- Origem: pendente',
    visualPresent ? `- Observacao: ${visualConfirmation.note || ''}` : '- Observacao: pendente',
    visualPresent && visualConfirmation.screenshot ? `- Screenshot: \`${visualConfirmation.screenshot}\`` : '- Screenshot: nao informado',
    '',
    '## Cronologia',
    '',
    readiness ? `- Preflight: ${readiness.generatedAt || 'nao registrado'}` : '- Preflight: pendente',
    `- Inspecao: ${inspect.generatedAt || 'nao registrado'}`,
    `- Dry-run: ${dryRun.generatedAt || 'nao registrado'}`,
    sendPresent ? `- Envio real: ${send.generatedAt || 'nao registrado'}` : '- Envio real: nao executado',
    visualPresent ? `- Confirmacao visual: ${visualConfirmation.confirmedAt || visualConfirmation.generatedAt || 'nao registrado'}` : '- Confirmacao visual: pendente',
    '',
    '## Evidencias',
    '',
    readiness ? `- \`${relative(path.join(evidenceDir, 'web-push-readiness.json'))}\`` : '- `web-push-readiness.json` ausente porque o preflight nao foi gravado no pacote',
    `- \`${relative(path.join(evidenceDir, 'web-push-inspect.json'))}\``,
    `- \`${relative(path.join(evidenceDir, 'web-push-dry-run.json'))}\``,
    sendPresent ? `- \`${relative(path.join(evidenceDir, 'web-push-send.json'))}\`` : '- `web-push-send.json` ausente porque o envio real nao foi exigido/executado',
    visualPresent
      ? `- \`${relative(path.join(evidenceDir, 'web-push-visual-confirmation.json'))}\``
      : '- `web-push-visual-confirmation.json` ausente porque a confirmacao visual ainda nao foi registrada',
    '',
    '## Validacao',
    '',
    '```text',
    validationOutput,
    '```',
    '',
    '## Criterio de Aceite',
    '',
    `- [x] Pacote de evidencias validado por \`${validationCommand}\`.`,
    readinessRequired ? '- [x] Preflight externo/live registrado no pacote de evidencias.' : '- [ ] Preflight ainda nao foi exigido neste pacote.',
    `- [x] Inspecao encontrou subscription completa.`,
    `- [x] Dry-run encontrou alvo e falhou zero.`,
    sendRequired ? '- [x] Envio real confirmou `sent>=1 failed=0`.' : '- [ ] Envio real ainda nao foi exigido neste pacote.',
    visualRequired ? '- [x] Recebimento visual confirmado no navegador/dispositivo real.' : '- [ ] Recebimento visual ainda nao foi exigido neste pacote.',
    '',
  ]

  return lines.join('\n')
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const evidenceDir = resolveInsideRoot('--evidence-dir', options['evidence-dir'])
  const requireReadiness = Boolean(options['require-readiness'])
  const requireSend = Boolean(options['require-send'])
  const requireVisualConfirmation = Boolean(options['require-visual-confirmation'])
  const output = resolveInsideRoot(
    '--output',
    options.output || path.join(relative(evidenceDir), 'web-push-homologation-report.md'),
  )

  const validationOutput = validateEvidence(evidenceDir, requireReadiness, requireSend, requireVisualConfirmation)
  const readinessPath = path.join(evidenceDir, 'web-push-readiness.json')
  const readiness = fs.existsSync(readinessPath) ? readJson(readinessPath) : null
  const inspect = readJson(path.join(evidenceDir, 'web-push-inspect.json'))
  const dryRun = readJson(path.join(evidenceDir, 'web-push-dry-run.json'))
  const sendPath = path.join(evidenceDir, 'web-push-send.json')
  const send = fs.existsSync(sendPath) ? readJson(sendPath) : null
  const visualConfirmationPath = path.join(evidenceDir, 'web-push-visual-confirmation.json')
  const visualConfirmation = fs.existsSync(visualConfirmationPath) ? readJson(visualConfirmationPath) : null

  const report = buildReport({
    evidenceDir,
    readiness,
    inspect,
    dryRun,
    send,
    visualConfirmation,
    requireReadiness,
    requireSend,
    requireVisualConfirmation,
    validationOutput,
  })
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, report, 'utf8')

  console.log(`Web Push homologation report written: ${relative(output)}`)
}

try {
  main()
} catch (error) {
  console.error(`Web Push homologation report failed: ${error.message}`)
  process.exitCode = 1
}
