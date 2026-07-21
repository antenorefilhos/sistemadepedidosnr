import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()
type SeedProduct = {
  ean: string
  name: string
  alternativeDescription: string
  price: number
  category: string
  stock: number
  unit: string
  badges?: string
  storefrontCategoryName: string
}

async function main() {
  console.log('🌱 Iniciando seed data (Ripley UI/UX edition)...')

  const productData: SeedProduct[] = [
    // CONSUMO_RAPIDO
    { ean: '78910001', name: 'Pizza Congelada Sadia 4 Queijos', alternativeDescription: 'Pizza rápida e saborosa para qualquer hora', price: 22.90, category: 'CONSUMO_RAPIDO', stock: 50, unit: 'un', storefrontCategoryName: 'Congelados' },
    { ean: '78910002', name: 'Lasanha à Bolonhesa Seara 600g', alternativeDescription: 'Pronta em 15 minutos no microondas', price: 18.50, category: 'CONSUMO_RAPIDO', stock: 40, unit: 'un', storefrontCategoryName: 'Congelados' },
    { ean: '78910003', name: 'Hambúrguer Bovino Texas 120g', alternativeDescription: 'Carne suculenta e tempero especial', price: 12.00, category: 'CONSUMO_RAPIDO', stock: 100, unit: 'un', storefrontCategoryName: 'Congelados' },
    { ean: '78910004', name: 'Batata Frita McCain 400g', alternativeDescription: 'Mais crocante, ideal para airfryer', price: 15.90, category: 'CONSUMO_RAPIDO', stock: 60, unit: 'un', storefrontCategoryName: 'Congelados' },
    { ean: '78910005', name: 'Empadão de Frango com Requeijão', alternativeDescription: 'Receita caseira da padaria Antenor', price: 35.00, category: 'CONSUMO_RAPIDO', stock: 15, unit: 'un', storefrontCategoryName: 'Congelados' },

    // GULOSEIMAS
    { ean: '78910006', name: 'Bala Fini Dentaduras 100g', alternativeDescription: 'O clássico preferido de todos', price: 6.50, category: 'GULOSEIMAS', stock: 200, unit: 'un', badges: 'Mais Vendido', storefrontCategoryName: 'Chocolates, Balas e Snacks' },
    { ean: '78910007', name: 'Bala Fini Tubes Morango 80g', alternativeDescription: 'Crocante por fora, macio por dentro', price: 5.90, category: 'GULOSEIMAS', stock: 150, unit: 'un', storefrontCategoryName: 'Chocolates, Balas e Snacks' },
    { ean: '78910008', name: 'Barra de Chocolate Milka Oreo 100g', alternativeDescription: 'Chocolate alpino com o dobro de recheio', price: 14.90, category: 'GULOSEIMAS', stock: 80, unit: 'un', badges: 'Importado', storefrontCategoryName: 'Chocolates, Balas e Snacks' },
    { ean: '78910009', name: 'Biscoito Doritos Queijo Nacho 140g', alternativeDescription: 'Para quem gosta de sabor intenso', price: 12.50, category: 'GULOSEIMAS', stock: 120, unit: 'un', storefrontCategoryName: 'Chocolates, Balas e Snacks' },
    { ean: '78910010', name: 'Batata Pringles Original 114g', alternativeDescription: 'Tudo fica melhor com Pringles', price: 16.00, category: 'GULOSEIMAS', stock: 90, unit: 'un', storefrontCategoryName: 'Chocolates, Balas e Snacks' },
    { ean: '78910011', name: 'Nutella Cream 350g', alternativeDescription: 'O melhor creme de avelã do mundo', price: 29.90, category: 'GULOSEIMAS', stock: 45, unit: 'un', storefrontCategoryName: 'Chocolates, Balas e Snacks' },
    { ean: '78910012', name: 'Biscoito Oreo Original 90g', alternativeDescription: 'Abra, lamba e mergulhe', price: 4.50, category: 'GULOSEIMAS', stock: 300, unit: 'un', storefrontCategoryName: 'Chocolates, Balas e Snacks' },

    // BEBIDAS
    { ean: '78910013', name: 'Coca-Cola Lata 350ml', alternativeDescription: 'Sabor original, o Refresco perfeito', price: 5.50, category: 'BEBIDAS', stock: 500, unit: 'un', storefrontCategoryName: 'Bebidas sem Álcool' },
    { ean: '78910014', name: 'Cerveja Heineken Long Neck', alternativeDescription: 'Puro malte, qualidade premium holandesa', price: 7.90, category: 'BEBIDAS', stock: 240, unit: 'un', storefrontCategoryName: 'Cervejas' },
    { ean: '78910015', name: 'Cerveja Stella Artois 330ml', alternativeDescription: 'Cerveja lager premium finamente lupulada', price: 6.90, category: 'BEBIDAS', stock: 180, unit: 'un', storefrontCategoryName: 'Cervejas' },

    // VINHOS
    { ean: '78910016', name: 'Vinho Tinto Cabernet Sauvignon Casillero del Diablo', alternativeDescription: 'Notas de café e baunilha, corpo robusto', price: 65.00, category: 'VINHOS', stock: 30, unit: 'un', badges: 'Luxo', storefrontCategoryName: 'Adega' },
    { ean: '78910017', name: 'Vinho Argentino Malbec Angelica Zapata', alternativeDescription: 'Um dos vinhos mais prestigiados da Argentina', price: 350.00, category: 'VINHOS', stock: 12, unit: 'un', badges: 'Premium', storefrontCategoryName: 'Adega' },
    { ean: '78910018', name: 'Vinho Chileno Carménère Marques de Casa Concha', alternativeDescription: 'Elegância e especiarias em cada gota', price: 180.00, category: 'VINHOS', stock: 20, unit: 'un', badges: 'Exclusivo', storefrontCategoryName: 'Adega' },
    { ean: '78910019', name: 'Vinho Branco Sauvignon Blanc Errazuriz', alternativeDescription: 'Fresco, vibrante e intensamente aromático', price: 120.00, category: 'VINHOS', stock: 25, unit: 'un', storefrontCategoryName: 'Adega' },
    { ean: '78910020', name: 'Vinho Rosé Piscine 750ml', alternativeDescription: 'Perfeito para servir com gelo. Sofisticação e refrescor', price: 145.00, category: 'VINHOS', stock: 35, unit: 'un', storefrontCategoryName: 'Adega' },

    // CHURRASCO
    { ean: '78910023', name: 'Picanha Bovina Argentina (kg)', alternativeDescription: 'Corte premium com capa de gordura perfeita', price: 129.90, category: 'CHURRASCO', stock: 20, unit: 'kg', badges: 'Especialidade', storefrontCategoryName: 'Churrasco' },
    { ean: '78910024', name: 'Contra-Filé Grill (kg)', alternativeDescription: 'Ideal para grelha ou chapa, maciez garantida', price: 89.90, category: 'CHURRASCO', stock: 25, unit: 'kg', storefrontCategoryName: 'Churrasco' },
    { ean: '78910025', name: 'Pão de Alho Recheado Nobre', alternativeDescription: 'O acompanhamento que não pode faltar', price: 14.50, category: 'CHURRASCO', stock: 60, unit: 'un', storefrontCategoryName: 'Churrasco' },
    { ean: '78910026', name: 'Linguiça Toscada Artesanal (kg)', alternativeDescription: 'Temperada com ervas finas', price: 32.00, category: 'CHURRASCO', stock: 40, unit: 'kg', storefrontCategoryName: 'Churrasco' },

    // CARNES_DIA_A_DIA
    { ean: '78910027', name: 'Patinho Bovino Moído (kg)', alternativeDescription: 'Carne magra de primeira, fresca todo dia', price: 42.90, category: 'CARNES_DIA_A_DIA', stock: 30, unit: 'kg', storefrontCategoryName: 'Carnes' },
    { ean: '78910028', name: 'Filé de Frango Swift 1kg', alternativeDescription: 'Congelamento rápido, mais suculência', price: 24.90, category: 'CARNES_DIA_A_DIA', stock: 100, unit: 'un', storefrontCategoryName: 'Carnes' },
    { ean: '78910029', name: 'Acém em Cubos (kg)', alternativeDescription: 'Perfeito para cozidos e ensopados', price: 34.00, category: 'CARNES_DIA_A_DIA', stock: 45, unit: 'kg', storefrontCategoryName: 'Carnes' },

    // GENERICS PARA COMPLETAR
    { ean: '78910021', name: 'Pão Francês Tradicional', alternativeDescription: 'Assado agora, quentinho e crocante', price: 0.90, category: 'PADARIA', stock: 1000, unit: 'un', storefrontCategoryName: 'Padaria' },
    { ean: '78910022', name: 'Leite Integral Parmalat 1L', alternativeDescription: 'Fonte de cálcio para toda a família', price: 5.90, category: 'GERAL', stock: 120, unit: 'un', storefrontCategoryName: 'Leites, Iogurtes e Cremosos' },
  ]

  // Limpar dados existentes
  console.log('🗑️  Limpando dados existentes...')
  await prisma.auditLog.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.address.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.product.deleteMany()
  await prisma.productCategoryMapping.deleteMany({
    where: {
      ean: { in: productData.map((product) => product.ean) },
      source: 'seed',
    },
  })
  await prisma.pushSubscription.deleteMany()
  await prisma.admin.deleteMany()

  // Criar admin
  const adminPassword = await bcrypt.hash('admin2026', 10)
  await prisma.admin.create({
    data: {
      email: 'admin@antenor.com.br',
      password: adminPassword,
      name: 'Administrador Antenor',
    },
  })

  // Criar clientes
  const hashedPassword = await bcrypt.hash('123456', 10)
  const customers = await Promise.all([
    prisma.customer.create({
      data: { name: 'João da Silva', cpf: '12345678900', whatsapp: '11987654321', email: 'joao@example.com', password: hashedPassword },
    }),
  ])

  for (const data of productData) {
    const { storefrontCategoryName: _storefrontCategoryName, ...product } = data
    await prisma.product.create({ data: product })
  }

  const categories = await prisma.category.findMany({
    where: {
      active: true,
      name: { in: Array.from(new Set(productData.map((product) => product.storefrontCategoryName))) },
    },
    select: { id: true, name: true },
  })

  const categoryByName = new Map(categories.map((category) => [category.name, category.id]))
  const missingCategories = Array.from(new Set(productData.map((product) => product.storefrontCategoryName))).filter(
    (name) => !categoryByName.has(name),
  )

  if (missingCategories.length > 0) {
    console.warn(`Categorias CMS ausentes para mapeamento seed: ${missingCategories.join(', ')}`)
  }

  for (const data of productData) {
    const categoryId = categoryByName.get(data.storefrontCategoryName)
    if (!categoryId) continue

    await prisma.productCategoryMapping.upsert({
      where: { ean: data.ean },
      update: {
        categoryId,
        subCategoryId: null,
        source: 'seed',
        priority: 10,
      },
      create: {
        ean: data.ean,
        categoryId,
        subCategoryId: null,
        source: 'seed',
        priority: 10,
      },
    })
  }

  console.log('✅ Seed finalizado com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
