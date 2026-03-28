import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// ── POST /api/chat/conversations ─────────────────────
// Salva ou atualiza uma conversa
router.post('/conversations', authMiddleware, async (req: any, res) => {
  const schema = z.object({
    sessionId: z.string().optional(),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      places: z.array(z.any()).optional(),
      timestamp: z.string().or(z.date()),
    })),
  })

  const data = schema.parse(req.body)

  if (data.sessionId) {
    // atualizar conversa existente
    const existing = await prisma.conversation.findFirst({
      where: { sessionId: data.sessionId, userId: req.userId },
    })

    if (existing) {
      const updated = await prisma.conversation.update({
        where: { id: existing.id },
        data: { messages: data.messages as any },
      })
      return res.json(updated)
    }
  }

  // criar nova
  const conv = await prisma.conversation.create({
    data: {
      userId: req.userId,
      messages: data.messages as any,
    },
  })

  return res.status(201).json(conv)
})

// ── GET /api/chat/conversations ──────────────────────
// Lista conversas do usuário
router.get('/conversations', authMiddleware, async (req: any, res) => {
  const convs = await prisma.conversation.findMany({
    where: { userId: req.userId },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })
  return res.json(convs)
})

// ── GET /api/chat/conversations/:id ──────────────────
router.get('/conversations/:id', authMiddleware, async (req: any, res) => {
  const conv = await prisma.conversation.findFirst({
    where: { id: req.params.id, userId: req.userId },
  })
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' })
  return res.json(conv)
})

export default router
