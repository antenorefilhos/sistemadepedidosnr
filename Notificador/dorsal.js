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
 *
 * ARMADILHA (achada em 07/09/2026, ao rodar contra o banco real pela primeira
 * vez): `inCancelado` é `bit`, mas o ERP **nunca grava 0** — são 1.929 linhas
 * `NULL` e 144 com `1`, nenhuma com zero. Escrito como `inCancelado = 0`, o
 * filtro nunca casava nada, porque `NULL = 0` é desconhecido em SQL, não
 * falso. O agente teria rodado a cada minuto, achado zero pedidos, não
 * registrado erro nenhum, e o pedido ficaria preso em READY_FOR_CHECKOUT para
 * sempre -- com toda a aparência de funcionar. Por isso `ISNULL(...)`.
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
        AND ISNULL(inCancelado, 0) = 0
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

/**
 * Detecta se o IDENTITY de `nrSeqPAF` (o DAV) descarrilou.
 *
 * `nrSeqPAF` é coluna IDENTITY nativa do SQL Server. `IDENTITY_INSERT ON`
 * usado em teste -- mesmo dentro de transacao com ROLLBACK -- empurra o
 * ponteiro interno pra frente e NUNCA volta sozinho (achado em 08/09/2026,
 * duas vezes no mesmo dia). O sintoma so aparece pro lojista quando o
 * proximo pedido nasce com DAV de 7 digitos, tarde demais.
 *
 * Compara o IDENT_CURRENT com o maior nrSeqPAF real (abaixo do teto de
 * 900000 que separa pedido de verdade de fixture de teste) e alerta se a
 * diferenca for grande -- alertar aqui, uma vez por minuto de operacao
 * normal, e infinitamente mais barato que descobrir no caixa com cliente
 * esperando.
 */
async function verificarSaudeIdentity(config = lerConfig()) {
  const pool = await sql.connect(config)
  try {
    const { recordset } = await pool.request().query(`
      SELECT
        IDENT_CURRENT('tbPedido') AS identCurrent,
        (SELECT MAX(TRY_CAST(nrSeqPAF AS BIGINT)) FROM tbPedido WHERE TRY_CAST(nrSeqPAF AS BIGINT) < 900000) AS ultimoDavReal
    `)
    const { identCurrent, ultimoDavReal } = recordset[0]
    const diferenca = Number(identCurrent) - Number(ultimoDavReal || 0)

    // Margem de 50: cobre pedidos concorrentes no exato instante da checagem
    // sem disparar alarme por coisa normal.
    if (diferenca > 50) {
      return { saudavel: false, identCurrent: Number(identCurrent), ultimoDavReal: Number(ultimoDavReal), diferenca }
    }
    return { saudavel: true, identCurrent: Number(identCurrent), ultimoDavReal: Number(ultimoDavReal), diferenca }
  } finally {
    await pool.close().catch(() => {})
  }
}

module.exports = { consultarFaturados, verificarSaudeIdentity, lerConfig }
