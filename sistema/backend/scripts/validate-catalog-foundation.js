const { Client } = require('pg')

async function scalar(client, sql) {
  const result = await client.query(sql)
  return Number(result.rows[0]?.count || 0)
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required')
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const products = await scalar(client, 'SELECT COUNT(*)::int AS count FROM "products"')
  const mastersFromLegacy = await scalar(client, 'SELECT COUNT(*)::int AS count FROM "product_masters" WHERE "legacyProductId" IS NOT NULL')
  const weightedMissingRules = await scalar(client, 'SELECT COUNT(*)::int AS count FROM "product_masters" WHERE "isWeighted" = true AND (COALESCE("minWeight", 0) <= 0 OR COALESCE("weightStep", 0) <= 0)')
  const categories = await scalar(client, 'SELECT COUNT(*)::int AS count FROM "categories_cms"')
  const categoryNodes = await scalar(client, 'SELECT COUNT(*)::int AS count FROM "category_nodes" WHERE "legacyCategoryId" IS NOT NULL')

  await client.end()

  const failures = []
  if (mastersFromLegacy < products) failures.push(`product_masters_from_legacy=${mastersFromLegacy}/${products}`)
  if (weightedMissingRules > 0) failures.push(`weighted_missing_rules=${weightedMissingRules}`)
  if (categoryNodes < categories) failures.push(`category_nodes_from_legacy=${categoryNodes}/${categories}`)

  if (failures.length > 0) {
    console.error(`catalog foundation invalid: ${failures.join(', ')}`)
    process.exit(1)
  }

  console.log('catalog foundation valid')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
