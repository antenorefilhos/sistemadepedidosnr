const path = require('path')

const rootDir = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {
    subject: 'mailto:admin@antenor.com.br',
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

function requireFromBackend(packageName) {
  return require(path.join(rootDir, 'backend', 'node_modules', packageName))
}

function validateSubject(subject) {
  const value = String(subject || '').trim()
  if (!value.startsWith('mailto:') && !value.startsWith('https://')) {
    throw new Error('--subject deve começar com mailto: ou https://.')
  }
  return value
}

function printEnv(keys, subject, { staging = false } = {}) {
  const prefix = staging ? 'STAGING_' : ''
  console.log(`# Web Push VAPID (${staging ? 'staging' : 'default'})`)
  console.log(`${prefix}VAPID_PUBLIC_KEY=${keys.publicKey}`)
  console.log(`${prefix}VAPID_PRIVATE_KEY=${keys.privateKey}`)
  console.log(`${prefix}VAPID_SUBJECT=${subject}`)
  if (!staging) {
    console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`)
  }
}

function printPowerShell(keys, subject, { staging = false } = {}) {
  const prefix = staging ? 'STAGING_' : ''
  console.log(`# Web Push VAPID (${staging ? 'staging' : 'default'})`)
  console.log(`$env:${prefix}VAPID_PUBLIC_KEY="${keys.publicKey}"`)
  console.log(`$env:${prefix}VAPID_PRIVATE_KEY="${keys.privateKey}"`)
  console.log(`$env:${prefix}VAPID_SUBJECT="${subject}"`)
  if (!staging) {
    console.log(`$env:VITE_VAPID_PUBLIC_KEY=$env:${prefix}VAPID_PUBLIC_KEY`)
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const subject = validateSubject(options.subject)
  const webpush = requireFromBackend('web-push')
  const keys = webpush.generateVAPIDKeys()
  const staging = Boolean(options.staging)

  if (options.json) {
    console.log(JSON.stringify({ ...keys, subject, staging }, null, 2))
    return
  }

  if (options.env) {
    printEnv(keys, subject, { staging })
    return
  }

  printPowerShell(keys, subject, { staging })
}

try {
  main()
} catch (error) {
  console.error(`Web Push VAPID generation failed: ${error.message}`)
  process.exitCode = 1
}
