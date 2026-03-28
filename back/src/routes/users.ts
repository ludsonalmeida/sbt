import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ── GET /api/users/me ──────────────────────────────────
router.get('/me', authMiddleware, async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true, name: true, email: true, phone: true,
      role: true, bairro: true, cidade: true,
      preferences: true, onboardingDone: true,
      acceptEmail: true, acceptWhatsapp: true,
      referralCode: true,
      _count: { select: { referrals: true, savedPlaces: true } },
    },
  })
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })
  return res.json(user)
})

// ── POST /api/users/onboarding ─────────────────────────
// Salva preferências e opt-ins após onboarding
router.post('/onboarding', authMiddleware, async (req: any, res) => {
  const schema = z.object({
    preferences: z.record(z.number().min(0).max(1)),
    acceptEmail: z.boolean(),
    acceptWhatsapp: z.boolean(),
  })

  const data = schema.parse(req.body)

  await prisma.user.update({
    where: { id: req.userId },
    data: {
      preferences: data.preferences,
      onboardingDone: true,
      acceptEmail: data.acceptEmail,
      acceptWhatsapp: data.acceptWhatsapp,
    },
  })

  // logar preferências iniciais
  const logs = Object.entries(data.preferences)
    .filter(([, v]) => v > 0)
    .map(([category, delta]) => ({
      userId: req.userId,
      category,
      delta: delta as number,
      source: 'onboarding',
    }))

  if (logs.length) await prisma.userPreferenceLog.createMany({ data: logs })

  return res.json({ ok: true })
})

// ── POST /api/users/preference-log ────────────────────
// Registra interação com um card e atualiza pesos
router.post('/preference-log', authMiddleware, async (req: any, res) => {
  const schema = z.object({
    category: z.string(),
    delta: z.number().min(-1).max(1),
    source: z.string(),
  })

  const { category, delta, source } = schema.parse(req.body)

  // registrar log
  await prisma.userPreferenceLog.create({
    data: { userId: req.userId, category, delta, source },
  })

  // atualizar peso no perfil do usuário (clamp 0–1)
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { preferences: true },
  })

  const prefs = (user?.preferences as Record<string, number>) ?? {}
  const current = prefs[category] ?? 0.5
  const updated = Math.min(1, Math.max(0, current + delta))

  await prisma.user.update({
    where: { id: req.userId },
    data: { preferences: { ...prefs, [category]: updated } },
  })

  return res.json({ ok: true, category, newWeight: updated })
})

// ── PATCH /api/users/preferences ──────────────────────
// Atualização manual das preferências
router.patch('/preferences', authMiddleware, async (req: any, res) => {
  const schema = z.object({
    preferences: z.record(z.number().min(0).max(1)),
  })
  const { preferences } = schema.parse(req.body)

  await prisma.user.update({
    where: { id: req.userId },
    data: { preferences },
  })

  return res.json({ ok: true })
})

// ── PATCH /api/users/channels ─────────────────────────
// Atualizar opt-in de canais
router.patch('/channels', authMiddleware, async (req: any, res) => {
  const schema = z.object({
    acceptEmail: z.boolean().optional(),
    acceptWhatsapp: z.boolean().optional(),
  })
  const data = schema.parse(req.body)

  await prisma.user.update({
    where: { id: req.userId },
    data,
  })

  return res.json({ ok: true })
})

// ── GET /api/users/stats ───────────────────────────────
// Stats da rede para a sidebar
router.get('/stats', async (_req, res) => {
  const [totalUsers, totalOwners, totalPlaces] = await Promise.all([
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.owner.count({ where: { verified: true } }),
    prisma.place.count(),
  ])
  return res.json({ totalUsers, totalOwners, totalPlaces })
})

export default router
