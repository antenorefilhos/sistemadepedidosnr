/**
 * Leitura do banco DORSAL (SQL Server da loja) para descobrir o que o PDV já
 * faturou.
 *
 * Só existe aqui, no PC da loja, porque a VPS **não tem rota** para
 * `10.13.0.2` — é limitação de rede, não escolha de arquitetura.
 *
 * SOMENTE LEITURA. Escrever na base deles foi avaliado e descartado em
 * 29/08/2026: o PDV puxa o pedido pelo DAV e fecha normalmente sem que a gente
 * toque em nada (ver docs/solidcom-api.md). Se um dia alguém precisar
 * escrever, essa decisão tem que ser retomada do zero — não amplie este
 * arquivo por conveniência.
 */
const sql = require('mssql')

/**
 * Config do SQL Server. Sem default para host/usuário/senha de propósito: um
 * agente que "quase" conecta (host errado, silenciosamente) é pior que um que
 * recusa subir, porque ninguém percebe que o faturamento parou de fluir.
 */
function lerConfig(env = process.env) {
  const faltando = ['DORSAL_DB_HOST', 'DORSAL_DB_NAME', 'DORSAL_DB_USER', 'DORSAL_DB_PASSWORD'].filter(
    (chave) => !String(env[chave] || '').trim(),
  )
  if (faltando.length > 0) {
    throw new Error(`Configure no .env: ${faltando.join(', ')}`)
  }

  return {
    server: env.DORSAL_DB_HOST,
    port: Number(env.DORSAL_DB_PORT || 1433),
    database: env.DORSAL_DB_NAME,
    user: env.DORSAL_DB_USER,
    password: env.DORSAL_DB_PASSWORD,
    options: {
      // SQL Server antigo, sem certificado válido — é rede interna da loja.
      encrypt: false,
      trustServerCertificate: true,
    },
    // O ciclo do agente é de 60s: uma consulta que demora mais que isso está
    // travada, e insistir só empilha conexão no servidor deles.
    connectionTimeout: 10000,
    requestTimeout: 15000,
    pool: { max: 2, min: 0, idleTimeoutMillis: 30000 },
  }
}

/**
 * Quais destes DAVs já foram faturados no PDV.
 *
 * `hrRegistro` é o sinal — preenchido em 386/386 dos pedidos fechados e em
 * nenhum não-fechado. O `EcommerceSolidconStatus` NÃO serve: a transição
 * `5 → 6` pertence à esteira do app coletor deles, que a gente pula, então
 * pedido nosso fica em `1` para sempre mesmo faturado.
 *
 * `nrSeqPAF` é o DAV (confirmado contra o cupom fiscal `DAV0000000102013`).
 * Não confunda com `cdPedidoCarga`, que já foi falso positivo aqui duas vezes.
 */
async function consultarFaturados(davs, config = lerConfig()) {
  if (!davs || davs.length === 0) return []

  const pool = await sql.connect(config)
  try {
    const request = pool.request()
    const parametros = davs.map((dav, indice) => {
      request.input(`dav${indice}`, sql.BigInt, Number(dav))
      return `@dav${indice}`
    })

    const { recordset } = await request.query(`
      SELECT nrSeqPAF AS dav, hrRegistro, COO AS coo, nrCupom
      FROM tbPedido
      WHERE nrSeqPAF IN (${parametros.join(', ')})
        AND hrRegistro IS NOT NULL
        AND inCancelado = 0
    `)

    return recordset.map((linha) => ({
      dav: String(linha.dav),
      hrRegistro: linha.hrRegistro instanceof Date ? linha.hrRegistro.toISOString() : String(linha.hrRegistro),
      coo: linha.coo == null ? undefined : Number(linha.coo),
      nrCupom: linha.nrCupom == null ? undefined : Number(linha.nrCupom),
    }))
  } finally {
    // Fecha sempre: o agente roda o dia inteiro no PC da loja e conexão
    // vazada contra o servidor do ERP é problema que aparece só depois de
    // horas, quando ninguém liga mais o defeito à causa.
    await pool.close().catch(() => {})
  }
}

module.exports = { consultarFaturados, lerConfig }
