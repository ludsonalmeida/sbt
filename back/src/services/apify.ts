// ── Apify / Google Maps enrichment ───────────────────
// Actor: compass/crawler-google-places
// Traz: rating, reviews, foto, horários, telefone, website

const ACTOR = 'compass~crawler-google-places'

export interface EnrichedPlace {
  nome: string
  rating?: number
  reviewCount?: number
  photo?: string
  address?: string
  phone?: string
  website?: string
  description?: string
  price?: string
  hoursToday?: string
  openNow?: boolean
  permanentlyClosed?: boolean
  temporarilyClosed?: boolean
  topReviews?: { text: string; rating: number; date: string }[]
  mapsUrl?: string
  lat?: number
  lng?: number
}

// ── Helpers ───────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  sunday: 0, domingo: 0,
  monday: 1, segunda: 1, 'segunda-feira': 1,
  tuesday: 2, 'terça': 2, 'terça-feira': 2, terca: 2, 'terca-feira': 2,
  wednesday: 3, quarta: 3, 'quarta-feira': 3,
  thursday: 4, quinta: 4, 'quinta-feira': 4,
  friday: 5, sexta: 5, 'sexta-feira': 5,
  saturday: 6, 'sábado': 6, sabado: 6,
}

function getTodayHours(openingHours?: { day: string; hours: string }[]): string | undefined {
  if (!openingHours?.length) return undefined
  const todayIdx = new Date().getDay()
  const entry = openingHours.find(h => DAY_MAP[h.day?.toLowerCase()] === todayIdx)
  return entry?.hours
}

// ── Main enrichment function ──────────────────────────

export async function enrichPlaces(
  places: { nome: string; cidade?: string }[]
): Promise<Record<string, EnrichedPlace>> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN não configurado')

  const searchStrings = places.map(p => `${p.nome} ${p.cidade ?? 'Sobradinho DF'}`)

  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items` +
    `?token=${token}&timeout=90&memory=512`

  const input = {
    searchStringsArray: searchStrings,
    maxCrawledPlacesPerSearch: 1,
    maxReviews: 3,
    maxImages: 1,
    language: 'pt-BR',
    countryCode: 'br',
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Apify error ${res.status}: ${err}`)
  }

  const items: any[] = await res.json()
  const result: Record<string, EnrichedPlace> = {}

  for (let i = 0; i < places.length; i++) {
    const search = searchStrings[i]
    // Apify retorna searchString em cada item
    const item = items.find(it => it.searchString === search) ?? items[i]
    if (!item) continue

    const todayHours = getTodayHours(item.openingHours)

    // Skip permanently closed places entirely
    if (item.permanentlyClosed) {
      console.log(`[enrich] Skipping "${places[i].nome}" — permanently closed`)
      continue
    }

    result[places[i].nome] = {
      nome: item.title ?? places[i].nome,
      rating: item.totalScore,
      reviewCount: item.reviewsCount,
      photo: item.imageUrl ?? item.imageUrls?.[0],
      address: item.address,
      phone: item.phone,
      website: item.website,
      description: item.description,
      price: item.price,
      hoursToday: todayHours,
      openNow: item.temporarilyClosed ? false : undefined,
      permanentlyClosed: !!item.permanentlyClosed,
      temporarilyClosed: !!item.temporarilyClosed,
      topReviews: item.reviews
        ?.filter((r: any) => r.text?.trim())
        .slice(0, 2)
        .map((r: any) => ({
          text: r.text.slice(0, 220),
          rating: r.stars ?? 5,
          date: r.publishAt ?? r.relativeDate ?? '',
        })) ?? [],
      mapsUrl: item.url,
      lat: item.location?.lat,
      lng: item.location?.lng,
    }
  }

  return result
}
