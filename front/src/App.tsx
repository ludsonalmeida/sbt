import { useState } from 'react'
import { useAuthStore } from './store/authStore'
import { Onboarding } from './components/Onboarding'

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

  // ── Onboarding overlay ──────────────────────
  if (showOnboarding && user) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  // ── Logado ──────────────────────────────────
  if (user && accessToken) {
    return (
      <div className="min-h-screen bg-fundo">
        <header className="bg-white border-b border-borda px-6 py-4 flex items-center justify-between">
          <h1 className="font-head font-black text-xl">Sobradinho TEM! <span className="text-2xl">🌇</span></h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">Oi, {user.name.split(' ')[0]}!</span>
            <button onClick={() => logout()} className="text-sm text-muted hover:text-sol transition-colors">Sair</button>
          </div>
        </header>
        <main className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-2xl border border-borda p-8 text-center">
            <div className="text-5xl mb-4">🌇</div>
            <h2 className="font-head font-black text-2xl mb-2">Bem-vindo ao Sobradinho TEM!</h2>
            <p className="text-muted text-sm leading-relaxed mb-6">
              Seu guia local inteligente de Sobradinho-DF. Em breve: chat com IA, recomendações personalizadas e muito mais.
            </p>
            {user.preferences && (
              <div className="text-left bg-fundo rounded-xl p-4">
                <p className="text-xs font-semibold text-muted mb-2">Suas preferências:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(user.preferences as Record<string, number>)
                    .filter(([, v]) => v > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([k, v]) => (
                      <span key={k} className="bg-laranja-claro text-sol text-xs font-semibold px-3 py-1 rounded-full">
                        {k} {Math.round(v * 100)}%
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ── Login / Register ────────────────────────
  return (
    <div className="min-h-screen bg-fundo flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-sol p-8 text-center">
          <h1 className="font-head font-black text-3xl text-[#1A1A18]">Sobradinho TEM! 🌇</h1>
          <p className="text-[#1A1A18]/70 text-sm mt-1">Guia local inteligente de Sobradinho-DF</p>
        </div>

        <div className="p-8">
          <div className="flex mb-6 bg-fundo rounded-xl p-1">
            <button
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'login' ? 'bg-white shadow-sm' : 'text-muted'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setMode('register'); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'register' ? 'bg-white shadow-sm' : 'text-muted'}`}
            >
              Cadastrar
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email" placeholder="E-mail" required
                value={loginForm.email}
                onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-borda focus:border-sol focus:outline-none text-sm"
              />
              <input
                type="password" placeholder="Senha" required
                value={loginForm.password}
                onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-borda focus:border-sol focus:outline-none text-sm"
              />
              <button type="submit" disabled={loading} className="btn-sol w-full py-3 font-head font-black">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <input
                type="text" placeholder="Nome completo" required
                value={registerForm.name}
                onChange={e => setRegisterForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-borda focus:border-sol focus:outline-none text-sm"
              />
              <input
                type="email" placeholder="E-mail" required
                value={registerForm.email}
                onChange={e => setRegisterForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-borda focus:border-sol focus:outline-none text-sm"
              />
              <input
                type="password" placeholder="Senha (min 6 caracteres)" required minLength={6}
                value={registerForm.password}
                onChange={e => setRegisterForm(p => ({ ...p, password: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-borda focus:border-sol focus:outline-none text-sm"
              />
              <input
                type="text" placeholder="Bairro (opcional)"
                value={registerForm.bairro}
                onChange={e => setRegisterForm(p => ({ ...p, bairro: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-borda focus:border-sol focus:outline-none text-sm"
              />
              <button type="submit" disabled={loading} className="btn-sol w-full py-3 font-head font-black">
                {loading ? 'Cadastrando...' : 'Cadastrar'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
