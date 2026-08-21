import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface RateEntry {
  sentido: string
  codigo: string
  localidade: string
  taxa: number
  minutos: number | null
  km: number | null
  cep: string | null
  cepFormatado: string | null
  referencia: string | null
}

const TENANT_ID = process.env.SEED_TENANT_ID || 'tenant_default'
const STORE_ID = process.env.SEED_STORE_ID || 'store_default'

// "PEDRO DO RIO (ATE O VIADUTO)" na planilha de balcao (codigo 4201,
// cep 25750225, taxa 15) -- e o ponto que a propria tabela ja chama de
// "Pedro do Rio", usa a taxa dele como base em vez de inventar um numero.
const BASE_ZONE_NAME = 'Pedro do Rio (base)'
const BASE_ZONE_FEE = 15
// Cobre toda a faixa de CEP que aparece na planilha (25700000-25849999) --
// fecha o gap de nao existir NENHUM CEP_RANGE de fallback pra regiao (so o
// poligono Chafariz), documentado em CLAUDE.md.
const BASE_ZONE_CEP_START = '25700000'
const BASE_ZONE_CEP_END = '25849999'

async function main() {
  // __dirname nao e confiavel aqui -- o node -e/require via ts-node em
  // producao carrega este arquivo por um caminho ESM-interop onde __dirname
  // fica vazio/relativo. process.cwd() e o WORKDIR do container (/app),
  // estavel tanto local (raiz de sistema/backend) quanto em producao.
  const dataPath = path.join(process.cwd(), 'src/modules/delivery/data/delivery-rates-balcao.json')
  const entries: RateEntry[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  const withCep = entries.filter((e) => e.cep)
  const withoutCep = entries.filter((e) => !e.cep)
  if (withoutCep.length) {
    console.warn(
      `Ignorando ${withoutCep.length} ponto(s) sem CEP na planilha (CEP_RANGE nao da pra representar): ` +
        withoutCep.map((e) => e.localidade).join(', '),
    )
  }

  // CEP_RANGE so distingue por CEP, nao por endereco -- varios pontos da
  // planilha compartilham o mesmo CEP com taxas diferentes (ex.: 25750222
  // tem CHAFARIZ a R$6 e COND. BOSQUE DAS MANGUEIRAS a R$22). Agrupa por CEP
  // e usa a MAIOR taxa do grupo: nao arrisca cobrar barato um ponto mais
  // longe que so compartilha o CEP com um mais perto.
  const byCep = new Map<string, RateEntry[]>()
  for (const entry of withCep) {
    const list = byCep.get(entry.cep!) || []
    list.push(entry)
    byCep.set(entry.cep!, list)
  }

  const zones: { name: string; cep: string; fee: number }[] = []
  for (const [cep, group] of byCep) {
    const uniqueTaxas = [...new Set(group.map((e) => e.taxa))]
    if (uniqueTaxas.length > 1) {
      console.warn(
        `CEP ${cep} tem taxas diferentes entre pontos que o compartilham (${uniqueTaxas.join(', ')}): ` +
          `${group.map((e) => `${e.localidade}=R$${e.taxa}`).join(' | ')} -- usando a maior (R$${Math.max(...uniqueTaxas)}) por seguranca.`,
      )
    }
    const fee = Math.max(...group.map((e) => e.taxa))
    // Nome da zona = so a localidade principal do CEP (primeira da planilha),
    // nao a concatenacao de todas as que compartilham o CEP -- isso e o que
    // gerava os nomes gigantes tipo "CHAFARIZ / 7 CASAS / COND. BOSQUE DAS
    // MANGUEIRAS / ...". A selecao fina por localidade continua vindo do
    // JSON de balcao (resolveBalcaoLocality), essa zona e so o fallback de
    // taxa no admin/CEP_RANGE.
    zones.push({ name: group[0].localidade, cep, fee })
  }

  console.log(`Preparando ${zones.length} zona(s) especifica(s) por CEP + 1 zona base de fallback (Pedro do Rio).`)

  await prisma.$transaction(async (tx) => {
    // Idempotente: reroda sem duplicar. So mexe em CEP_RANGE, nunca no
    // poligono Chafariz (GEO_POLYGON), que continua tendo prioridade
    // espacial quando ha lat/lng (ver DeliveryService.calculateLegacyZone).
    const deleted = await tx.deliveryZone.deleteMany({
      where: { tenantId: TENANT_ID, storeId: STORE_ID, type: 'CEP_RANGE' },
    })
    if (deleted.count) console.log(`Removidas ${deleted.count} zona(s) CEP_RANGE existente(s) antes de reinserir.`)

    await tx.deliveryZone.create({
      data: {
        tenantId: TENANT_ID,
        storeId: STORE_ID,
        name: BASE_ZONE_NAME,
        type: 'CEP_RANGE',
        cepStart: BASE_ZONE_CEP_START,
        cepEnd: BASE_ZONE_CEP_END,
        fee: BASE_ZONE_FEE,
        priority: 1,
        active: true,
      },
    })

    for (const zone of zones) {
      await tx.deliveryZone.create({
        data: {
          tenantId: TENANT_ID,
          storeId: STORE_ID,
          name: zone.name,
          type: 'CEP_RANGE',
          cepStart: zone.cep,
          cepEnd: zone.cep,
          fee: zone.fee,
          priority: 10,
          active: true,
        },
      })
    }
  })

  console.log('Seed de zonas de entrega (taxas de balcao) concluido.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
