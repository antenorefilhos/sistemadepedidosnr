const axios = require('axios')

const API_URL = process.env.API_URL || 'http://localhost:3001'
const SAMPLE_SIZE = Number(process.env.PENDING_SAMPLE_SIZE || 20)

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function ensure(condition, message) {
  if (!condition) fail(message)
}

async function main() {
  const pendingUrl = `${API_URL}/api/categories/pending/list?limit=${SAMPLE_SIZE}&offset=0`
  const statsUrl = `${API_URL}/api/categories/stats/mapping`

  const [pendingRes, statsRes] = await Promise.all([
    axios.get(pendingUrl, { timeout: 15000 }),
    axios.get(statsUrl, { timeout: 15000 }),
  ])

  const pendingPayload = pendingRes.data
  const statsPayload = statsRes.data

  ensure(pendingPayload && pendingPayload.success === true, 'pending/list retornou payload invalido')
  ensure(Array.isArray(pendingPayload.data), 'pending/list nao retornou data[]')
  ensure(pendingPayload.pagination && Number.isInteger(pendingPayload.pagination.total), 'pending/list sem pagination.total')

  for (const item of pendingPayload.data) {
    ensure(typeof item.id === 'string' && item.id.length > 0, 'item sem id')
    ensure(typeof item.ean === 'string' && item.ean.length > 0, `item ${item.id} sem ean`)
    ensure(typeof item.productName === 'string' && item.productName.length > 0, `item ${item.id} sem productName`)
    ensure(typeof item.reason === 'string' && item.reason.length > 0, `item ${item.id} sem reason`)
    ensure(Object.prototype.hasOwnProperty.call(item, 'notes'), `item ${item.id} sem campo notes`)
  }

  ensure(statsPayload && statsPayload.success === true, 'stats/mapping retornou payload invalido')
  const stats = statsPayload.data || {}
  ensure(Number.isInteger(stats.mapped), 'stats.mapped invalido')
  ensure(Number.isInteger(stats.pending), 'stats.pending invalido')
  ensure(Number.isInteger(stats.total), 'stats.total invalido')
  ensure(Number.isInteger(stats.unmapped), 'stats.unmapped invalido')
  ensure(stats.unmapped >= 0, 'stats.unmapped negativo')

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiUrl: API_URL,
        sampleChecked: pendingPayload.data.length,
        pendingTotal: pendingPayload.pagination.total,
        stats,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  const message = error?.response?.data
    ? JSON.stringify(error.response.data)
    : error?.message || String(error)
  fail(message)
})
