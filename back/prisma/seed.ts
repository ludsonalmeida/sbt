import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Admin user
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'sobradinho123', 10)
  await prisma.user.upsert({
    where: { email: 'admin@sobradinhotem.com' },
    update: {},
    create: {
      name: 'Admin SBT',
      email: 'admin@sobradinhotem.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      bairro: 'Sobradinho I',
      onboardingDone: true,
      preferences: {
        gastronomia: 0.8,
        natureza: 0.6,
        cultura: 0.5,
        esporte: 0.4,
        familia: 0.7,
        festa: 0.3,
        compras: 0.4,
        trilha: 0.5,
      },
    },
  })

  // Test user
  const userPassword = await bcrypt.hash('123456', 10)
  await prisma.user.upsert({
    where: { email: 'ludson.bsa@gmail.com' },
    update: {},
    create: {
      name: 'Ludson',
      email: 'ludson.bsa@gmail.com',
      passwordHash: userPassword,
      role: 'USER',
      bairro: 'farofa',
      onboardingDone: true,
      preferences: {
        gastronomia: 0.9,
        festa: 0.7,
        esporte: 0.5,
      },
    },
  })

  console.log('Seed completed!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
