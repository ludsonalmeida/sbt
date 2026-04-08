import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authMiddleware } from '../middleware/auth'
import { enrichPlaces } from '../services/apify'

const router = Router()

// ── POST /api/places/enrich ──────────────────────────
// Enriquece dados de lugares via Apify (Google Maps, Reviews, Business)
router.post('/enrich', authMiddleware, async (req: any, res) => {
  try {
    const schema = z.object({
      places: z.array(z.object({
        nome: z.string(),
        cidade: z.string().optional(),
      })).min(1).max(5),
    })
    const { places } = schema.parse(req.body)
    const enriched = await enrichPlaces(places)
    return res.json(enriched)
  } catch (e: any) {
    console.error('[places/enrich]', e.message)
    return res.status(500).json({ error: e.message })
  }
})

// ── GET /api/places ──────────────────────────────────
// Lista lugares com filtros opcionais. Cache em memória de 5min por chave.
const listCache = new Map<string, { at: number; data: any }>()
const LIST_TTL_MS = 5 * 60 * 1000

router.get('/', async (req, res) => {
  const { category, search, sponsored } = req.query
  const key = `c=${category ?? ''}|s=${search ?? ''}|sp=${sponsored ?? ''}`

  const hit = listCache.get(key)
  if (hit && Date.now() - hit.at < LIST_TTL_MS) {
    res.setHeader('X-Cache', 'HIT')
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.json(hit.data)
  }

  const where: any = { googleTotal: { gte: 10 } }
  if (category) where.category = category as string
  if (search) where.name = { contains: search as string, mode: 'insensitive' }
  if (sponsored === 'true') where.sponsored = true

  const places = await prisma.place.findMany({
    where,
    orderBy: [{ sponsored: 'desc' }, { googleRating: 'desc' }, { googleTotal: 'desc' }],
    take: 100,
  })

  listCache.set(key, { at: Date.now(), data: places })
  res.setHeader('X-Cache', 'MISS')
  res.setHeader('Cache-Control', 'public, max-age=300')
  return res.json(places)
})

// ── POST /api/places/cache/clear ─────────────────────
router.post('/cache/clear', (_req, res) => {
  listCache.clear()
  return res.json({ ok: true })
})

// ── GET /api/places/:id ──────────────────────────────
router.get('/:id', async (req, res) => {
  const place = await prisma.place.findUnique({
    where: { id: req.params.id },
    include: { owner: true },
  })
  if (!place) return res.status(404).json({ error: 'Lugar não encontrado' })
  return res.json(place)
})

// ── POST /api/places/:id/save ────────────────────────
// Salvar lugar nos favoritos
router.post('/:id/save', authMiddleware, async (req: any, res) => {
  try {
    await prisma.savedPlace.create({
      data: { userId: req.userId, placeId: req.params.id },
    })
    return res.status(201).json({ ok: true })
  } catch (e: any) {
    if (e.code === 'P2002') return res.json({ ok: true, already: true })
    return res.status(500).json({ error: 'Erro ao salvar' })
  }
})

// ── DELETE /api/places/:id/save ──────────────────────
router.delete('/:id/save', authMiddleware, async (req: any, res) => {
  await prisma.savedPlace.deleteMany({
    where: { userId: req.userId, placeId: req.params.id },
  })
  return res.json({ ok: true })
})

// ── GET /api/places/saved ────────────────────────────
router.get('/user/saved', authMiddleware, async (req: any, res) => {
  const saved = await prisma.savedPlace.findMany({
    where: { userId: req.userId },
    include: { place: true },
    orderBy: { savedAt: 'desc' },
  })
  return res.json(saved.map((s) => s.place))
})

export default router
