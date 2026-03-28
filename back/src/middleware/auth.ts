import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma/client'

export async function authMiddleware(req: any, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' })
  }

  try {
    const token = auth.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any
    req.userId = payload.sub
    req.userRole = payload.role
    return next()
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

export async function ownerMiddleware(req: any, res: Response, next: NextFunction) {
  if (req.userRole !== 'OWNER' && req.userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito a donos de estabelecimento' })
  }
  return next()
}

export async function adminMiddleware(req: any, res: Response, next: NextFunction) {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito a admins' })
  }
  return next()
}
