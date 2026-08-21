import { PrismaClient } from '@prisma/client'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as readline from 'readline'

const prisma = new PrismaClient()

const IBGE_ZIP_URL =
  'https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/Censo_Demografico_2022/Arquivos_CNEFE/CSV/Municipio/33_RJ/3303906_PETROPOLIS.zip'
const CSV_NAME = '3303906_PETROPOLIS.csv'
const BATCH_SIZE = 2000

// Indices do CSV oficial do CNEFE (';'-separado) -- ver cabecalho do
// arquivo. Nao muda entre municipios, e o mesmo layout nacional.
const COL = {
  codUnico: 0,
  cep: 8,
  bairro: 9,
  tipoLogradouro: 10,
  tituloLogradouro: 11,
  nomeLogradouro: 12,
  numero: 13,
  modificador: 14, // 'SN' = sem numero
  latitude: 25,
  longitude: 26,
}

async function downloadAndExtract(workDir: string): Promise<string> {
  const zipPath = path.join(workDir, 'petropolis.zip')
  console.log(`Baixando ${IBGE_ZIP_URL}...`)
  const res = await fetch(IBGE_ZIP_URL)
  if (!res.ok) throw new Error(`Download falhou: HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(zipPath, buffer)
  console.log(`Baixado (${(buffer.length / 1024 / 1024).toFixed(2)} MB). Extraindo...`)

  execFileSync('unzip', ['-o', zipPath, '-d', workDir], { stdio: 'inherit' })
  const csvPath = path.join(workDir, CSV_NAME)
  if (!fs.existsSync(csvPath)) throw new Error(`CSV nao encontrado apos extrair: ${csvPath}`)
  return csvPath
}

function parseRow(line: string) {
  const cols = line.split(';')
  if (cols.length < 27) return null

  const codUnico = cols[COL.codUnico]?.trim()
  const cep = cols[COL.cep]?.trim()
  const lat = Number(cols[COL.latitude])
  const lng = Number(cols[COL.longitude])
  if (!codUnico || !cep || !Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const tipo = cols[COL.tipoLogradouro]?.trim() || ''
  const titulo = cols[COL.tituloLogradouro]?.trim() || ''
  const nome = cols[COL.nomeLogradouro]?.trim() || ''
  const logradouro = [tipo, titulo, nome].filter(Boolean).join(' ')

  const numeroRaw = cols[COL.numero]?.trim() || ''
  const semNumero = cols[COL.modificador]?.trim() === 'SN' || numeroRaw === '0'
  const numero = semNumero ? null : numeroRaw || null

  return {
    codUnico,
    bairro: cols[COL.bairro]?.trim() || '',
    tipoLogradouro: tipo,
    nomeLogradouro: nome,
    logradouro,
    numero,
    cep,
    latitude: lat,
    longitude: lng,
  }
}

async function main() {
  const localCsvArg = process.argv[2]
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ibge-cnefe-'))
  const csvPath = localCsvArg && fs.existsSync(localCsvArg) ? localCsvArg : await downloadAndExtract(workDir)

  const rl = readline.createInterface({ input: fs.createReadStream(csvPath, { encoding: 'utf-8' }), crlfDelay: Infinity })

  let batch: ReturnType<typeof parseRow>[] = []
  let total = 0
  let skipped = 0
  let isHeader = true

  const flush = async () => {
    if (!batch.length) return
    const result = await prisma.ibgeAddress.createMany({ data: batch as any, skipDuplicates: true })
    total += result.count
    batch = []
  }

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false
      continue
    }
    if (!line.trim()) continue

    const row = parseRow(line)
    if (!row) {
      skipped++
      continue
    }
    batch.push(row)
    if (batch.length >= BATCH_SIZE) await flush()
  }
  await flush()

  if (!localCsvArg) fs.rmSync(workDir, { recursive: true, force: true })

  console.log(`Importacao concluida: ${total} enderecos gravados, ${skipped} linha(s) ignorada(s) (sem CEP/coordenada valida).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
