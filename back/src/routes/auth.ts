import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../prisma/client'

const router = Router()

// ── Schemas de validação ──────────────────────────────

const registerUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  bairro: z.string().optional(),

  // preferências do onboarding
  preferences: z.record(z.number().min(0).max(1)).optional(),
  // { gastronomia: 0.9, natureza: 0.5, cultura: 0.3 }

  // canais opt-in
  acceptEmail: z.boolean().default(false),
  acceptWhatsapp: z.boolean().default(false),

  // referral
  referralCode: z.string().optional(),
})

const registerOwnerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  cnpj: z.string().optional(),
  businessName: z.string().min(2),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

// ── Helpers JWT ────────────────────────────────────────

function signAccess(userId: string, role: string) {
  return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET!, { expiresIn: '15m' })
}

function signRefresh(userId: string) {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' })
}

function setRefreshCookie(res: any, token: string) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })
}

// ── POST /api/auth/register/user ───────────────────────
router.post('/register/user', async (req, res) => {
  try {
    const data = registerUserSchema.parse(req.body)

    const exists = await prisma.user.findUnique({ where: { email: data.email } })
    if (exists) return res.status(409).json({ error: 'E-mail já cadastrado' })

    // referral
    let referredById: string | undefined
    if (data.referralCode) {
      const ref = await prisma.user.findUnique({ where: { referralCode: data.referralCode } })
      referredById = ref?.id
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        bairro: data.bairro,
        preferences: data.preferences ?? {},
        onboardingDone: !!data.preferences,
        acceptEmail: data.acceptEmail,
        acceptWhatsapp: data.acceptWhatsapp,
        referredById,
        role: 'USER',
      },
    })

    // logar preferências iniciais
    if (data.preferences) {
      const logs = Object.entries(data.preferences).map(([category, weight]) => ({
        userId: user.id,
        category,
        delta: weight as number,
        source: 'onboarding',
      }))
      await prisma.userPreferenceLog.createMany({ data: logs })
    }

    const accessToken = signAccess(user.id, user.role)
    const refreshToken = signRefresh(user.id)

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    setRefreshCookie(res, refreshToken)

    return res.status(201).json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        bairro: user.bairro,
        preferences: user.preferences,
        acceptEmail: user.acceptEmail,
        acceptWhatsapp: user.acceptWhatsapp,
        referralCode: user.referralCode,
      },
    })
  } catch (e: any) {
    if (e.name === 'ZodError') return res.status(400).json({ error: e.errors })
    return res.status(500).json({ error: 'Erro interno' })
  }
})

// ── POST /api/auth/register/owner ─────────────────────
router.post('/register/owner', async (req, res) => {
  try {
    const data = registerOwnerSchema.parse(req.body)

    const exists = await prisma.user.findUnique({ where: { email: data.email } })
    if (exists) return res.status(409).json({ error: 'E-mail já cadastrado' })

    const passwordHash = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: 'OWNER',
        onboardingDone: true,
      },
    })

    const owner = await prisma.owner.create({
      data: {
        userId: user.id,
        cnpj: data.cnpj,
        businessName: data.businessName,
      },
    })

    const accessToken = signAccess(user.id, user.role)
    const refreshToken = signRefresh(user.id)

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    setRefreshCookie(res, refreshToken)

    return res.status(201).json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      owner: { id: owner.id, businessName: owner.businessName },
    })
  } catch (e: any) {
    if (e.name === 'ZodError') return res.status(400).json({ error: e.errors })
    console.error('❌ Register owner error:', e)
    return res.status(500).json({ error: 'Erro interno', detail: e.message })
  }
})

// ── POST /api/auth/login ───────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' })

    const accessToken = signAccess(user.id, user.role)
    const refreshToken = signRefresh(user.id)

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    setRefreshCookie(res, refreshToken)

    return res.json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        bairro: user.bairro,
        preferences: user.preferences,
        acceptEmail: user.acceptEmail,
        acceptWhatsapp: user.acceptWhatsapp,
        onboardingDone: user.onboardingDone,
        referralCode: user.referralCode,
      },
    })
  } catch (e: any) {
    if (e.name === 'ZodError') return res.status(400).json({ error: e.errors })
    return res.status(500).json({ error: 'Erro interno' })
  }
})

// ── POST /api/auth/refresh ─────────────────────────────
router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken
  if (!token) return res.status(401).json({ error: 'Sem refresh token' })

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as any
    const stored = await prisma.refreshToken.findUnique({ where: { token } })

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Token inválido ou expirado' })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' })

    // rotacionar refresh token
    await prisma.refreshToken.update({ where: { token }, data: { revoked: true } })
    const newRefresh = signRefresh(user.id)
    await prisma.refreshToken.create({
      data: {
        token: newRefresh,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    setRefreshCookie(res, newRefresh)
    return res.json({ accessToken: signAccess(user.id, user.role) })
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
})

// ── POST /api/auth/logout ──────────────────────────────
router.post('/logout', async (req, res) => {
  const token = req.cookies.refreshToken
  if (token) {
    await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } })
  }
  res.clearCookie('refreshToken')
  return res.json({ ok: true })
})

export default router
