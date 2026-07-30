const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({ take: 30 })
  if (products.length === 0) {
    console.error('Sem produtos no banco. Rode o seed principal primeiro.')
    process.exit(1)
  }

  // Criar clientes variados
  const hashedPw = await bcrypt.hash('123456', 10)
  const customerData = [
    { name: 'Maria Oliveira', cpf: '98765432100', whatsapp: '11999887766', email: 'maria@example.com' },
    { name: 'Carlos Santos', cpf: '11223344556', whatsapp: '11988776655', email: 'carlos@example.com' },
    { name: 'Ana Paula Costa', cpf: '22334455667', whatsapp: '11977665544', email: 'ana@example.com' },
    { name: 'Roberto Ferreira', cpf: '33445566778', whatsapp: '11966554433', email: 'roberto@example.com' },
    { name: 'Lucia Mendes', cpf: '44556677889', whatsapp: '11955443322', email: 'lucia@example.com' },
  ]

  const customers = []
  for (const data of customerData) {
    const existing = await prisma.customer.findFirst({ where: { cpf: data.cpf } })
    if (existing) {
      customers.push(existing)
    } else {
      const c = await prisma.customer.create({ data: { ...data, password: hashedPw } })
      customers.push(c)
    }
  }

  // Também incluir o João que já existe
  const joao = await prisma.customer.findFirst({ where: { name: { contains: 'João' } } })
  if (joao) customers.push(joao)

  console.log(`${customers.length} clientes prontos`)

  // Definir pedidos variados
  const orderConfigs = [
    { customerIdx: 0, itemCount: 12, status: 'CONFIRMED', notes: 'Entregar no portao dos fundos' },
    { customerIdx: 1, itemCount: 3, status: 'CONFIRMED', notes: null },
    { customerIdx: 2, itemCount: 8, status: 'PENDING', notes: 'Ligar antes de entregar' },
    { customerIdx: 3, itemCount: 2, status: 'CONFIRMED', notes: null },
    { customerIdx: 4, itemCount: 15, status: 'CONFIRMED', notes: 'Pedido urgente - festa hoje' },
    { customerIdx: 0, itemCount: 5, status: 'PICKING_PENDING', notes: null },
    { customerIdx: 5, itemCount: 1, status: 'CONFIRMED', notes: null },
    { customerIdx: 2, itemCount: 6, status: 'PENDING', notes: 'Substituir por similar se nao tiver' },
    { customerIdx: 3, itemCount: 10, status: 'CONFIRMED', notes: 'Pedido do churrasco de sabado' },
    { customerIdx: 1, itemCount: 4, status: 'CONFIRMED', notes: null },
  ]

  for (let i = 0; i < orderConfigs.length; i++) {
    const cfg = orderConfigs[i]
    const customer = customers[cfg.customerIdx % customers.length]

    // Selecionar produtos aleatórios
    const shuffled = [...products].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(cfg.itemCount, products.length))

    const items = selected.map(p => {
      const qty = Math.ceil(Math.random() * 3)
      const unitPrice = p.price
      return {
        productId: p.id,
        quantity: qty,
        unitPrice,
        subtotal: Math.round(unitPrice * qty * 100) / 100,
        requestedQuantity: qty,
        status: 'PENDING',
      }
    })

    const subtotal = items.reduce((s, i) => s + i.subtotal, 0)
    const delivery = Math.random() > 0.3 ? Math.round((5 + Math.random() * 10) * 100) / 100 : 0
    const total = Math.round((subtotal + delivery) * 100) / 100

    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        status: cfg.status,
        subtotal,
        delivery,
        total,
        notes: cfg.notes,
        paymentMethod: ['CASH', 'PIX', 'CREDIT_CARD', 'DEBIT_CARD'][Math.floor(Math.random() * 4)],
        items: { create: items },
      },
    })

    console.log(`Pedido #${order.id.slice(-6)} | ${customer.name} | ${items.length} itens | R$ ${total.toFixed(2)} | ${cfg.status}`)
  }

  console.log('\nPedidos de teste criados com sucesso!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
