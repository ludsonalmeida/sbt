import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ── GET /api/places ──────────────────────────────────
// Lista lugares com filtros opcionais
router.get('/', async (req, res) => {
  const { category, search, sponsored } = req.query

  const where: any = {}
  if (category) where.category = category as string
  if (search) where.name = { contains: search as string, mode: 'insensitive' }
  if (sponsored === 'true') where.sponsored = true

  const places = await prisma.place.findMany({
    where,
    orderBy: [{ sponsored: 'desc' }, { googleRating: 'desc' }],
    take: 50,
  })

  return res.json(places)
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
