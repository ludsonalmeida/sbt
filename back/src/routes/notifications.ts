import { Router } from 'express'
import { authMiddleware, adminMiddleware } from '../middleware/auth'
import { sendWeeklyEmail, notifyUserWhatsapp } from '../services/notificationService'
import { prisma } from '../prisma/client'

const router = Router()

// ── POST /api/notifications/email/weekly ─────────────
// Trigger manual do email semanal (admin only)
router.post('/email/weekly', authMiddleware, adminMiddleware, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { acceptEmail: true },
    select: { id: true },
  })

  const results = await Promise.allSettled(
    users.map((u) => sendWeeklyEmail(u.id))
  )

  return res.json({
    total: users.length,
    sent: results.filter((r) => r.status === 'fulfilled').length,
  })
})

// ── POST /api/notifications/whatsapp/send ────────────
// Envia mensagem whatsapp para um usuário (admin only)
router.post('/whatsapp/send', authMiddleware, adminMiddleware, async (req, res) => {
  const { userId, message } = req.body
  if (!userId || !message) return res.status(400).json({ error: 'userId e message obrigatórios' })

  const result = await notifyUserWhatsapp(userId, message)
  return res.json(result)
})

export default router
