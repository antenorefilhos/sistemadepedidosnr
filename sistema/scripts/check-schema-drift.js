#!/usr/bin/env node
/**
 * Aponta divergencia entre o `schema.prisma` e o banco que esta rodando.
 *
 * Existe porque `prisma migrate deploy` NAO detecta isso: ele compara quais
 * arquivos de migration ja foram aplicados, nunca o schema com o banco. Model
 * editado sem migration passa batido em todo deploy, e o log diz "All
 * migrations have been successfully applied" -- verdadeiro e irrelevante.
 *
 * Foi assim que `drivers.adminId` ficou meses ausente em producao. O app do
 * entregador estava 100% quebrado: todo endpoint /driver consulta essa coluna,
 * e o Prisma estourava em runtime logo apos o login. Ninguem tinha como
 * descobrir sem rodar o diff a mao.
 *
 * Por que um wrapper e nao so o comando cru: o diff sempre lista ~21
 * divergencias benignas (nomes de indice truncados pelo Prisma, DEFAULTs que o
 * banco tem a mais). Quem roda o comando cru aprende a ignorar a saida inteira
 * -- e e exatamente no meio desse ruido que o problema real se esconde. Este
 * script filtra o benigno e so fala quando ha algo que importa.
 *
 * Uso (de dentro do container da API, que tem o prisma e o DATABASE_URL):
 *   docker exec antenor_api node /app/../scripts/check-schema-drift.js
 * ou, mais simples, do host:
 *   node sistema/scripts/check-schema-drift.js --container antenor_api
 *
 * Sai com codigo 1 quando acha divergencia funcional, pra virar passo de deploy.
 */
const { execFileSync } = require('child_process')

/**
 * Padroes que o diff sempre reporta e que NAO sao problema. Cada um com o
 * motivo -- sem o motivo, a proxima pessoa nao sabe se pode confiar na lista.
 */
const BENIGNOS = [
  {
    // O Prisma trunca nome de indice em 63 chars com regra propria; o banco
    // guardou a versao truncada pelo Postgres. Mesmo indice, nome diferente.
    re: /^ALTER INDEX .* RENAME TO /,
    motivo: 'renomeacao de indice (truncagem de nome)',
  },
  {
    // O banco tem DEFAULT em updatedAt que o schema nao declara. E mais seguro
    // do que o schema pede: o Prisma ja preenche em codigo, e o default protege
    // escrita feita fora dele.
    re: /^ALTER TABLE "\w+" ALTER COLUMN "updatedAt" DROP DEFAULT;/,
    motivo: 'DEFAULT extra em updatedAt (banco mais seguro que o schema)',
  },
  {
    // A aplicacao sempre envia slot; o default so valeria pra insert manual.
    re: /^ALTER TABLE "store_banners_cms" ALTER COLUMN "slot" SET DEFAULT/,
    motivo: 'default de slot que a aplicacao sempre preenche',
  },
]

const containerArg = process.argv.indexOf('--container')
const container = containerArg > -1 ? process.argv[containerArg + 1] : null

const comando = [
  'npx', 'prisma', 'migrate', 'diff',
  '--from-schema-datasource', 'prisma/schema.prisma',
  '--to-schema-datamodel', 'prisma/schema.prisma',
  '--script',
]

let saida
try {
  saida = container
    ? execFileSync('docker', ['exec', container, ...comando], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
    : execFileSync(comando[0], comando.slice(1), { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
} catch (erro) {
  console.error('nao consegui rodar o prisma migrate diff:', erro.message)
  process.exit(2)
}

const linhas = saida
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('--') && !l.startsWith('│') && !l.startsWith('┌') && !l.startsWith('└'))

const ignoradas = []
const problemas = []
for (const linha of linhas) {
  const benigno = BENIGNOS.find((b) => b.re.test(linha))
  if (benigno) ignoradas.push({ linha, motivo: benigno.motivo })
  else problemas.push(linha)
}

if (problemas.length === 0) {
  console.log(`ok: schema.prisma e o banco batem (${ignoradas.length} divergencia(s) benigna(s) ignorada(s)).`)
  process.exit(0)
}

console.log('DIVERGENCIA entre o schema.prisma e o banco:\n')
for (const p of problemas) console.log('  ' + p)
console.log(`\n${problemas.length} divergencia(s) funcional(is). ${ignoradas.length} benigna(s) ignorada(s).`)
console.log('\nCada uma precisa virar migration escrita a mao (ver CLAUDE.md) ou,')
console.log('quando o banco e que esta certo, virar declaracao no schema.prisma.')
process.exit(1)
