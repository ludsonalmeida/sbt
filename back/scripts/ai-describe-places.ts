// Gera descrição interpretativa de cada Place via Codex OAuth (gpt-5-codex-mini).
// Lê reviews + categoria + nome e produz: { tipo, publico, vibe, resumo }
// Salva em enrichment.ai e marca enrichment.aiAt.
//
// Uso:
//   tsx scripts/ai-describe-places.ts                      # tudo que ainda não tem ai
//   tsx scripts/ai-describe-places.ts bares                # só uma categoria
//   tsx scripts/ai-describe-places.ts --force              # regera tudo
//   tsx scripts/ai-describe-places.ts bares --force        # regera categoria
//
// Requer codex-auth.json válido + DATABASE_URL.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
// @ts-ignore — JS file
import { callOpenAI } from '../src/codex-oauth'

const prisma = new PrismaClient()

const CONCURRENCY = 3

interface AiSummary {
  tipo: string
  publico: string
  vibe: string
  resumo: string
}

const SYSTEM_PROMPT = `Você é um conhecedor da cena de Sobradinho-DF. Recebe dados de um estabelecimento (nome, categoria, endereço, reviews) e retorna um JSON interpretando o lugar.

Retorne EXATAMENTE este JSON (sem markdown, sem texto extra, sem fences):
{
  "tipo": "classificação curta e específica (3-5 palavras)",
  "publico": "para quem é (1 frase curta)",
  "vibe": "atmosfera e ambiente (1 frase curta)",
  "resumo": "1-2 frases interpretando o que torna o lugar único"
}

Regras:
- Português do Brasil, tom natural e direto
- Se faltar info, infira pelo nome/categoria sem inventar fatos
- Não cite reviews textualmente
- Não use emojis
- Tipo deve ser específico (não "Restaurante" — use "Pizzaria de forno a lenha" ou "Self-service caseiro")`

function extractJson(text: string): AiSummary | null {
  const clean = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  // tenta parse direto
  try { return JSON.parse(clean) } catch {}
  // fallback: pega primeiro { ... }
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

async function describeOne(place: any): Promise<AiSummary | null> {
  const reviews = (place.enrichment?.topReviews ?? [])
    .map((r: any) => `- "${r.text}" (${r.rating}★)`)
    .join('\n') || '(sem reviews)'

  const userMsg = `Nome: ${place.name}
Categoria buscada: ${place.category}
Categoria Google: ${place.enrichment?.categoryName ?? 'n/d'}
Endereço: ${place.address ?? 'n/d'}
Nota: ${place.googleRating ?? 'n/d'} (${place.googleTotal ?? 0} avaliações)
Reviews recentes:
${reviews}

Responda com o JSON apenas.`

  try {
    const text = await callOpenAI(SYSTEM_PROMPT, [{ role: 'user', content: userMsg }])
    const parsed = extractJson(text)
    if (!parsed?.tipo || !parsed?.publico || !parsed?.vibe || !parsed?.resumo) {
      console.error(`  ⚠️  ${place.name}: resposta inválida`)
      return null
    }
    return parsed
  } catch (e: any) {
    console.error(`  ❌ ${place.name}: ${e.message}`)
    return null
  }
}

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const categoryFilter = args.find(a => !a.startsWith('--'))

  const where: any = {}
  if (categoryFilter) where.category = categoryFilter

  const all = await prisma.place.findMany({ where, orderBy: { googleRating: 'desc' } })

  const targets = force ? all : all.filter(p => {
    const e = p.enrichment as any
    return !e?.ai
  })

  console.log(`Total: ${all.length} | Pra processar: ${targets.length}${force ? ' (force)' : ''}`)
  if (!targets.length) { await prisma.$disconnect(); return }

  let done = 0
  let ok = 0
  let fail = 0

  const queue = [...targets]
  async function worker() {
    while (queue.length) {
      const p = queue.shift()
      if (!p) return
      const ai = await describeOne(p)
      done++
      if (ai) {
        await prisma.place.update({
          where: { id: p.id },
          data: {
            enrichment: {
              ...(p.enrichment as any ?? {}),
              ai,
              aiAt: new Date().toISOString(),
            },
          },
        })
        ok++
        console.log(`[${done}/${targets.length}] ✅ ${p.name} — ${ai.tipo}`)
      } else {
        fail++
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  console.log(`\n━━━ ${ok} ok, ${fail} falhas ━━━`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
