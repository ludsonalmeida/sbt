import type { Preferences } from '../store/authStore'

// ── Tipos ──────────────────────────────────────────────

export interface PlaceData {
  id: string
  nome: string
  categoria: string
  emoji: string
  cidade?: string
  why?: string
  horario?: string
  preco?: string
  distancia?: string
  contexto?: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  places?: PlaceData[]
  timestamp: Date
}

export interface AnaliseResult {
  nivel: 'top' | 'bom' | 'ok' | 'cuidado'
  selo: string
  avaliacoes: string
  fortes: string[]
  fracos: string[]
  compat_nivel: 'sim' | 'parcial' | 'nao'
  compat_label: string
  compat_icon: string
  compat_texto: string
}

// ── Aprendizado de preferências ────────────────────────
// Toda vez que o usuário interage com um card,
// o peso da categoria é ajustado e enviado pro backend

export type InteractionType = 'view' | 'save' | 'maps_click' | 'share' | 'dismiss'

const DELTAS: Record<InteractionType, number> = {
  view:        0.02,
  save:        0.10,
  maps_click:  0.07,
  share:       0.08,
  dismiss:    -0.05,
}

export async function logInteraction(
  placeCategory: string,
  type: InteractionType,
  accessToken?: string
) {
  if (!accessToken) return

  const delta = DELTAS[type]

  try {
    await fetch('/api/users/preference-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ category: placeCategory, delta, source: `chat_${type}` }),
    })
  } catch (e) {
    console.error('preference log error', e)
  }
}

// ── Construção do system prompt ────────────────────────

export function buildSystemPrompt(params: {
  userName?: string
  bairro?: string
  preferences?: Preferences
  role?: string
}): string {
  const { userName, bairro, preferences, role } = params
  const userStr = userName
    ? `Nome: ${userName}${bairro ? ', Bairro: ' + bairro : ''}`
    : 'Visitante anônimo'

  // formatar preferências com peso
  let prefsStr = 'Nenhuma definida'
  if (preferences && Object.keys(preferences).length > 0) {
    const sorted = Object.entries(preferences)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => `${k} (${Math.round(v * 100)}%)`)
    prefsStr = sorted.length ? sorted.join(', ') : 'Nenhuma definida'
  }

  const d = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return `Você é o agente do "Sobradinho TEM!" — guia local de Sobradinho-DF.

USUÁRIO: ${userStr}
PREFERÊNCIAS (ordenadas por peso): ${prefsStr}
HOJE: ${d}

FLUXO OBRIGATÓRIO — quando sugerir lugares:
1. Escreva sua indicação em texto natural (por que vale, o que esperar, tom de amigo local)
2. Inclua ao final o bloco PLACES oculto:

<!--PLACES:[
  {
    "nome": "Nome Exato como no Google Maps",
    "categoria": "Restaurante|Parque|Bar|Feira|Museu|Trilha|Praia etc",
    "emoji": "🍕",
    "cidade": "Sobradinho DF",
    "why": "frase curta: por que estou indicando AGORA e pra ESSE usuário",
    "horario": "Seg-Dom 10h-22h (se souber)",
    "preco": "$ Até R$30 | $$ R$30-80 | $$$ Acima R$80",
    "distancia": "5 min do centro de Sobradinho I",
    "contexto": "descrição completa para análise: ambiente, público, pontos fortes e fracos"
  }
]-->

REGRAS:
1. Sempre inclua PLACES quando citar lugar específico (1 a 3 por resposta)
2. O campo "why" deve levar em conta as PREFERÊNCIAS do usuário — seja específico
3. Tom: informal, caloroso, gírias leves do DF (boa praça, é nóis, tá bom demais)
4. Reforce sempre: não precisa sair de Sobradinho pra curtir a vida
5. Nomes exatos como no Google Maps para melhor match
6. Se não souber nome exato, prefira não incluir no PLACES

PONTOS DE SOBRADINHO:
Torre Digital Flor do Cerrado (Niemeyer, Grande Colorado), Parque Ecológico de Sobradinho,
Feira de Sobradinho II, CEU Sobradinho, Rio São Bartolomeu, Chapada da Contagem,
Lago Paranoá e arredores, restaurantes e bares do centro de Sobradinho I e II`
}

// ── Parser da resposta ─────────────────────────────────

export function parseAiResponse(raw: string): { text: string; places: PlaceData[] } {
  const match = raw.match(/<!--PLACES:([\s\S]*?)-->/)
  let places: PlaceData[] = []
  let text = raw

  if (match) {
    try {
      const parsed = JSON.parse(match[1])
      places = parsed.map((p: any, i: number) => ({
        ...p,
        id: `p${Date.now()}_${i}`,
      }))
    } catch (e) {
      console.warn('PLACES parse error', e)
    }
    text = raw.replace(/<!--PLACES:[\s\S]*?-->/, '').trim()
  }

  return { text, places }
}

// ── Análise IA de um lugar ─────────────────────────────

export async function gerarAnalise(
  place: PlaceData,
  gData: { rating?: number; total?: number; aberto?: boolean } | null,
  userName?: string,
  preferences?: Preferences
): Promise<AnaliseResult> {
  const perfil = userName
    ? `Usuário: ${userName}. Preferências: ${
        preferences
          ? Object.entries(preferences)
              .filter(([, v]) => v > 0.3)
              .sort(([, a], [, b]) => b - a)
              .map(([k, v]) => `${k} (${Math.round(v * 100)}%)`)
              .join(', ')
          : 'não definidas'
      }`
    : 'Visitante sem cadastro'

  const prompt = `Curador do "Sobradinho TEM!" — guia local honesto de Sobradinho-DF.

LUGAR: ${place.nome}
CATEGORIA: ${place.categoria}
CONTEXTO: ${place.contexto || 'ponto em Sobradinho-DF'}
NOTA GOOGLE: ${gData?.rating ?? 'N/D'}/5 (${gData?.total ?? 0} avaliações)
ABERTO AGORA: ${gData?.aberto === true ? 'sim' : gData?.aberto === false ? 'não' : 'desconhecido'}
PERFIL: ${perfil}

Responda APENAS com JSON válido (sem markdown):
{
  "nivel": "top"|"bom"|"ok"|"cuidado",
  "selo": "IMPERDÍVEL"|"BOA PEDIDA"|"VALE A VISITA"|"COM RESSALVAS",
  "avaliacoes": "2 frases sobre o que a nota e qtd de avaliações dizem. Tom honesto.",
  "fortes": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "fracos": ["ponto fraco 1", "ponto fraco 2"],
  "compat_nivel": "sim"|"parcial"|"nao",
  "compat_label": "COMBINA COM VOCÊ"|"COMBINA EM PARTE"|"NÃO É PRA VOCÊ",
  "compat_icon": "🎯"|"🤔"|"❌",
  "compat_texto": "2 frases: esse lugar bate com o perfil e preferências do usuário? Seja honesto e específico."
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  const raw = data.content?.[0]?.text ?? ''

  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return {
      nivel: 'bom',
      selo: 'BOA PEDIDA',
      avaliacoes: 'Lugar bem avaliado pela comunidade local.',
      fortes: ['Boa localização', 'Bem avaliado'],
      fracos: ['Dados limitados'],
      compat_nivel: 'parcial',
      compat_label: 'COMBINA EM PARTE',
      compat_icon: '🤔',
      compat_texto: 'Pode ser uma boa opção dependendo do que você busca hoje.',
    }
  }
}
