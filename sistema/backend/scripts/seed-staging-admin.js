const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const { randomUUID } = require('crypto')

async function main() {
  const p = new PrismaClient()
  const hash = await bcrypt.hash('admin2026', 10)
  try {
    await p.admin.upsert({
      where: { email: 'admin@antenor.com.br' },
      update: {
        name: 'Administrador Antenor',
        password: hash,
        active: true,
      },
      create: {
        id: randomUUID(),
        email: 'admin@antenor.com.br',
        name: 'Administrador Antenor',
        password: hash,
        active: true,
      },
    })
    console.log('Admin staging sincronizado: admin@antenor.com.br / admin2026')
  } catch (e) {
    console.log('Erro ao sincronizar admin staging:', e.message)
  } finally {
    await p.$disconnect()
  }
}

main()
