import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await bcrypt.hash('admin2026', 10)
  const customerPassword = await bcrypt.hash('qa2026', 10)

  const admin = await prisma.admin.upsert({
    where: { email: 'qa.admin@antenor.com.br' },
    update: {
      password: adminPassword,
      name: 'QA Admin',
      active: true,
    },
    create: {
      email: 'qa.admin@antenor.com.br',
      password: adminPassword,
      name: 'QA Admin',
      active: true,
    },
  })

  const customer = await prisma.customer.upsert({
    where: { cpf: '90000000001' },
    update: {
      name: 'Cliente QA',
      whatsapp: '24900000001',
      email: 'qa.cliente@antenor.com.br',
      password: customerPassword,
      origin: 'qa-seed',
    },
    create: {
      name: 'Cliente QA',
      cpf: '90000000001',
      whatsapp: '24900000001',
      email: 'qa.cliente@antenor.com.br',
      password: customerPassword,
      origin: 'qa-seed',
    },
  })

  const qaProducts = [
    {
      ean: 'QA-M20-0001',
      name: 'Produto QA M20 Principal',
      alternativeDescription: 'Produto idempotente para smoke tests de release',
      price: 9.99,
      stock: 200,
    },
    {
      ean: 'QA-M20-0002',
      name: 'Produto QA M20 Substituto',
      alternativeDescription: 'Produto substituto idempotente para fluxos criticos',
      price: 11.99,
      stock: 200,
    },
  ]

  const products = []

  for (const item of qaProducts) {
    const product = await prisma.product.upsert({
      where: { ean: item.ean },
      update: {
        name: item.name,
        alternativeDescription: item.alternativeDescription,
        price: item.price,
        stock: item.stock,
        unit: 'un',
        category: 'QA',
        active: true,
      },
      create: {
        ean: item.ean,
        name: item.name,
        alternativeDescription: item.alternativeDescription,
        price: item.price,
        stock: item.stock,
        unit: 'un',
        category: 'QA',
        origin: 'qa-seed',
        active: true,
      },
    })

    await prisma.stockPosition.upsert({
      where: {
        tenantId_storeId_productId: {
          tenantId: product.tenantId,
          storeId: product.storeId,
          productId: product.id,
        },
      },
      update: {
        onHand: item.stock,
        reserved: 0,
        available: item.stock,
        safetyStock: 0,
        source: 'QA_SEED',
      },
      create: {
        tenantId: product.tenantId,
        storeId: product.storeId,
        productId: product.id,
        onHand: item.stock,
        reserved: 0,
        available: item.stock,
        safetyStock: 0,
        source: 'QA_SEED',
      },
    })

    products.push(product.ean)
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        admin: admin.email,
        customer: customer.email,
        products,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
