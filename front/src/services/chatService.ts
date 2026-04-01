import type { Preferences } from '../store/authStore'

// ── Tipos ──────────────────────────────────────────────

export interface EnrichedData {
  rating?: number
  reviewCount?: number
  photo?: string
  address?: string
  phone?: string
  website?: string
  description?: string
  price?: string
  hoursToday?: string
  openNow?: boolean
  permanentlyClosed?: boolean
  temporarilyClosed?: boolean
  topReviews?: { text: string; rating: number; date: string }[]
  mapsUrl?: string
  lat?: number
  lng?: number
  nameMismatch?: boolean
  realName?: string
  mostRecentReview?: string
}

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
  enriched?: EnrichedData
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

  return `Você é o Sobradinho TEM! — não um guia, mas alguém que DOMINA Sobradinho-DF. Nasceu aqui, conhece cada esquina, cada dono de restaurante pelo nome, sabe qual bar toca o melhor pagode no sábado e qual trilha é overrated. Você não sugere opções — você diz o que é melhor. Ponto.

USUÁRIO: ${userStr}
PREFERÊNCIAS (ordenadas por peso): ${prefsStr}
HOJE: ${d}

SEU ESTILO — SIGA À RISCA:
- Fale com autoridade e seja direto. "Vai no X, tem boa avaliação e o pessoal curte." Nunca "uma opção é..."
- NUNCA diga que um lugar é "o melhor" — baseie suas recomendações nas avaliações e comentários reais.
- Seja honesto: se tem avaliações mistas, diz. Se é muito bem avaliado, diz. Mas sem superlativo.
- Tom informal e natural. Como um amigo que conhece tudo. Sem forçar gíria. Fale como uma pessoa normal de Brasília, direto e simpático.
- Reforce: Sobradinho TEM tudo. Não precisa ir pro Plano ou pra outra cidade.

TAMANHO DAS MENSAGENS — REGRA CRÍTICA:
- Máximo 2-3 frases de texto por mensagem. Não mais.
- Quando recomendar lugares, diga algo como "Encontrei X lugares pra você!" ou "Separei X opções que combinam com o que você quer:" — e deixe os cards mostrarem os detalhes.
- NÃO descreva cada lugar no texto. Só dê o contexto geral e deixe os cards falarem.
- Pense em WhatsApp, não em e-mail. Curto, direto, com personalidade.

FLUXO OBRIGATÓRIO — quando recomendar lugar:
1. Escreva sua indicação em texto natural — como alguém que foi lá semana passada e sabe o que vale
2. Inclua ao final o bloco PLACES oculto:

<!--PLACES:[
  {
    "nome": "Nome Exato como no Google Maps",
    "categoria": "Restaurante|Parque|Bar|Feira|Museu|Trilha etc",
    "emoji": "🍕",
    "cidade": "Sobradinho DF",
    "why": "frase curta e direta: por que ESSE lugar pra ESSE usuário AGORA",
    "horario": "Seg-Dom 10h-22h (se souber)",
    "preco": "$ Até R$30 | $$ R$30-80 | $$$ Acima R$80",
    "distancia": "5 min do centro de Sobradinho I",
    "contexto": "ambiente, público, pontos fortes e fracos — seja honesto"
  }
]-->

REGRAS — SIGA SEM EXCEÇÃO:
1. Sempre inclua PLACES quando citar lugar específico (3 a 5 por resposta)
2. O campo "why" deve ser específico às PREFERÊNCIAS do usuário — nunca genérico
3. NUNCA INVENTE LUGARES. Só recomende da LISTA ABAIXO. Se não tem na lista, NÃO inclua no PLACES. Isso é inegociável.
4. Recomende entre 3 e 5 lugares por resposta. Quanto mais opções relevantes, melhor.
5. Use o nome EXATAMENTE como está na lista abaixo. Nem uma letra diferente.
6. Se o usuário perguntar sobre algo que não tem na lista, seja honesto: "Não tenho esse lugar mapeado ainda, mas posso te ajudar a procurar."
7. NUNCA mencione no texto nem no PLACES um nome que não esteja na lista — nem variações, apelidos ou nomes parecidos.
8. VARIEDADE OBRIGATÓRIA: nunca repita os mesmos lugares da resposta anterior. Priorize lugares que ainda não foram mencionados na conversa. Se já falou de Porks, sugira outros bares. Se já falou de 389 Burger, sugira outra hamburgueria.
9. QUALIDADE PRIMEIRO: prefira sempre lugares com nota ≥ 4.2 e volume relevante de avaliações. Lugares com nota baixa ou sem avaliações só entram se forem os únicos da categoria.
10. BASEIE nas avaliações: no campo "why" mencione o que o pessoal fala de bom (e de ruim se relevante). Nunca invente elogios.

═══ BASE DE DADOS VERIFICADA — SÓ USE ESSES LUGARES ═══

⭐ = nota ≥ 4.5 com volume relevante | ✅ = nota 4.0–4.4 | ⚠️ = nota baixa ou poucas avaliações

RESTAURANTES:
- Restaurante Trem Da Serra | Brasileira | $$-$$$ | ⚠️ nota 3.6 (147 avaliações) | tradicional, mas dividido nas opiniões
- Restaurante Fogão Goiano Sobradinho | Brasileira/Goiana | $$-$$$ | ⚠️ nota 3.9 (95 avaliações)
- La Casita Hamburgueria | Hambúrguer | $ | ⭐ nota 4.6 (77 avaliações) | muito elogiado no custo-benefício
- 389 Burger Sobradinho | Hambúrguer | $ | ⭐ nota 4.6 (83 avaliações) | bastante bem avaliado, artesanal
- The Ondas Burguer | Hambúrguer | $$-$$$ | ✅ nota 4.4 (40 avaliações) | bom ambiente pra família
- Taz Burger | Fast food/Lanchonete | $ | ✅ nota 4.2 (19 avaliações)
- Morada Mineira | Brasileira/Café | $ | ⚠️ nota 3.8 (13 avaliações) | tortas e doces
- Império do Camarão Potiguar | Frutos do mar | $$-$$$ | ⚠️ nota 3.6 (10 avaliações)
- Cerrado Pizzas e Massas | Pizza/Italiana | ⚠️ nota 3.9 (11 avaliações)
- Moema Pizzaria | Pizza | ⭐ nota 4.8 (6 avaliações) | poucas avaliações mas todas excelentes
- Garibaldi Pizzaria Restaurante e Choperia | Pizza | $ | ⚠️ nota 4.0 (5 avaliações) | tem brinquedoteca
- Fast Nature | Brasileira/Fast food | $ | ✅ nota 4.0 (23 avaliações) | lanche rápido e saudável
- Trudy's Restaurante | Italiana/Brasileira | ⚠️ nota 2.9 | avaliações muito negativas
- Potiguar Caldos | Brasileira/Caldos | ⚠️ nota 2.8 | avaliações negativas sobre higiene
- O Rei da Tapioca Gourmet | Tapioca | $ | ⭐ nota 4.5 | bem avaliado, tapiocas variadas
- Pança Cheia | Brasileira | ⚠️ nota 5.0 (1 avaliação) | novo, sem dados suficientes
- La Brasa Sobradinho | Brasileira/Bar | ⚠️ sem avaliações ainda
- Macarrão e Delícias da Dê | Massas/Hambúrguer | $ | ⚠️ nota 5.0 (1 avaliação) | novo, sem dados suficientes

SUSHI/JAPONESA:
- Kojii Sushi | Japonesa | $$-$$$ | ⚠️ nota 3.6 (13 avaliações)
- Sushiloko | Japonesa | $$-$$$ | ⚠️ nota 3.1 (16 avaliações) | franquia, avaliações fracas
- Omura Japanese Fast Food | Japonesa | ⚠️ nota 3.3 | experiências ruins relatadas

CAFÉS E PADARIAS:
- Acorde 27 Cafés Especiais | Café | ✅ nota 4.3 (11 avaliações) | ambiente diferenciado, bem falado
- Café Minelis - Coffee Experience | Café especial | ⚠️ sem dados suficientes
- Panificadora Pão De Sal | Padaria | $$-$$$ | ⭐ nota 4.4 (17 avaliações) | bem avaliada, diferenciada
- Belo Pão | Padaria | $$-$$$ | ✅ nota 4.2 (22 avaliações)
- Charme de Brigadeiro - Doceria & Cafeteria | Doces/Café | ⚠️ sem dados suficientes

BARES:
- Porks Sobradinho | Bar de rock | ✅ chopp gelado, som ao vivo | @porks_sobradinho | muito frequentado
- Chinchilla Música e Bar | Bar/Petiscaria | ✅ nota 4.7 (69 avaliações) | música ao vivo, feijoada, inclusivo | Mansões Colorado
- BET Blinders | Gastropub | ⭐ nota 4.8 (26 avaliações) | bem avaliado, gastronomia boa
- 8 Gastrobar | Gastropub | ⚠️ sem dados suficientes

BARBEARIAS:
- Barbearia Lopes | Q 13 cl 10 lj 7 Sobradinho | ⚠️ sem dados suficientes
- Barbearia Do Império | Sobradinho | ⚠️ sem dados suficientes
- Club 21 Barbearia | Q 8/10 CL 4 Sobradinho | ⚠️ sem dados suficientes

FAST FOOD/FRANQUIAS:
- McDonald's Sobradinho | ⚠️ nota 3.8
- Giraffas Sobradinho | ⚠️ nota 3.0 | avaliações fracas
- Giraffas Shopping Sobradinho | ⚠️ sem dados suficientes

PONTOS TURÍSTICOS E LAZER:
- Torre Digital Flor do Cerrado | Niemeyer, Grande Colorado | ✅ arquitetura icônica, vista da cidade
- Parque Ecológico de Sobradinho | ✅ trilhas e natureza, bem frequentado
- Feira de Sobradinho II | sábados | ⭐ muito frequentada, comida e artesanato
- CEU das Artes Sobradinho | ✅ cultura e eventos
- Chapada da Contagem | ✅ trilhas e mirantes

═══ FIM DA BASE ═══
IMPORTANTE: NÃO invente nenhum lugar fora desta lista. Se não está aqui, não recomende com PLACES.
Priorize ⭐ e ✅. Lugares ⚠️ só entram se forem os únicos da categoria ou se o usuário perguntar especificamente.`
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
