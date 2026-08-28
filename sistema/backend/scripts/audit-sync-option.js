// Audita (e opcionalmente corrige) o syncOption do banco contra o
// `tipoIntegracao` do Solidcom.
//
// Por que existe: `tipoIntegracao` (SEMPRE/NUNCA/ESTOQUE -- a coluna "Internet"
// no cadastro do Solidcom) so vem no GetProdutos, endpoint do sync completo.
// O GetProdutosAlterados (incremental) e o GetProdutosEAN nao mandam o campo.
// Ate 28/08/2026 ausente virava ESTOQUE e o incremental rebaixava o valor a
// cada hora -- produto marcado SEMPRE com estoque negativo (item de peso e
// producao propria) sumia da vitrine. Corrigido em 87c2e44; este script serve
// pra conferir que nao voltou a divergir.
//
// ATENCAO: a busca le do indice MeiliSearch, nao do banco. Depois de corrigir,
// reindexe (POST /products/admin/reindex-search) ou o produto volta na
// navegacao por categoria mas continua sumido na busca.
//
// Uso:
//   node scripts/audit-sync-option.js            # so relatorio
//   node scripts/audit-sync-option.js --aplicar  # grava a correcao
const axios = require('axios')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const url = process.env.SOLIDCOM_API_URL || process.env.ERP_API_URL || 'http://45.239.193.56:5000'
const APLICAR = process.argv.includes('--aplicar')

;(async () => {
  const r = await axios.get(`${url}/api/Produto/GetProdutos?ativo=true`, { timeout: 280000 })
  const erp = new Map()
  for (const x of r.data) {
    if (x.tipoIntegracao) erp.set(String(x.codigo_ean), String(x.tipoIntegracao).toUpperCase().trim())
  }
  const db = await prisma.product.findMany({ select: { id: true, ean: true, name: true, syncOption: true, stock: true, active: true } })

  const alvos = []
  for (const d of db) {
    const e = erp.get(d.ean)
    if (!e || e === d.syncOption) continue
    if (!['SEMPRE', 'NUNCA', 'ESTOQUE'].includes(e)) continue
    alvos.push({ ...d, novo: e, voltaPraVitrine: d.active && d.syncOption !== 'SEMPRE' && (d.stock || 0) <= 0 && e === 'SEMPRE' })
  }

  console.log(`divergentes: ${alvos.length} | voltam pra vitrine: ${alvos.filter(a => a.voltaPraVitrine).length}`)
  if (!APLICAR) { console.log('(simulacao -- rode com --aplicar pra gravar)'); await prisma.$disconnect(); return }

  let n = 0
  for (const a of alvos) {
    await prisma.product.update({ where: { id: a.id }, data: { syncOption: a.novo } })
    n++
  }
  console.log(`${n} produto(s) corrigido(s).`)
  await prisma.$disconnect()
})().catch((e) => { console.log('ERRO', e.message); process.exit(1) })
