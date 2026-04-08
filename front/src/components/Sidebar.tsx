import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'

// ── Types ────────────────────────────────────────────
export type SidebarView = 'chat' | 'estabelecimentos' | 'noticias' | 'historia' | 'perfil'

interface SidebarProps {
  open: boolean
  onClose: () => void
  activeView: SidebarView
  onNavigate: (view: SidebarView) => void
}

// ── Regiões de Sobradinho ────────────────────────────
const REGIOES = [
  { nome: 'Sobradinho I', desc: 'Centro e comércio principal' },
  { nome: 'Sobradinho II', desc: 'Maior área residencial' },
  { nome: 'Nova Colina', desc: 'Condomínios e tranquilidade' },
  { nome: 'Boa Vista', desc: 'Vista privilegiada do cerrado' },
  { nome: 'Alto da Boa Vista', desc: 'Chácaras e natureza' },
  { nome: 'Grande Colorado', desc: 'Condomínios fechados' },
  { nome: 'RK', desc: 'Lazer e eventos' },
  { nome: 'Setor de Mansões', desc: 'Alto padrão residencial' },
]

// ── Categorias de estabelecimentos ───────────────────
const CATEGORIAS_ESTAB = [
  { emoji: '🍽️', label: 'Restaurantes', slug: 'restaurantes' },
  { emoji: '🍺', label: 'Bares',        slug: 'bares' },
  { emoji: '💈', label: 'Barbearias',   slug: 'barbearias' },
  { emoji: '🛍️', label: 'Lojas',        slug: 'lojas' },
  { emoji: '🏪', label: 'Mercados',     slug: 'mercados' },
  { emoji: '💪', label: 'Academias',    slug: 'academias' },
  { emoji: '🏥', label: 'Saúde',        slug: 'saude' },
  { emoji: '🎨', label: 'Serviços',     slug: 'servicos' },
]

// ── Notícias mockadas ────────────────────────────────
const NOTICIAS = [
  {
    titulo: 'Nova ciclovia liga Sobradinho I ao II',
    tempo: '2h atrás',
    tag: 'Mobilidade',
    tagColor: 'bg-blue-100 text-blue-700',
  },
  {
    titulo: 'Festival Gastronômico do Cerrado em abril',
    tempo: '5h atrás',
    tag: 'Eventos',
    tagColor: 'bg-sol/20 text-sol-dark',
  },
  {
    titulo: 'Feira de orgânicos volta à praça central',
    tempo: '1 dia',
    tag: 'Comunidade',
    tagColor: 'bg-green-100 text-green-700',
  },
  {
    titulo: 'Obras na DF-150 alteram trânsito na região',
    tempo: '2 dias',
    tag: 'Trânsito',
    tagColor: 'bg-red-100 text-red-700',
  },
  {
    titulo: 'Novo parque ecológico em Alto da Boa Vista',
    tempo: '3 dias',
    tag: 'Natureza',
    tagColor: 'bg-emerald-100 text-emerald-700',
  },
]

// ── Nav Items ────────────────────────────────────────
const NAV_ITEMS: { id: SidebarView; label: string; icon: JSX.Element }[] = [
  {
    id: 'chat',
    label: 'Explorar',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    id: 'estabelecimentos',
    label: 'Estabelecimentos',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'noticias',
    label: 'Notícias',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
      </svg>
    ),
  },
  {
    id: 'historia',
    label: 'História',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/>
      </svg>
    ),
  },
  {
    id: 'perfil',
    label: 'Meu Perfil',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M5 21c0-5 3-7 7-7s7 2 7 7"/>
      </svg>
    ),
  },
]

// ── Sidebar Component ────────────────────────────────
export function Sidebar({ open, onClose, activeView, onNavigate }: SidebarProps) {
  const { user } = useAuthStore()
  const [activeRegiao, setActiveRegiao] = useState<string | null>(null)

  function handleNav(view: SidebarView) {
    onNavigate(view)
    // Close on mobile after nav
    if (window.innerWidth < 1024) onClose()
  }

  return (
    <>
      {/* Backdrop mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[300px] bg-white z-50 flex flex-col
                   border-r border-borda/60 shadow-xl transition-transform duration-300 ease-out
                   ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ willChange: 'transform' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-borda/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sol flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4.5" fill="#1A1A18"/>
                <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"
                  stroke="#1A1A18" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="font-head font-bold text-sm leading-tight">Sobradinho TEM!</p>
              <p className="text-[10px] text-muted/60">Quem domina Sobradinho</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-areia flex items-center justify-center transition-colors lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* User card */}
        <div
          className={`mx-3 mt-3 p-3 rounded-xl cursor-pointer transition-all ${
            activeView === 'perfil' ? 'bg-sol/15 border border-sol/30' : 'bg-areia/60 hover:bg-areia border border-transparent'
          }`}
          onClick={() => handleNav('perfil')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cerrado flex items-center justify-center text-white font-bold text-sm">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-head font-semibold text-sm truncate">{user?.name}</p>
              <p className="text-xs text-muted/70 truncate">{user?.bairro || 'Sobradinho'}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted/40 flex-shrink-0">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 mt-4 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted/50 px-3 mb-2">Navegação</p>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeView === item.id
                  ? 'bg-sol/15 text-[#1A1A18] font-semibold'
                  : 'text-muted hover:bg-areia/80 hover:text-[#1A1A18]'
              }`}
            >
              <span className={activeView === item.id ? 'text-sol-dark' : ''}>{item.icon}</span>
              {item.label}
              {item.id === 'noticias' && (
                <span className="ml-auto text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">
                  5
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-5 my-3 border-t border-borda/40" />

        {/* Regiões */}
        <div className="px-3 flex-1 overflow-y-auto sidebar-scroll">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted/50 px-3 mb-2">Regiões</p>
          <div className="space-y-0.5">
            {REGIOES.map(r => (
              <button
                key={r.nome}
                onClick={() => setActiveRegiao(activeRegiao === r.nome ? null : r.nome)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                  activeRegiao === r.nome
                    ? 'bg-cerrado/10 text-cerrado'
                    : 'text-muted/80 hover:bg-areia/60 hover:text-[#1A1A18]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-cerrado/40 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{r.nome}</p>
                  <p className="text-[10px] text-muted/50 truncate">{r.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-borda/40">
          <p className="text-[10px] text-muted/40 text-center">
            Sobradinho TEM! &middot; v2.0
          </p>
        </div>
      </aside>
    </>
  )
}

// ── Content Views ────────────────────────────────────

interface PlaceRow {
  id: string
  name: string
  category: string
  emoji?: string
  address?: string
  googleRating?: number
  googleTotal?: number
  enrichment?: {
    photo?: string
    hoursToday?: string
    mapsUrl?: string
    categoryName?: string
  } | null
}

export function EstabelecimentosView({ onAskChat }: { onAskChat: (q: string) => void }) {
  const [selected, setSelected] = useState<{ slug: string; label: string; emoji: string } | null>(null)
  const [places, setPlaces] = useState<PlaceRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Carrega contagens de cada categoria 1x ao montar
  useEffect(() => {
    let cancelled = false
    Promise.all(
      CATEGORIAS_ESTAB.map(c =>
        fetch(`/api/places?category=${c.slug}`).then(r => r.ok ? r.json() : []).catch(() => [])
      )
    ).then(results => {
      if (cancelled) return
      const map: Record<string, number> = {}
      CATEGORIAS_ESTAB.forEach((c, i) => { map[c.slug] = Array.isArray(results[i]) ? results[i].length : 0 })
      setCounts(map)
    })
    return () => { cancelled = true }
  }, [])

  // Carrega lista quando seleciona categoria
  useEffect(() => {
    if (!selected) return
    setLoading(true)
    setErr(null)
    fetch(`/api/places?category=${selected.slug}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: PlaceRow[]) => setPlaces(data))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [selected])

  // ── Lista de lugares de uma categoria ──
  if (selected) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-muted hover:text-sol-dark mb-4 inline-flex items-center gap-1"
        >
          ← Voltar
        </button>

        <div className="mb-5 flex items-center gap-3">
          <span className="text-3xl">{selected.emoji}</span>
          <div>
            <h2 className="font-head font-extrabold text-2xl">{selected.label}</h2>
            <p className="text-sm text-muted">{places.length} locais em Sobradinho</p>
          </div>
        </div>

        {loading && <p className="text-sm text-muted">Carregando…</p>}
        {err && <p className="text-sm text-red-600">Erro: {err}</p>}

        {!loading && !err && places.length === 0 && (
          <p className="text-sm text-muted">Nenhum lugar cadastrado ainda.</p>
        )}

        <div className="space-y-3">
          {places.map(p => {
            const photo = p.enrichment?.photo
            const hours = p.enrichment?.hoursToday
            const mapsUrl = p.enrichment?.mapsUrl
            return (
              <a
                key={p.id}
                href={mapsUrl ?? '#'}
                target={mapsUrl ? '_blank' : undefined}
                rel="noreferrer"
                className="card p-3 flex gap-3 hover:shadow-card-hover transition-all hover:-translate-y-0.5"
              >
                {photo ? (
                  <img src={photo} alt={p.name} loading="lazy" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-areia" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-areia flex items-center justify-center text-3xl flex-shrink-0">{p.emoji ?? '📍'}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-head font-bold text-sm leading-tight truncate">{p.name}</p>
                  {p.googleRating !== undefined && p.googleRating !== null && (
                    <p className="text-xs text-muted mt-1">
                      ⭐ {p.googleRating.toFixed(1)} {p.googleTotal ? `(${p.googleTotal})` : ''}
                    </p>
                  )}
                  {p.address && <p className="text-xs text-muted/70 mt-0.5 truncate">{p.address}</p>}
                  {hours && <p className="text-xs text-sol-dark mt-0.5">⏰ {hours}</p>}
                </div>
              </a>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Grid de categorias ──
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="font-head font-extrabold text-2xl mb-1">Estabelecimentos</h2>
        <p className="text-sm text-muted">Tudo que Sobradinho tem de melhor, organizado pra você</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIAS_ESTAB.map(cat => (
          <button
            key={cat.slug}
            onClick={() => setSelected(cat)}
            className="card p-4 hover:shadow-card-hover transition-all hover:-translate-y-0.5 text-left group"
          >
            <span className="text-2xl block mb-2">{cat.emoji}</span>
            <p className="font-head font-semibold text-sm group-hover:text-sol-dark transition-colors">{cat.label}</p>
            <p className="text-xs text-muted/60 mt-0.5">{counts[cat.slug] ?? '…'} locais</p>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="font-head font-bold text-lg mb-3">Em alta na região</h3>
        <div className="space-y-2">
          {['Melhor pizza de Sobradinho', 'Bares com música ao vivo', 'Barbearias com agendamento', 'Cafés para trabalhar'].map(q => (
            <button
              key={q}
              onClick={() => onAskChat(q)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-areia/60 hover:bg-sol/10 transition-all text-left group"
            >
              <span className="w-8 h-8 rounded-lg bg-sol/20 flex items-center justify-center flex-shrink-0 group-hover:bg-sol/30 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D98C0F" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </span>
              <span className="text-sm font-medium">{q}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto text-muted/30">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function NoticiasView() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="font-head font-extrabold text-2xl mb-1">Notícias de Sobradinho</h2>
        <p className="text-sm text-muted">O que está acontecendo na região</p>
      </div>

      <div className="space-y-3">
        {NOTICIAS.map((n, i) => (
          <div key={i} className="card p-4 hover:shadow-card-hover transition-all cursor-pointer group">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-areia flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B6B5E" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-head font-semibold text-sm group-hover:text-sol-dark transition-colors leading-snug">
                  {n.titulo}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${n.tagColor}`}>{n.tag}</span>
                  <span className="text-[10px] text-muted/50">{n.tempo}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <button className="btn-ghost text-sm">Ver mais notícias</button>
      </div>
    </div>
  )
}

export function HistoriaView() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="font-head font-extrabold text-2xl mb-1">História de Sobradinho</h2>
        <p className="text-sm text-muted">Conheça a região que a gente tanto ama</p>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <div className="card p-5 border-l-4 border-l-sol">
          <p className="text-xs font-bold text-sol-dark font-head mb-1">1960</p>
          <h3 className="font-head font-bold text-base mb-2">A fundação</h3>
          <p className="text-sm text-muted leading-relaxed">
            Sobradinho nasceu junto com Brasília, como cidade-satélite planejada para abrigar
            os trabalhadores que construíram a capital. Originalmente chamada de "Cidade Satélite
            de Sobradinho", foi uma das primeiras RAs do Distrito Federal.
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-cerrado">
          <p className="text-xs font-bold text-cerrado font-head mb-1">1990</p>
          <h3 className="font-head font-bold text-base mb-2">Sobradinho II</h3>
          <p className="text-sm text-muted leading-relaxed">
            Com o crescimento da população, surgiu Sobradinho II como expansão planejada.
            Hoje é uma das regiões mais populosas, com comércio próprio e identidade forte.
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-sol">
          <p className="text-xs font-bold text-sol-dark font-head mb-1">2000s</p>
          <h3 className="font-head font-bold text-base mb-2">Condomínios e expansão</h3>
          <p className="text-sm text-muted leading-relaxed">
            A região do Grande Colorado, Nova Colina e Alto da Boa Vista cresceram como
            polos residenciais de qualidade de vida. O cerrado preservado e a proximidade
            com a natureza atraíram famílias buscando tranquilidade.
          </p>
        </div>

        <div className="card p-5 border-l-4 border-l-cerrado">
          <p className="text-xs font-bold text-cerrado font-head mb-1">Hoje</p>
          <h3 className="font-head font-bold text-base mb-2">Polo gastronômico e cultural</h3>
          <p className="text-sm text-muted leading-relaxed">
            Sobradinho se firmou como um dos polos gastronômicos do DF, com restaurantes,
            bares e cafés que atraem gente de todo o Distrito Federal. A cena cultural
            está cada vez mais forte, com feiras, festivais e eventos comunitários.
          </p>
        </div>
      </div>

      {/* Regiões grid */}
      <div className="mt-8">
        <h3 className="font-head font-bold text-lg mb-4">Regiões que formam Sobradinho</h3>
        <div className="grid grid-cols-2 gap-3">
          {REGIOES.map(r => (
            <div key={r.nome} className="card p-3 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-cerrado/30 flex-shrink-0" />
              <div>
                <p className="font-head font-semibold text-xs">{r.nome}</p>
                <p className="text-[10px] text-muted/60">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PerfilView() {
  const { user, logout } = useAuthStore()

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="font-head font-extrabold text-2xl mb-1">Meu Perfil</h2>
        <p className="text-sm text-muted">Suas informações e preferências</p>
      </div>

      {/* Profile card */}
      <div className="card p-6 mb-4">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-cerrado flex items-center justify-center text-white font-bold text-2xl font-head">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-head font-bold text-lg">{user?.name}</p>
            <p className="text-sm text-muted">{user?.email}</p>
            <p className="text-xs text-muted/60 mt-0.5">{user?.bairro || 'Sobradinho'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-areia/60 rounded-xl p-3">
            <p className="text-xs text-muted/60 mb-0.5">Membro desde</p>
            <p className="font-head font-semibold text-sm">Março 2026</p>
          </div>
          <div className="bg-areia/60 rounded-xl p-3">
            <p className="text-xs text-muted/60 mb-0.5">Região</p>
            <p className="font-head font-semibold text-sm">{user?.bairro || 'Sobradinho'}</p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="card p-5 mb-4">
        <h3 className="font-head font-bold text-sm mb-3">Meus interesses</h3>
        <div className="flex flex-wrap gap-2">
          {user?.preferences && typeof user.preferences === 'object' ? (
            Object.entries(user.preferences as Record<string, number>)
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([key]) => (
                <span key={key} className="chip text-xs capitalize">{key}</span>
              ))
          ) : (
            <p className="text-sm text-muted/60">Nenhuma preferência configurada</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="card p-5">
        <h3 className="font-head font-bold text-sm mb-3">Configurações</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">Notificações por e-mail</span>
            <div className={`w-10 h-6 rounded-full transition-colors ${user?.acceptEmail ? 'bg-cerrado' : 'bg-borda'} relative cursor-pointer`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${user?.acceptEmail ? 'left-5' : 'left-1'}`} />
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">Notificações WhatsApp</span>
            <div className={`w-10 h-6 rounded-full transition-colors ${user?.acceptWhatsapp ? 'bg-cerrado' : 'bg-borda'} relative cursor-pointer`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${user?.acceptWhatsapp ? 'left-5' : 'left-1'}`} />
            </div>
          </div>
          <div className="border-t border-borda/40 pt-3 mt-3">
            <button
              onClick={() => logout()}
              className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
            >
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
