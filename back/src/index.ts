import express from 'express'
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

app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }))
app.use(cookieParser())
app.use(express.json())

// rate limit global
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))

// rotas
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/places', placeRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/owner', ownerRoutes)
app.use('/api/notifications', notificationRoutes)

app.get('/health', (_, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`🌇 Sobradinho TEM! backend na porta ${PORT}`))
