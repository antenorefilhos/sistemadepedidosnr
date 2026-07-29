const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const { randomUUID } = require('crypto')

async function main() {
  const p = new PrismaClient()
  // Senha vem do ambiente: hardcoded aqui ela vaza no repositorio.
  if (!process.env.ADMIN_PASSWORD) {
    throw new Error('Defina ADMIN_PASSWORD no .env antes de sincronizar o admin.')
  }
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
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
    console.log('Admin staging sincronizado: admin@antenor.com.br (senha do ADMIN_PASSWORD)')
  } catch (e) {
    console.log('Erro ao sincronizar admin staging:', e.message)
  } finally {
    await p.$disconnect()
  }
}

main()
