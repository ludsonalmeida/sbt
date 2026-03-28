import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authMiddleware, ownerMiddleware } from '../middleware/auth'

const router = Router()

// ── GET /api/owner/places ──────────────────────────────
// Lista os estabelecimentos do dono logado
router.get('/places', authMiddleware, ownerMiddleware, async (req: any, res) => {
  const owner = await prisma.owner.findUnique({
    where: { userId: req.userId },
    include: { places: true },
  })
  return res.json(owner?.places ?? [])
})

// ── POST /api/owner/places ─────────────────────────────
// Cadastra novo estabelecimento
router.post('/places', authMiddleware, ownerMiddleware, async (req: any, res) => {
  const schema = z.object({
    name: z.string().min(2),
    category: z.string(),
    googlePlaceId: z.string().optional(),
    address: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    emoji: z.string().optional(),
  })

  const data = schema.parse(req.body)
  const owner = await prisma.owner.findUnique({ where: { userId: req.userId } })
  if (!owner) return res.status(403).json({ error: 'Perfil de dono não encontrado' })

  const place = await prisma.place.create({
    data: { ...data, ownerId: owner.id },
  })

  return res.status(201).json(place)
})

// ── PATCH /api/owner/places/:id/enrich ────────────────
// Dono enriquece dados do estabelecimento
// (descrição, fotos próprias, horários, menu, diferenciais)
router.patch('/places/:id/enrich', authMiddleware, ownerMiddleware, async (req: any, res) => {
  const schema = z.object({
    descricao: z.string().optional(),
    horarios: z.record(z.string()).optional(), // { seg: '10-22', dom: 'fechado' }
    fotos_urls: z.array(z.string().url()).optional(),
    menu_url: z.string().url().optional(),
    diferenciais: z.array(z.string()).optional(), // ['estacionamento grátis', 'wifi', 'pet friendly']
    telefone: z.string().optional(),
    instagram: z.string().optional(),
    preco_medio: z.string().optional(),
  })

  const enrichment = schema.parse(req.body)

  const owner = await prisma.owner.findUnique({ where: { userId: req.userId } })
  if (!owner) return res.status(403).json({ error: 'Sem permissão' })

  const place = await prisma.place.findFirst({
    where: { id: req.params.id, ownerId: owner.id },
  })
  if (!place) return res.status(404).json({ error: 'Estabelecimento não encontrado' })

  const updated = await prisma.place.update({
    where: { id: req.params.id },
    data: {
      enrichment: { ...(place.enrichment as object ?? {}), ...enrichment },
    },
  })

  return res.json(updated)
})

// ── POST /api/owner/places/:id/sponsor ────────────────
// Inicia um patrocínio (futuro: integrar Stripe/Pix)
router.post('/places/:id/sponsor', authMiddleware, ownerMiddleware, async (req: any, res) => {
  const schema = z.object({
    budgetPerDay: z.number().min(5),  // mínimo R$5/dia
    days: z.number().min(1).max(90),
  })

  const { budgetPerDay, days } = schema.parse(req.body)
  const owner = await prisma.owner.findUnique({ where: { userId: req.userId } })

  const place = await prisma.place.findFirst({
    where: { id: req.params.id, ownerId: owner?.id },
  })
  if (!place) return res.status(404).json({ error: 'Não encontrado' })

  const sponsorStart = new Date()
  const sponsorEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  const updated = await prisma.place.update({
    where: { id: req.params.id },
    data: {
      sponsored: true,
      sponsorBudget: budgetPerDay,
      sponsorStart,
      sponsorEnd,
    },
  })

  // TODO: criar cobrança via Stripe/Pix
  return res.json({ ok: true, place: updated, totalCost: budgetPerDay * days })
})

// ── GET /api/owner/stats ───────────────────────────────
// Métricas básicas do dono
router.get('/stats', authMiddleware, ownerMiddleware, async (req: any, res) => {
  const owner = await prisma.owner.findUnique({
    where: { userId: req.userId },
    include: {
      places: {
        include: { _count: { select: { savedBy: true } } },
      },
    },
  })

  const stats = owner?.places.map((p) => ({
    placeId: p.id,
    name: p.name,
    saves: p._count.savedBy,
    sponsored: p.sponsored,
    sponsorEnd: p.sponsorEnd,
  }))

  return res.json({ places: stats ?? [] })
})

export default router
