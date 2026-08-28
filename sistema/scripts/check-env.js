#!/usr/bin/env node
/**
 * Compara .env.example, .env e docker-compose.yml e aponta onde os tres
 * discordam.
 *
 * Existe por causa de uma familia de bugs que ja custou caro neste projeto:
 * variavel documentada, configuravel, e mesmo assim sem efeito nenhum em
 * producao -- sem erro, sem log, sem teste vermelho.
 *
 * Dois modos de falha reais, os dois achados em 28/08/2026:
 *
 * 1. Variavel no .env.example que nunca entrou no .env da VPS. A `RESEND_API_KEY`
 *    ficou assim: o EmailService virava no-op e a recuperacao de senha de admin
 *    e cliente passou meses sem enviar nada.
 *
 * 2. Variavel que o docker-compose.yml nao repassa. Nao ha `env_file` no
 *    servico api -- so o que esta listado em `environment:` chega no container.
 *    `PROMOTIONS_SYNC_CRON_ENABLED` estava assim: da pra colocar no .env, o
 *    .env.example documenta, e ligar o sync de promocoes era impossivel.
 *
 * Uso:
 *   node scripts/check-env.js              # compara com o .env local
 *   node scripts/check-env.js --env-only   # so o que falta no .env (pra rodar na VPS)
 *
 * Sai com codigo 1 se achar divergencia, pra poder virar passo de deploy.
 */
const fs = require('fs')
const path = require('path')

const base = path.resolve(__dirname, '..')
const read = (f) => {
  try {
    return fs.readFileSync(path.join(base, f), 'utf-8')
  } catch {
    return null
  }
}

/** Chaves de um arquivo .env, ignorando comentario e linha vazia. */
const envKeys = (raw) =>
  new Set(
    (raw || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split('=')[0].trim())
      .filter(Boolean),
  )

/**
 * Variaveis que o docker-compose.yml realmente consome, de qualquer forma:
 * repassadas a um servico (`CHAVE: ${VAR}`), interpoladas dentro de outro valor
 * (a DATABASE_URL monta a senha assim) ou usadas como build arg.
 *
 * A regra e "aparece como ${VAR} em algum lugar do arquivo", nao "esta no bloco
 * do servico api". Olhar so a api daria falso positivo em massa: VITE_* vai pro
 * storefront/admin e POSTGRES_PASSWORD vai pro db -- nenhuma delas e' erro.
 * O que interessa e o oposto: variavel que o compose ignora por completo, e que
 * portanto nao chega em container nenhum por mais que esteja no .env.
 */
const composeKeys = (raw) => {
  const keys = new Set()
  if (!raw) return keys
  // Interpolada: `CHAVE: ${VAR:-default}`, ou embutida num valor maior como a
  // DATABASE_URL, que monta a senha no meio da connection string.
  for (const m of raw.matchAll(/\$\{([A-Z0-9_]+)[\s:}-]/g)) keys.add(m[1])
  // Definida com valor literal: `NODE_ENV: production`. Chega no container do
  // mesmo jeito -- so nao da pra mudar pelo .env, o que e' outra conversa.
  for (const m of raw.matchAll(/^ {6}([A-Z][A-Z0-9_]+):/gm)) keys.add(m[1])
  return keys
}

const exampleRaw = read('.env.example')
if (!exampleRaw) {
  console.error('nao achei sistema/.env.example')
  process.exit(2)
}

const envOnly = process.argv.includes('--env-only')
const example = envKeys(exampleRaw)
const actual = envKeys(read('.env'))
const compose = composeKeys(read('docker-compose.yml'))
const hasEnv = read('.env') !== null

const problems = []

// Documentada mas o compose nao entrega: configurar nao adianta.
if (!envOnly) {
  const naoRepassadas = [...example].filter((k) => !compose.has(k))
  if (naoRepassadas.length) {
    problems.push({
      titulo: 'No .env.example mas o compose NAO repassa pro container (configurar nao tem efeito)',
      itens: naoRepassadas,
    })
  }
}

// Documentada e repassada, mas sem valor no ambiente: cai no default do compose.
if (hasEnv) {
  const faltando = [...example].filter((k) => !actual.has(k) && (envOnly || compose.has(k)))
  if (faltando.length) {
    problems.push({
      titulo: 'No .env.example mas ausente no .env (usa o default do compose, que pode divergir do documentado)',
      itens: faltando,
    })
  }
} else {
  console.log('(sem .env aqui -- comparando so example x compose)\n')
}

// Repassada mas nao documentada: quem monta ambiente novo nao sabe que existe.
if (!envOnly) {
  const naoDocumentadas = [...compose].filter((k) => !example.has(k))
  if (naoDocumentadas.length) {
    problems.push({
      titulo: 'O compose repassa mas o .env.example nao documenta (invisivel pra quem monta ambiente)',
      itens: naoDocumentadas,
    })
  }
}

if (!problems.length) {
  console.log('ok: .env.example, .env e docker-compose.yml estao coerentes.')
  process.exit(0)
}

for (const p of problems) {
  console.log(`\n${p.titulo}:`)
  for (const k of p.itens.sort()) console.log(`  - ${k}`)
}
console.log(`\n${problems.reduce((n, p) => n + p.itens.length, 0)} divergencia(s).`)
process.exit(1)
