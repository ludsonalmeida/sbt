import sgMail from '@sendgrid/mail'
import { prisma } from '../prisma/client'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

// ── Tipos ──────────────────────────────────────────────

interface PlaceRecommendation {
  nome: string
  categoria: string
  emoji: string
  endereco?: string
  nota?: number
  parecer: string
}

// ── Email ──────────────────────────────────────────────

export async function sendWeeklyEmail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true, email: true, acceptEmail: true,
      preferences: true, bairro: true,
    },
  })

  if (!user?.acceptEmail) return { skipped: true, reason: 'opt-out' }

  // TODO: chamar Claude pra gerar recomendações personalizadas
  // baseadas nas preferências do usuário

  const msg = {
    to: user.email,
    from: 'oi@sobradinhotem.app',
    subject: `${user.name.split(' ')[0]}, tem coisa boa rolando em Sobradinho! 🌇`,
    html: buildEmailTemplate(user.name, user.bairro, []),
  }

  await sgMail.send(msg)
  return { sent: true }
}

function buildEmailTemplate(name: string, bairro: string | null | undefined, places: PlaceRecommendation[]) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="font-family: sans-serif; background: #FBF6EE; padding: 24px; margin: 0;">
      <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1.5px solid #E8E2D8;">
        <div style="background: #F5A623; padding: 24px; text-align: center;">
          <h1 style="color: #1A1A18; font-size: 24px; margin: 0; font-weight: 900;">Sobradinho TEM! 🌇</h1>
          <p style="color: #1A1A18; margin: 8px 0 0; font-size: 14px;">Suas dicas personalizadas dessa semana</p>
        </div>
        <div style="padding: 24px;">
          <p style="color: #1A1A18; font-size: 15px;">Oi, <strong>${name.split(' ')[0]}</strong>! 👋</p>
          <p style="color: #6B6B5E; font-size: 14px; line-height: 1.6;">
            Separei algumas dicas especiais ${bairro ? 'pra quem é do ' + bairro : 'pra você'} essa semana.
            Tudo aqui em Sobradinho — não precisa ir pra lugar nenhum! 😄
          </p>
          ${places.map(p => `
            <div style="border: 1.5px solid #E8E2D8; border-radius: 12px; padding: 16px; margin: 12px 0;">
              <div style="font-size: 24px; margin-bottom: 8px;">${p.emoji}</div>
              <strong style="color: #1A1A18;">${p.nome}</strong>
              <span style="background: #FFF4E0; color: #C4651A; font-size: 11px; padding: 2px 8px; border-radius: 10px; margin-left: 8px;">${p.categoria}</span>
              ${p.nota ? `<div style="color: #F5A623; margin-top: 4px;">★ ${p.nota}</div>` : ''}
              <p style="color: #6B6B5E; font-size: 13px; margin: 8px 0 0;">${p.parecer}</p>
            </div>
          `).join('')}
          <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E8E2D8;">
            <a href="https://sobradinhotem.app" style="background: #F5A623; color: #1A1A18; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
              Descobrir mais →
            </a>
          </div>
          <p style="color: #6B6B5E; font-size: 11px; text-align: center; margin-top: 16px;">
            Não quer mais receber? <a href="https://sobradinhotem.app/settings" style="color: #6B6B5E;">Clique aqui</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// ── WhatsApp (Meta Cloud API) ──────────────────────────

export async function sendWhatsappMessage(phone: string, message: string) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return { skipped: true, reason: 'not configured' }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/\D/g, ''),
        type: 'text',
        text: { body: message },
      }),
    }
  )

  return res.json()
}

export async function notifyUserWhatsapp(userId: string, message: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, acceptWhatsapp: true },
  })

  if (!user?.acceptWhatsapp || !user.phone) return { skipped: true }
  return sendWhatsappMessage(user.phone, message)
}
