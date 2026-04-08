import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma/client'
import { authMiddleware } from '../middleware/auth'
// @ts-ignore
import { callOpenAI, buildAuthUrl, getPendingFlow, clearPendingFlow, exchangeCode, getValidAuth } from '../codex-oauth'

const router = Router()

// ── GET /api/chat/auth ────────────────────────────────
// Inicia o flow OAuth do Codex (ChatGPT)
// redirect_uri fixo = formato do Codex CLI (único registrado na OpenAI)
router.get('/auth', (req: any, res) => {
  const redirectUri = 'http://localhost:1455/auth/callback'
  const { url } = buildAuthUrl(redirectUri)

  // Página com link + campo pra colar o callback URL
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Autorizar Codex</title>
<style>
  body { font-family: sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; background: #111; color: #eee; }
  a.btn { display: inline-block; padding: 12px 24px; background: #10a37f; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0; }
  input { width: 100%; padding: 10px; margin: 8px 0; background: #222; border: 1px solid #444; color: #eee; border-radius: 4px; box-sizing: border-box; }
  button { padding: 10px 20px; background: #10a37f; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
  pre { background: #222; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
</style>
</head>
<body>
  <h2>Autorizar Codex / ChatGPT</h2>
  <p>1. Clique no botão abaixo para autorizar:</p>
  <a class="btn" href="${url}" target="_blank">Abrir login OpenAI →</a>
  <p>2. Após autorizar, o browser vai tentar abrir <code>localhost:1455</code> (que não existe — isso é normal).<br>
     Copie o URL completo da barra de endereço e cole aqui:</p>
  <input type="text" id="cbUrl" placeholder="http://localhost:1455/auth/callback?code=...&state=..." />
  <button onclick="submit()">Finalizar autorização</button>
  <div id="result"></div>
  <script>
    async function submit() {
      const raw = document.getElementById('cbUrl').value.trim();
      let url;
      try { url = new URL(raw); } catch { document.getElementById('result').innerHTML = '<p style="color:red">URL inválido</p>'; return; }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) { document.getElementById('result').innerHTML = '<p style="color:red">Parâmetros code/state não encontrados no URL</p>'; return; }
      const r = await fetch('/api/chat/auth/exchange?code=' + encodeURIComponent(code) + '&state=' + encodeURIComponent(state));
      const text = await r.text();
      document.getElementById('result').innerHTML = text;
    }
  </script>
</body>
</html>`)
})

// ── GET /api/chat/auth/exchange ───────────────────────
router.get('/auth/exchange', async (req: any, res) => {
  const { code, state } = req.query
  const flow = getPendingFlow()

  if (!flow || flow.state !== state) {
    return res.status(400).send('<p style="color:red">State mismatch. <a href="/api/chat/auth">Tente de novo</a></p>')
  }

  try {
    await exchangeCode(code as string, flow.redirect_uri, flow.verifier)
    clearPendingFlow()
    res.send('<p style="color:#10a37f"><strong>✅ Autorizado com sucesso!</strong> Pode fechar esta aba.</p>')
  } catch (e: any) {
    console.error('[chat/auth/exchange]', e.message)
    res.status(500).send(`<p style="color:red">Erro: ${e.message}</p>`)
  }
})

// ── GET /api/chat/auth/status ─────────────────────────
router.get('/auth/status', async (_req, res) => {
  const auth = await getValidAuth()
  if (!auth) return res.json({ authorized: false })
  res.json({
    authorized: true,
    expires_at: new Date(auth.expires_at).toISOString(),
    account_id: auth.account_id,
  })
})

// ── POST /api/chat/send ───────────────────────────────
router.post('/send', authMiddleware, async (req: any, res) => {
  try {
    const schema = z.object({
      messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
      systemPrompt: z.string(),
    })
    const { messages, systemPrompt } = schema.parse(req.body)
    const text = await callOpenAI(systemPrompt, messages)
    return res.json({ text })
  } catch (e: any) {
    console.error('[chat/send]', e.message)
    return res.status(500).json({ error: e.message })
  }
})

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
