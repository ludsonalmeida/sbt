// Reaplica filtro de categoria nos Places já salvos, sem chamar Apify.
// Deleta lugares cujo nome ou categoryName bate em termos deny da categoria.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Palavras inteiras — usadas com regex word-boundary pra evitar substrings
// (ex: "bar" casando "Barbara" ou "barbearia")
const DENY_BY_CATEGORY: Record<string, string[]> = {
  restaurantes: ['academia','salão','salao','beleza','igreja','escola','oficina','barbearia','estética','estetica'],
  bares:        ['academia','beleza','barbearia','farmácia','farmacia','supermercado','salão','salao','estética','estetica','manicure','pedicure','cabeleireiro','igreja','escola','espaço de beleza','espaco de beleza'],
  barbearias:   ['salão','salao','estética','estetica','manicure','restaurante','academia','farmácia','farmacia'],
  lojas:        ['restaurante','academia','farmácia','farmacia','supermercado','mercado','igreja','escola','oficina','barbearia','pizzaria'],
  mercados:     ['restaurante','academia','farmácia','farmacia','igreja','escola','barbearia'],
  academias:    ['restaurante','farmácia','farmacia','salão','salao','beleza','barbearia'],
  saude:        ['restaurante','academia','mercado','supermercado','barbearia'],
  servicos:     ['restaurante','academia','farmácia','farmacia','supermercado','barbearia'],
}

function matchesAny(pool: string, terms: string[]): boolean {
  return terms.some(t => {
    // se tem espaço, match por substring (já é único)
    if (t.includes(' ')) return pool.includes(t)
    // senão, word boundary (\b não lida com acentos no JS, usamos lookaround)
    const re = new RegExp(`(^|[^a-zà-ú])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zà-ú]|$)`, 'i')
    return re.test(pool)
  })
}

async function main() {
  const all = await prisma.place.findMany()
  let toDelete: string[] = []

  for (const p of all) {
    const deny = DENY_BY_CATEGORY[p.category] ?? []
    const name = (p.name ?? '').toLowerCase()
    const catName = ((p.enrichment as any)?.categoryName ?? '').toLowerCase()
    const pool = `${name} ${catName}`
    if (matchesAny(pool, deny)) {
      toDelete.push(p.id)
      console.log(`🗑️  [${p.category}] ${p.name} | ${catName}`)
    }
  }

  console.log(`\nDeletando ${toDelete.length} lugares ruidosos...`)
  if (toDelete.length) {
    const r = await prisma.place.deleteMany({ where: { id: { in: toDelete } } })
    console.log(`deleted: ${r.count}`)
  }

  const total = await prisma.place.count()
  console.log(`Total restante: ${total}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
