import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore, PREFERENCE_CATEGORIES, type Preferences } from '../store/authStore'

// ── Tipos ──────────────────────────────────────────────

type Step = 'welcome' | 'gostos' | 'intensidade' | 'canais' | 'done'

interface Props {
  onComplete: () => void
  isOwner?: boolean
}

// ── Componente ─────────────────────────────────────────

export function Onboarding({ onComplete, isOwner = false }: Props) {
  const { user, updatePreferences, updateOptIn } = useAuthStore()

  const [step, setStep] = useState<Step>('welcome')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [weights, setWeights] = useState<Preferences>({})
  const [acceptEmail, setAcceptEmail] = useState(false)
  const [acceptWhatsapp, setAcceptWhatsapp] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── handlers ───────────────────────────────────────

  function toggleCategory(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key); } else { next.add(key) }
      return next
    })
  }

  function setWeight(key: string, val: number) {
    setWeights((p) => ({ ...p, [key]: val }))
  }

  async function finish() {
    setSaving(true)

    // montar preferências: selecionados ganham peso, não selecionados ficam 0
    const prefs: Preferences = {}
    PREFERENCE_CATEGORIES.forEach(({ key }) => {
      if (selected.has(key)) prefs[key] = weights[key] ?? 0.5
      else prefs[key] = 0
    })

    try {
      await fetch('/api/users/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: prefs, acceptEmail, acceptWhatsapp }),
      })
      updatePreferences(prefs)
      updateOptIn(acceptEmail, acceptWhatsapp)
    } catch (e) {
      console.error(e)
    }

    setSaving(false)
    setStep('done')
    setTimeout(onComplete, 1200)
  }

  // ── Renderização por step ──────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(26,26,24,0.6)] flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        >
          {/* ── WELCOME ────────────────────────────── */}
          {step === 'welcome' && (
            <div className="p-8 text-center">
              <div className="text-5xl mb-4">🌇</div>
              <h2 className="font-head text-3xl font-black mb-2">
                {isOwner ? 'Bem-vindo, parceiro!' : `Oi, ${user?.name?.split(' ')[0]}!`}
              </h2>
              <p className="text-muted text-sm mb-8 leading-relaxed">
                {isOwner
                  ? 'Vamos cadastrar seu estabelecimento e conectar você à comunidade de Sobradinho.'
                  : 'Me conta um pouco sobre você pra eu poder indicar exatamente o que Sobradinho TEM de melhor pra você.'}
              </p>
              <button onClick={() => setStep('gostos')} className="btn-sol w-full py-4 text-base font-head font-black">
                Vamos lá 🚀
              </button>
            </div>
          )}

          {/* ── GOSTOS ────────────────────────────── */}
          {step === 'gostos' && (
            <div className="p-8">
              <ProgressBar current={1} total={3} />
              <h3 className="font-head text-xl font-bold mb-1">O que você curte?</h3>
              <p className="text-muted text-sm mb-6">Selecione tudo que te interessa (pode ser mais de um)</p>
              <div className="grid grid-cols-2 gap-3 mb-8">
                {PREFERENCE_CATEGORIES.map(({ key, label, emoji, desc }) => (
                  <button
                    key={key}
                    onClick={() => toggleCategory(key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selected.has(key)
                        ? 'border-sol bg-laranja-claro'
                        : 'border-borda bg-white hover:border-sol/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">{emoji}</div>
                    <div className="font-semibold text-sm">{label}</div>
                    <div className="text-xs text-muted mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('welcome')} className="btn-outline flex-1 py-3">← Voltar</button>
                <button
                  onClick={() => setStep('intensidade')}
                  disabled={selected.size === 0}
                  className="btn-sol flex-1 py-3 disabled:opacity-40"
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* ── INTENSIDADE ───────────────────────── */}
          {step === 'intensidade' && (
            <div className="p-8">
              <ProgressBar current={2} total={3} />
              <h3 className="font-head text-xl font-bold mb-1">Quanto você curte cada um?</h3>
              <p className="text-muted text-sm mb-6">Arrasta pra dizer o quanto isso é prioridade pra você</p>
              <div className="space-y-5 mb-8">
                {PREFERENCE_CATEGORIES.filter(({ key }) => selected.has(key)).map(({ key, label, emoji }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{emoji} {label}</span>
                      <span className="text-xs text-muted font-semibold">
                        {weightLabel(weights[key] ?? 0.5)}
                      </span>
                    </div>
                    <input
                      type="range" min="0" max="1" step="0.1"
                      value={weights[key] ?? 0.5}
                      onChange={(e) => setWeight(key, parseFloat(e.target.value))}
                      className="w-full accent-sol"
                    />
                    <div className="flex justify-between text-[10px] text-muted mt-1">
                      <span>Pouco</span><span>Muito</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('gostos')} className="btn-outline flex-1 py-3">← Voltar</button>
                <button onClick={() => setStep('canais')} className="btn-sol flex-1 py-3">Continuar →</button>
              </div>
            </div>
          )}

          {/* ── CANAIS ────────────────────────────── */}
          {step === 'canais' && (
            <div className="p-8">
              <ProgressBar current={3} total={3} />
              <h3 className="font-head text-xl font-bold mb-1">Posso te mandar dicas?</h3>
              <p className="text-muted text-sm mb-6">
                Quando tiver algo novo que combine com você em Sobradinho, posso avisar. Sem spam — só o que for relevante.
              </p>

              <div className="space-y-4 mb-8">
                <OptInCard
                  icon="📧"
                  title="E-mail"
                  desc="Recomendações semanais personalizadas e novidades da cidade"
                  checked={acceptEmail}
                  onChange={setAcceptEmail}
                />
                <OptInCard
                  icon="💬"
                  title="WhatsApp"
                  desc="Alertas rápidos: eventos, promoções e novidades perto de você"
                  checked={acceptWhatsapp}
                  onChange={setAcceptWhatsapp}
                />
              </div>

              <p className="text-[11px] text-muted text-center mb-5">
                Você pode mudar isso quando quiser nas configurações. Sem pressão.
              </p>

              <div className="flex gap-3">
                <button onClick={() => setStep('intensidade')} className="btn-outline flex-1 py-3">← Voltar</button>
                <button onClick={finish} disabled={saving} className="btn-sol flex-1 py-3 font-head font-black">
                  {saving ? 'Salvando...' : 'Pronto! 🎉'}
                </button>
              </div>
            </div>
          )}

          {/* ── DONE ─────────────────────────────── */}
          {step === 'done' && (
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="text-6xl mb-4"
              >
                🎊
              </motion.div>
              <h2 className="font-head text-2xl font-black mb-2">Tudo certo!</h2>
              <p className="text-muted text-sm">
                Agora é só perguntar o que Sobradinho TEM — as dicas já vão ser pra você!
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6">
      <div className="flex gap-1.5 mb-2">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${i < current ? 'bg-sol' : 'bg-borda'}`}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted">Passo {current} de {total}</p>
    </div>
  )
}

function OptInCard({
  icon, title, desc, checked, onChange,
}: {
  icon: string; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
        checked ? 'border-cerrado bg-verde-claro' : 'border-borda bg-white hover:border-cerrado/40'
      }`}
    >
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted mt-0.5 leading-relaxed">{desc}</div>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        checked ? 'bg-cerrado border-cerrado' : 'border-borda'
      }`}>
        {checked && <span className="text-white text-xs">✓</span>}
      </div>
    </button>
  )
}

function weightLabel(w: number): string {
  if (w <= 0.2) return 'Raramente'
  if (w <= 0.4) return 'Às vezes'
  if (w <= 0.6) return 'Moderado'
  if (w <= 0.8) return 'Bastante'
  return 'Muito!'
}
