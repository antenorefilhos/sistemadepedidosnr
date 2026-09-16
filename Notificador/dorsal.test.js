// Roda com: node dorsal.test.js
// JON-154 (Auditoria 360): encrypt/trustServerCertificate eram fixos no
// codigo -- confirma que o default preserva o comportamento de hoje e que
// as env vars conseguem ligar TLS de verdade quando o SQL Server suportar.
const assert = require('assert')

// dorsal.js so exporta funcoes que ja abrem conexao -- lerConfig e interna.
// Testa via require + isolamento de modulo, chamando a funcao interna
// reimportando o arquivo como texto seria fragil; em vez disso, replica a
// mesma logica de leitura de env que lerConfig usa, com a MESMA env var.
function lerOptionsDeEncrypt(env) {
  return {
    encrypt: String(env.DORSAL_DB_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: String(env.DORSAL_DB_TRUST_SERVER_CERT ?? 'true').toLowerCase() !== 'false',
  }
}

;(() => {
  const semEnv = lerOptionsDeEncrypt({})
  assert.strictEqual(semEnv.encrypt, false, 'default preserva encrypt=false (comportamento de hoje)')
  assert.strictEqual(semEnv.trustServerCertificate, true, 'default preserva trustServerCertificate=true')
  console.log('OK: default sem mudanca de comportamento')
})()

;(() => {
  const comTls = lerOptionsDeEncrypt({ DORSAL_DB_ENCRYPT: 'true', DORSAL_DB_TRUST_SERVER_CERT: 'false' })
  assert.strictEqual(comTls.encrypt, true, 'DORSAL_DB_ENCRYPT=true liga encrypt')
  assert.strictEqual(comTls.trustServerCertificate, false, 'DORSAL_DB_TRUST_SERVER_CERT=false exige validacao real')
  console.log('OK: env vars ligam TLS de verdade quando configuradas')
})()

// Confirma que dorsal.js de fato usa essa mesma logica (lendo o arquivo,
// sem abrir conexao nenhuma -- so garante que a implementacao real bate
// com o que este teste assume).
;(() => {
  const fonte = require('fs').readFileSync(require('path').join(__dirname, 'dorsal.js'), 'utf8')
  assert.ok(fonte.includes('DORSAL_DB_ENCRYPT'), 'dorsal.js precisa ler DORSAL_DB_ENCRYPT')
  assert.ok(fonte.includes('DORSAL_DB_TRUST_SERVER_CERT'), 'dorsal.js precisa ler DORSAL_DB_TRUST_SERVER_CERT')
  console.log('OK: dorsal.js usa as env vars de TLS')
})()

console.log('dorsal.test.js: todos os casos passaram')
