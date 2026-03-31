import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { buildSystemPrompt, parseAiResponse, type Message, type PlaceData } from '../services/chatService'
import { PlaceCard } from './PlaceCard'

// ── Avatar do bot ─────────────────────────────────────
function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-cerrado flex-shrink-0 flex items-center justify-center shadow-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4" fill="white"/>
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"
          stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

// ── Sugestões ─────────────────────────────────────────
const SUGESTOES = [
  { texto: 'Onde almoçar hoje?', emoji: '🍽️' },
  { texto: 'Trilha pra fim de semana', emoji: '🥾' },
  { texto: 'Bar pra assistir o jogo', emoji: '⚽' },
  { texto: 'Passeio com criança', emoji: '👨‍👩‍👧' },
]

// ── Typing indicator ──────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 bg-sol rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

// ── ChatWindow ────────────────────────────────────────
export function ChatWindow({ pendingQuery, onRequireLogin }: { pendingQuery?: () => string | null; onRequireLogin?: () => void }) {
  const { user, accessToken, refreshToken } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Handle pending queries from sidebar navigation
  useEffect(() => {
    if (!pendingQuery) return
    const q = pendingQuery()
    if (q && !loading && !sendingRef.current) {
      // Use setTimeout to avoid React StrictMode double-fire
      const t = setTimeout(() => send(q), 0)
      return () => clearTimeout(t)
    }
  }, [pendingQuery])

  const systemPrompt = buildSystemPrompt({
    userName: user?.name,
    bairro: user?.bairro ?? undefined,
    preferences: user?.preferences ?? undefined,
  })

  async function send(text?: string) {
    const msgText = (text ?? input).trim()
    if (!msgText || loading || sendingRef.current) return

    // Require login to chat
    if (!accessToken) {
      onRequireLogin?.()
      return
    }

    sendingRef.current = true

    const userMsg: Message = { role: 'user', content: msgText, timestamp: new Date() }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)
    inputRef.current?.focus()

    try {
      const payload = {
        systemPrompt,
        messages: history.map(m => ({ role: m.role, content: m.content })),
      }

      let token = accessToken
      let res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      // Token expirado → refresh e retry
      if (res.status === 401) {
        const ok = await refreshToken()
        if (ok) {
          token = useAuthStore.getState().accessToken ?? token
          res = await fetch('/api/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            credentials: 'include',
            body: JSON.stringify(payload),
          })
        }
      }

      const data = await res.json()
      const { text: replyText, places } = parseAiResponse(data.text)
      const botMsg: Message = { role: 'assistant', content: replyText, places, timestamp: new Date() }
      setMessages(prev => [...prev, botMsg])

      // Enriquecer lugares com dados reais do Google Maps via Apify
      if (places.length > 0) {
        const ids = new Set(places.map(p => p.id))
        setEnrichingIds(prev => new Set([...prev, ...ids]))

        fetch('/api/places/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
          credentials: 'include',
          body: JSON.stringify({ places: places.map(p => ({ nome: p.nome, cidade: p.cidade ?? 'Sobradinho DF' })) }),
        })
          .then(r => r.json())
          .then(enriched => {
            setMessages(prev => prev.map(m => {
              if (!m.places) return m
              return {
                ...m,
                places: m.places.map(p => {
                  if (enriched[p.nome]) return { ...p, enriched: enriched[p.nome] }
                  // Not returned = possibly closed or not found. Mark but keep.
                  return { ...p, _notFound: true } as any
                }),
              }
            }))
          })
          .catch(err => console.warn('[enrich]', err))
          .finally(() => setEnrichingIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next }))
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Eita, tive um problema técnico. Tenta de novo! 😅',
        timestamp: new Date(),
      }])
    }
    setLoading(false)
    sendingRef.current = false
  }

  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <div className="flex flex-col flex-1 h-[calc(100dvh-48px)]">
      {/* ── Mensagens ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-5">

          {/* Empty state */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 rounded-3xl bg-sol mx-auto mb-4 flex items-center justify-center shadow-card">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4.5" fill="#1A1A18"/>
                  <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"
                    stroke="#1A1A18" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="font-head font-extrabold text-xl mb-1">
                {firstName ? `Oi, ${firstName}!` : 'E aí! Bem-vindo!'}
              </p>
              <p className="text-muted text-sm leading-relaxed max-w-xs mx-auto">
                Conheço cada esquina de Sobradinho. Me pergunta onde ir, o que comer, o que fazer — e te digo o que é de verdade bom.
              </p>

              {/* Sugestões */}
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {SUGESTOES.map(s => (
                  <button
                    key={s.texto}
                    onClick={() => send(s.texto)}
                    className="chip flex items-center gap-1.5"
                  >
                    <span>{s.emoji}</span>
                    <span>{s.texto}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Mensagens */}
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && <BotAvatar />}

                <div className={`max-w-[88%] sm:max-w-[82%] space-y-2.5 sm:space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={msg.role === 'user' ? 'bubble-user' : 'bubble-bot'}>
                    {msg.content}
                  </div>

                  {msg.places && msg.places.length > 0 && (() => {
                    const anyEnriching = msg.places.some(p => enrichingIds.has(p.id))
                    const anyEnriched = msg.places.some(p => p.enriched)
                    const showCards = !anyEnriching || anyEnriched
                    return (
                      <div className="space-y-2.5 w-full">
                        {/* Loading state while fetching real data */}
                        {anyEnriching && !anyEnriched && (
                          <div className="bg-white rounded-2xl border border-borda/60 p-4"
                               style={{ boxShadow: '0 2px 12px rgba(26,26,24,0.08)' }}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-sol/20 flex items-center justify-center flex-shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D98C0F" strokeWidth="2" strokeLinecap="round" className="animate-spin">
                                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#1A1A18]">Buscando os melhores lugares...</p>
                                <p className="text-xs text-muted/70">Consultando avaliações, fotos e horários reais</p>
                              </div>
                            </div>
                            <div className="mt-3 space-y-2 animate-pulse">
                              {msg.places!.map((p: PlaceData) => (
                                <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-areia/60 rounded-xl">
                                  <span className="text-base">{p.emoji}</span>
                                  <span className="text-xs font-medium text-muted">{p.nome}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Show cards once done loading */}
                        {showCards && (() => {
                          const found = msg.places!.filter((p: any) => !p._notFound)
                          const notFound = msg.places!.filter((p: any) => p._notFound)
                          return (
                            <>
                              {found.length > 0 && (
                                <div className="flex items-center gap-2 px-1 py-1">
                                  <div className="w-6 h-6 rounded-lg bg-cerrado/15 flex items-center justify-center flex-shrink-0">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A7C59" strokeWidth="2.5" strokeLinecap="round">
                                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                                    </svg>
                                  </div>
                                  <p className="text-xs font-semibold text-cerrado">
                                    {found.length === 1 ? 'Encontrei 1 lugar pra você' : `Encontrei ${found.length} lugares pra você`}
                                  </p>
                                </div>
                              )}
                              {found.map((p: PlaceData) => (
                                <PlaceCard key={p.id} place={p} loading={enrichingIds.has(p.id)} />
                              ))}
                              {notFound.map((p: PlaceData) => (
                                <PlaceCard key={p.id} place={p} loading={false} />
                              ))}
                            </>
                          )
                        })()}
                      </div>
                    )
                  })()}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2.5 justify-start"
            >
              <BotAvatar />
              <div className="bg-white border border-borda rounded-2xl rounded-bl-sm shadow-card">
                <TypingDots />
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input ───────────────────────────────────── */}
      <div className="border-t border-borda bg-white safe-bottom">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex gap-2 items-center bg-areia rounded-2xl px-3 sm:px-4 py-2 focus-within:ring-2 focus-within:ring-sol/40 transition-all">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Pergunta sobre Sobradinho..."
              className="flex-1 bg-transparent text-[15px] sm:text-sm outline-none placeholder:text-muted/60 py-1 font-body"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Enviar"
              className="w-9 h-9 rounded-xl bg-sol flex items-center justify-center flex-shrink-0
                         transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ minWidth: 36 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A18" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
