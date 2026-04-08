// Pré-popula a tabela Place com lugares de Sobradinho-DF por categoria.
// Roda o Apify Google Maps uma vez por categoria e faz upsert por googlePlaceId.
//
// Uso:
//   tsx scripts/seed-places.ts                  # todas as categorias
//   tsx scripts/seed-places.ts bares mercados   # só essas
//
// Requer APIFY_TOKEN e DATABASE_URL no env.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ACTOR = 'compass~crawler-google-places'

const SOBRADINHO_LAT = -15.6522
const SOBRADINHO_LNG = -47.7900
const SOBRADINHO_ZOOM = 14

interface CategoryDef {
  key: string        // valor salvo em Place.category (slug)
  emoji: string
  queries: string[]  // termos de busca pro Apify
  perQuery: number   // quantos lugares por query
}

const CATEGORIES: CategoryDef[] = [
  { key: 'restaurantes', emoji: '🍽️',  queries: ['restaurantes em Sobradinho DF'], perQuery: 50 },
  { key: 'bares',        emoji: '🍻',  queries: ['bares em Sobradinho DF', 'pubs em Sobradinho DF'], perQuery: 35 },
  { key: 'barbearias',   emoji: '💈',  queries: ['barbearias em Sobradinho DF'], perQuery: 30 },
  { key: 'lojas',        emoji: '🛍️',  queries: ['lojas em Sobradinho DF', 'roupas em Sobradinho DF'], perQuery: 35 },
  { key: 'mercados',     emoji: '🏪',  queries: ['supermercados em Sobradinho DF', 'mercados em Sobradinho DF'], perQuery: 30 },
  { key: 'academias',    emoji: '💪',  queries: ['academias em Sobradinho DF'], perQuery: 30 },
  { key: 'saude',        emoji: '🏥',  queries: ['clínicas em Sobradinho DF', 'farmácias em Sobradinho DF'], perQuery: 25 },
  { key: 'servicos',     emoji: '🛠️',  queries: ['serviços em Sobradinho DF', 'oficinas em Sobradinho DF'], perQuery: 25 },
]

const SOBRADINHO_RADIUS_KM = 12

function isInSobradinho(address?: string, lat?: number, lng?: number): boolean {
  if (lat !== undefined && lng !== undefined) {
    const dlat = lat - SOBRADINHO_LAT
    const dlng = lng - SOBRADINHO_LNG
    const dist = Math.sqrt(dlat * dlat + dlng * dlng) * 111
    if (dist <= SOBRADINHO_RADIUS_KM) return true
  }
  if (address && address.toLowerCase().includes('sobradinho')) return true
  return false
}

async function runApify(queries: string[], perQuery: number): Promise<any[]> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN não configurado')

  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items` +
    `?token=${token}&timeout=300&memory=2048`

  const input = {
    searchStringsArray: queries,
    maxCrawledPlacesPerSearch: perQuery,
    maxReviews: 3,
    maxImages: 1,
    language: 'pt-BR',
    countryCode: 'br',
    lat: SOBRADINHO_LAT,
    lng: SOBRADINHO_LNG,
    zoom: SOBRADINHO_ZOOM,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Apify ${res.status}: ${err.slice(0, 300)}`)
  }

  return (await res.json()) as any[]
}

function getTodayHours(openingHours?: { day: string; hours: string }[]): string | undefined {
  if (!openingHours?.length) return undefined
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const today = days[new Date().getDay()]
  const map: Record<string,string> = { sunday:'sunday', domingo:'sunday', monday:'monday', segunda:'monday', tuesday:'tuesday', 'terça':'tuesday', wednesday:'wednesday', quarta:'wednesday', thursday:'thursday', quinta:'thursday', friday:'friday', sexta:'friday', saturday:'saturday', 'sábado':'saturday' }
  const entry = openingHours.find(h => map[h.day?.toLowerCase()] === today)
  return entry?.hours
}

async function seedCategory(cat: CategoryDef) {
  console.log(`\n━━━ ${cat.emoji} ${cat.key} ━━━`)
  console.log(`queries: ${cat.queries.join(' | ')}`)

  const items = await runApify(cat.queries, cat.perQuery)
  console.log(`Apify retornou ${items.length} resultados brutos`)

  const seen = new Set<string>()
  let upserted = 0
  let skipped = 0

  for (const it of items) {
    if (it.permanentlyClosed) { skipped++; continue }
    if (!isInSobradinho(it.address, it.location?.lat, it.location?.lng)) { skipped++; continue }

    const placeId = it.placeId ?? it.fid ?? it.cid
    if (!placeId) { skipped++; continue }
    if (seen.has(placeId)) { skipped++; continue }
    seen.add(placeId)

    const enrichment = {
      photo: it.imageUrl ?? it.imageUrls?.[0] ?? null,
      photos: it.imageUrls?.slice(0, 5) ?? [],
      phone: it.phone ?? null,
      website: it.website ?? null,
      description: it.description ?? null,
      price: it.price ?? null,
      hoursToday: getTodayHours(it.openingHours),
      openingHours: it.openingHours ?? [],
      categoryName: it.categoryName ?? it.categories?.[0] ?? null,
      categories: it.categories ?? [],
      mapsUrl: it.url ?? null,
      topReviews: (it.reviews ?? [])
        .filter((r: any) => r.text?.trim() && (r.stars ?? 5) >= 4)
        .slice(0, 3)
        .map((r: any) => ({ text: r.text.slice(0, 220), rating: r.stars ?? 5, date: r.publishAt ?? r.relativeDate ?? '' })),
      lastEnrichedAt: new Date().toISOString(),
    }

    await prisma.place.upsert({
      where: { googlePlaceId: placeId },
      update: {
        name: it.title ?? 'Sem nome',
        category: cat.key,
        googleRating: it.totalScore ?? null,
        googleTotal: it.reviewsCount ?? null,
        address: it.address ?? null,
        lat: it.location?.lat ?? null,
        lng: it.location?.lng ?? null,
        emoji: cat.emoji,
        enrichment,
      },
      create: {
        name: it.title ?? 'Sem nome',
        category: cat.key,
        googlePlaceId: placeId,
        googleRating: it.totalScore ?? null,
        googleTotal: it.reviewsCount ?? null,
        address: it.address ?? null,
        lat: it.location?.lat ?? null,
        lng: it.location?.lng ?? null,
        emoji: cat.emoji,
        enrichment,
      },
    })
    upserted++
  }

  console.log(`✅ ${upserted} upserted, ${skipped} ignorados`)
}

async function main() {
  const filter = process.argv.slice(2)
  const targets = filter.length ? CATEGORIES.filter(c => filter.includes(c.key)) : CATEGORIES

  if (!targets.length) {
    console.error('Nenhuma categoria válida. Disponíveis:', CATEGORIES.map(c => c.key).join(', '))
    process.exit(1)
  }

  console.log(`Seed iniciando — ${targets.length} categoria(s)`)
  for (const cat of targets) {
    try {
      await seedCategory(cat)
    } catch (e: any) {
      console.error(`❌ ${cat.key}: ${e.message}`)
    }
  }

  const total = await prisma.place.count()
  console.log(`\n━━━ Total no banco: ${total} lugares ━━━`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
