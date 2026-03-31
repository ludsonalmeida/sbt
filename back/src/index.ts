import express from 'express'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'

import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import placeRoutes from './routes/places'
import chatRoutes from './routes/chat'
import ownerRoutes from './routes/owner'
import notificationRoutes from './routes/notifications'

const app = express()

// In production, frontend is served from same origin — allow it
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : undefined

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
app.use(cors({ origin: allowedOrigins ?? true, credentials: true }))
app.use(cookieParser())
app.use(express.json())

// rate limit global
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }))

// API rotas
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/places', placeRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/owner', ownerRoutes)
app.use('/api/notifications', notificationRoutes)

app.get('/health', (_, res) => res.json({ ok: true }))

// ── Serve frontend static files in production ────────
const frontendPath = path.join(__dirname, '..', '..', 'front', 'dist')
app.use(express.static(frontendPath))
// SPA fallback — any non-API route serves index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Sobradinho TEM! running on port ${PORT}`))
