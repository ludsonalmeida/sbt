import { useState, useCallback } from 'react'
import { useAuthStore } from './store/authStore'
import { Onboarding } from './components/Onboarding'
import { ChatWindow } from './components/ChatWindow'
import { Sidebar, EstabelecimentosView, NoticiasView, HistoriaView, PerfilView, type SidebarView } from './components/Sidebar'

// ── Ícones inline ────────────────────────────────────
function IconMail() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="16" height="12" rx="2"/>
      <path d="M2 7l8 5 8-5"/>
    </svg>
  )
}
function IconLock() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="9" width="12" height="9" rx="2"/>
      <path d="M7 9V6a3 3 0 0 1 6 0v3"/>
    </svg>
  )
}
function IconUser() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="7" r="3"/>
      <path d="M3 18c0-4 3-6 7-6s7 2 7 6"/>
    </svg>
  )
}
function IconPin() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 18s-7-6.5-7-11a7 7 0 1 1 14 0c0 4.5-7 11-7 11z"/>
      <circle cx="10" cy="7" r="2.5"/>
    </svg>
  )
}

// ── Skyline SVG ──────────────────────────────────────
function SkylineSVG() {
  return (
    <svg
      viewBox="0 0 800 120"
      preserveAspectRatio="xMidYMax slice"
      className="w-full"
      aria-hidden="true"
    >
      {/* Cidade de Sobradinho — silhueta abstrata */}
      <g fill="rgba(26,26,24,0.13)">
        {/* Torre Digital (referência) */}
        <rect x="55" y="38" width="12" height="82"/>
        <rect x="49" y="48" width="24" height="5" rx="2"/>
        <rect x="52" y="20" width="18" height="22" rx="1"/>
        <circle cx="61" cy="16" r="5"/>
        {/* Casas e prédios */}
        <rect x="0" y="70" width="45" height="50"/>
        <rect x="5" y="58" width="35" height="15" rx="1"/>
        <rect x="80" y="60" width="55" height="60"/>
        <rect x="88" y="48" width="40" height="16" rx="1"/>
        <rect x="145" y="75" width="35" height="45"/>
        <rect x="148" y="65" width="29" height="14" rx="1"/>
        <rect x="190" y="50" width="70" height="70"/>
        <rect x="198" y="38" width="54" height="16" rx="1"/>
        <rect x="270" y="68" width="40" height="52"/>
        <rect x="320" y="45" width="60" height="75"/>
        <rect x="328" y="30" width="44" height="19" rx="1"/>
        <rect x="390" y="72" width="50" height="48"/>
        <rect x="450" y="55" width="45" height="65"/>
        <rect x="458" y="40" width="29" height="19" rx="1"/>
        <rect x="505" y="65" width="55" height="55"/>
        <rect x="512" y="50" width="40" height="18" rx="1"/>
        <rect x="570" y="40" width="65" height="80"/>
        <rect x="578" y="24" width="49" height="20" rx="1"/>
        <rect x="645" y="68" width="40" height="52"/>
        <rect x="695" y="55" width="50" height="65"/>
        <rect x="703" y="42" width="34" height="17" rx="1"/>
        <rect x="755" y="72" width="45" height="48"/>
        {/* Colinas / cerrado ao fundo */}
        <ellipse cx="200" cy="120" rx="220" ry="55" opacity="0.4"/>
        <ellipse cx="600" cy="120" rx="260" ry="60" opacity="0.3"/>
      </g>
    </svg>
  )
}

// ── Logo ─────────────────────────────────────────────
function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { sun: 26, text: 'text-base', sub: 'text-[10px]' },
    md: { sun: 36, text: 'text-xl', sub: 'text-xs' },
    lg: { sun: 44, text: 'text-2xl sm:text-3xl', sub: 'text-sm' },
  }
  const s = sizes[size]
  return (
    <div className="flex items-center gap-3">
      <div
        className="rounded-2xl bg-[rgba(26,26,24,0.15)] flex items-center justify-center flex-shrink-0"
        style={{ width: s.sun, height: s.sun }}
      >
        <svg width={s.sun * 0.58} height={s.sun * 0.58} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" fill="#1A1A18"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
            stroke="#1A1A18" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <p className={`font-head font-extrabold ${s.text} text-[#1A1A18] leading-tight`}>
          Sobradinho TEM!
        </p>
        <p className={`${s.sub} text-[#1A1A18]/60 font-body leading-tight`}>
          Quem domina Sobradinho
        </p>
      </div>
    </div>
  )
}

// ── App ──────────────────────────────────────────────
export default function App() {
  const { user, accessToken, setUser, logout } = useAuthStore()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', bairro: '' })
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao fazer login')
      setUser(data.user, data.accessToken)
      if (!data.user.onboardingDone) setShowOnboarding(true)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(registerForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar')
      setUser(data.user, data.accessToken)
      setShowOnboarding(true)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  // ── Onboarding overlay ──────────────────────────────
  if (showOnboarding && user) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  // ── Sidebar state ────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeView, setActiveView] = useState<SidebarView>('chat')
  const [pendingChatQuery, setPendingChatQuery] = useState<string | null>(null)

  const handleAskChat = useCallback((query: string) => {
    setPendingChatQuery(query)
    setActiveView('chat')
  }, [])

  const consumePendingQuery = useCallback(() => {
    const q = pendingChatQuery
    setPendingChatQuery(null)
    return q
  }, [pendingChatQuery])

  // ── Logado ──────────────────────────────────────────
  if (user && accessToken) {
    return (
      <div className="min-h-dvh flex bg-fundo">
        {/* Sidebar */}
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeView={activeView}
          onNavigate={setActiveView}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="bg-sol sticky top-0 z-30 shadow-sm safe-top">
            <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setSidebarOpen(o => !o)}
                  className="w-8 h-8 rounded-lg bg-[rgba(26,26,24,0.1)] hover:bg-[rgba(26,26,24,0.18)]
                             flex items-center justify-center transition-colors flex-shrink-0"
                  aria-label="Menu"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A18" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M4 7h16M4 12h16M4 17h16"/>
                  </svg>
                </button>
                <Logo size="sm" />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-[#1A1A18]/60 font-body hidden sm:block">
                  {user.name.split(' ')[0]}
                </span>
                <button
                  onClick={() => logout()}
                  className="text-[11px] font-semibold text-[#1A1A18]/60 bg-[rgba(26,26,24,0.1)]
                             hover:bg-[rgba(26,26,24,0.18)] px-2.5 py-1 rounded-full transition-colors"
                >
                  Sair
                </button>
              </div>
            </div>
          </header>

          {/* View router */}
          {activeView === 'chat' && <ChatWindow pendingQuery={consumePendingQuery} />}
          {activeView === 'estabelecimentos' && <EstabelecimentosView onAskChat={handleAskChat} />}
          {activeView === 'noticias' && <NoticiasView />}
          {activeView === 'historia' && <HistoriaView />}
          {activeView === 'perfil' && <PerfilView />}
        </div>
      </div>
    )
  }

  // ── Login / Register ────────────────────────────────
  return (
    <div className="min-h-dvh flex flex-col bg-fundo">
      {/* Hero */}
      <div className="relative bg-sol flex-shrink-0 pt-8 sm:pt-12 pb-0 overflow-hidden">
        <div className="max-w-md mx-auto px-5 pb-4 sm:pb-6 flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="text-[#1A1A18]/60 text-xs sm:text-sm mt-2 sm:mt-3 font-body max-w-[260px] sm:max-w-none">
            Tudo que Sobradinho tem de melhor — indicado por quem realmente conhece.
          </p>
        </div>
        {/* Skyline */}
        <div className="w-full overflow-hidden leading-none">
          <SkylineSVG />
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 bg-fundo -mt-1">
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="card p-6 shadow-card-hover">
            {/* Tab switcher */}
            <div className="flex mb-6 bg-areia rounded-xl p-1 gap-1">
              <button
                onClick={() => { setMode('login'); setError('') }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all font-head ${
                  mode === 'login'
                    ? 'bg-white text-[#1A1A18] shadow-sm'
                    : 'text-muted hover:text-[#1A1A18]'
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => { setMode('register'); setError('') }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all font-head ${
                  mode === 'register'
                    ? 'bg-white text-[#1A1A18] shadow-sm'
                    : 'text-muted hover:text-[#1A1A18]'
                }`}
              >
                Cadastrar
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-5 flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="flex-shrink-0 mt-0.5 stroke-red-500" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="10" cy="10" r="8"/>
                  <path d="M10 6v4M10 13.5v.5"/>
                </svg>
                {error}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="input-icon">
                  <span className="icon"><IconMail /></span>
                  <input
                    type="email"
                    placeholder="Seu e-mail"
                    required
                    value={loginForm.email}
                    onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                    className="input-base pl-10"
                  />
                </div>
                <div className="input-icon">
                  <span className="icon"><IconLock /></span>
                  <input
                    type="password"
                    placeholder="Sua senha"
                    required
                    value={loginForm.password}
                    onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                    className="input-base pl-10"
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-sol w-full py-3.5 mt-2 font-head font-bold text-base">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#1A1A18]/30 border-t-[#1A1A18] rounded-full animate-spin"/>
                      Entrando...
                    </span>
                  ) : 'Entrar'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="input-icon">
                  <span className="icon"><IconUser /></span>
                  <input
                    type="text"
                    placeholder="Nome completo"
                    required
                    value={registerForm.name}
                    onChange={e => setRegisterForm(p => ({ ...p, name: e.target.value }))}
                    className="input-base pl-10"
                  />
                </div>
                <div className="input-icon">
                  <span className="icon"><IconMail /></span>
                  <input
                    type="email"
                    placeholder="Seu e-mail"
                    required
                    value={registerForm.email}
                    onChange={e => setRegisterForm(p => ({ ...p, email: e.target.value }))}
                    className="input-base pl-10"
                  />
                </div>
                <div className="input-icon">
                  <span className="icon"><IconLock /></span>
                  <input
                    type="password"
                    placeholder="Senha (min. 6 caracteres)"
                    required
                    minLength={6}
                    value={registerForm.password}
                    onChange={e => setRegisterForm(p => ({ ...p, password: e.target.value }))}
                    className="input-base pl-10"
                  />
                </div>
                <div className="input-icon">
                  <span className="icon"><IconPin /></span>
                  <input
                    type="text"
                    placeholder="Bairro (opcional)"
                    value={registerForm.bairro}
                    onChange={e => setRegisterForm(p => ({ ...p, bairro: e.target.value }))}
                    className="input-base pl-10"
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-sol w-full py-3.5 mt-2 font-head font-bold text-base">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#1A1A18]/30 border-t-[#1A1A18] rounded-full animate-spin"/>
                      Cadastrando...
                    </span>
                  ) : 'Criar conta'}
                </button>
              </form>
            )}

            <p className="text-center text-xs text-muted/70 mt-5 font-body">
              Guia local de Sobradinho-DF · Feito pela comunidade
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
