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
  // Sinaliza que o nome real no Google é diferente do nome buscado
  // (estabelecimento pode ter mudado de nome ou fechado)
  nameMismatch?: boolean
  realName?: string
  mostRecentReview?: string  // data ISO da review mais recente
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

// Extrai a data mais recente dos reviews para comparar qual lugar está mais ativo
function getMostRecentReviewDate(reviews?: any[]): string | undefined {
  if (!reviews?.length) return undefined
  const dates = reviews
    .map((r: any) => r.publishAt ?? r.publishedAtDate ?? '')
    .filter(Boolean)
    .sort()
    .reverse()
  return dates[0] ?? undefined
}

// Stopwords PT que não carregam significado no nome do lugar
const STOPWORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'os', 'as', 'em', 'no', 'na', 'nos', 'nas', 'bar', 'restaurante'])

// Normaliza nome: remove acentos, pontuação, case
function normalizeName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

// Extrai palavras significativas (sem stopwords) pra comparação real
function significantWords(s: string): string[] {
  return normalizeName(s).split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w))
}

// Retorna true se os nomes são claramente o mesmo lugar.
// Lógica: se compartilham ao menos 1 palavra significativa → mesmo lugar.
// Só retorna false quando não há NENHUMA palavra em comum (entidade completamente diferente).
function isSameName(a: string, b: string): boolean {
  const wa = significantWords(a)
  const wb = significantWords(b)
  if (!wa.length || !wb.length) return false
  return wa.some(w => wb.includes(w))
}

// Escolhe o melhor resultado entre candidatos no mesmo endereço:
// prefere o que tem review mais recente (= estabelecimento ativo agora)
function pickBestCandidate(candidates: any[]): any {
  if (candidates.length === 1) return candidates[0]
  return candidates.reduce((best, c) => {
    const bestDate = getMostRecentReviewDate(best.reviews) ?? ''
    const cDate = getMostRecentReviewDate(c.reviews) ?? ''
    return cDate > bestDate ? c : best
  })
}

// ── Sobradinho-DF geographic anchor ──────────────────
// Centro de Sobradinho I, DF — garante que o Apify busca
// no mapa centrado aqui, não no Brasil inteiro
const SOBRADINHO_LAT = -15.6522
const SOBRADINHO_LNG = -47.7900
const SOBRADINHO_ZOOM = 14  // bairro inteiro visível

// Categorias do Google Maps que indicam estabelecimento completamente diferente
// do tipo esperado (bar/restaurante/lazer) — rejeitar se nome não bater
const UNRELATED_CATEGORIES = [
  'academia', 'gym', 'fitness', 'treinamento', 'musculação', 'pilates', 'yoga',
  'hospital', 'clínica', 'médico', 'dentista', 'farmácia', 'saúde',
  'escola', 'colégio', 'faculdade', 'universidade', 'curso',
  'supermercado', 'mercado', 'atacado', 'material de construção',
  'posto de gasolina', 'lava-jato', 'oficina', 'auto',
  'imobiliária', 'cartório', 'banco', 'lotérica',
]

// Verifica se a categoria do Apify é incompatível com o que foi buscado
function isUnrelatedCategory(categoryName?: string): boolean {
  if (!categoryName) return false
  const lower = categoryName.toLowerCase()
  return UNRELATED_CATEGORIES.some(c => lower.includes(c))
}

function isInSobradinho(address?: string, lat?: number, lng?: number): boolean {
  // Validação principal: coordenadas dentro de 12km de Sobradinho
  // (Vicente Pires fica a ~31km — fica de fora)
  if (lat !== undefined && lng !== undefined) {
    const dlat = lat - SOBRADINHO_LAT
    const dlng = lng - SOBRADINHO_LNG
    const dist = Math.sqrt(dlat * dlat + dlng * dlng) * 111
    if (dist <= 12) return true
  }
  // Fallback: endereço menciona "Sobradinho" explicitamente
  if (address) {
    const lower = address.toLowerCase()
    if (lower.includes('sobradinho')) return true
  }
  return false
}

// ── Main enrichment function ──────────────────────────

export async function enrichPlaces(
  places: { nome: string; cidade?: string }[]
): Promise<Record<string, EnrichedPlace>> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN não configurado')

  // Sempre sufixar com "Sobradinho DF" para desambiguação no texto de busca
  const searchStrings = places.map(p => `${p.nome} Sobradinho DF`)

  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items` +
    `?token=${token}&timeout=120&memory=1024`

  const input = {
    searchStringsArray: searchStrings,
    maxCrawledPlacesPerSearch: 2,
    maxReviews: 3,
    maxImages: 1,
    language: 'pt-BR',
    countryCode: 'br',
    // Ancora o mapa no centro de Sobradinho-DF
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
    throw new Error(`Apify error ${res.status}: ${err}`)
  }

  const items = (await res.json()) as any[]
  const result: Record<string, EnrichedPlace> = {}

  for (let i = 0; i < places.length; i++) {
    const search = searchStrings[i]
    const searchNorm = normalizeName(places[i].nome)

    const allMatches = items.filter(it => it.searchString === search)

    // Checar se o mais relevante está permanentemente fechado — retorna flag pro card mostrar badge
    const closedMatch = allMatches.find(it => it.permanentlyClosed && isInSobradinho(it.address, it.location?.lat, it.location?.lng))
    if (closedMatch && allMatches.filter(it => !it.permanentlyClosed).length === 0) {
      console.log(`[enrich] "${places[i].nome}" permanentemente fechado`)
      result[places[i].nome] = { nome: closedMatch.title ?? places[i].nome, permanentlyClosed: true, address: closedMatch.address, mapsUrl: closedMatch.url }
      continue
    }

    // Candidatos válidos: abertos + em Sobradinho
    const candidates = allMatches
      .filter(it => !it.permanentlyClosed)
      .filter(it => isInSobradinho(it.address, it.location?.lat, it.location?.lng))

    if (!candidates.length) {
      console.warn(`[enrich] Nenhum candidato válido em Sobradinho/DF para "${places[i].nome}"`)
      continue
    }

    // Escolhe o candidato com review mais recente (= mais ativo no momento)
    const item = pickBestCandidate(candidates)

    const todayHours = getTodayHours(item.openingHours)

    // Verifica se é o mesmo lugar (fuzzy, ignora stopwords)
    const samePlace = isSameName(places[i].nome, item.title ?? '')

    // Nome completamente diferente → rejeitar, não mostrar com aviso
    // Rejeitar SEMPRE se a categoria for incompatível — independente do nome
    // Cobre casos como "Horus Pub" → "Horus Treinamento Físico" (mesmo nome, categoria diferente)
    const category = item.categoryName ?? item.categories?.[0] ?? ''
    if (isUnrelatedCategory(category)) {
      console.warn(`[enrich] Rejecting "${item.title}" para "${places[i].nome}" — categoria incompatível: ${category}`)
      continue
    }

    if (!samePlace) {
      console.warn(`[enrich] Nome divergente confirmado para "${places[i].nome}" → "${item.title}"`)
    }

    const nameMismatch = !samePlace

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
        ?.filter((r: any) => r.text?.trim() && (r.stars ?? 5) >= 4)
        .slice(0, 2)
        .map((r: any) => ({
          text: r.text.slice(0, 220),
          rating: r.stars ?? 5,
          date: r.publishAt ?? r.relativeDate ?? '',
        })) ?? [],
      mapsUrl: item.url,
      lat: item.location?.lat,
      lng: item.location?.lng,
      nameMismatch,
      realName: nameMismatch ? item.title : undefined,
      mostRecentReview: getMostRecentReviewDate(item.reviews),
    }
  }

  return result
}
