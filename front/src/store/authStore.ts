import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Tipos ─────────────────────────────────────────────

export type Preferences = Record<string, number>
// ex: { gastronomia: 0.9, natureza: 0.5, cultura: 0.3, familia: 0.8 }

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'USER' | 'OWNER' | 'ADMIN'
  bairro?: string
  preferences?: Preferences
  acceptEmail: boolean
  acceptWhatsapp: boolean
  onboardingDone: boolean
  referralCode: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean

  // actions
  setUser: (user: AuthUser, token: string) => void
  logout: () => void
  updatePreferences: (prefs: Preferences) => void
  updateOptIn: (acceptEmail: boolean, acceptWhatsapp: boolean) => void
  refreshToken: () => Promise<boolean>
}

// ── Store ─────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,

      setUser: (user, accessToken) => set({ user, accessToken }),

      logout: async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        set({ user: null, accessToken: null })
      },

      updatePreferences: (prefs) =>
        set((s) => ({
          user: s.user ? { ...s.user, preferences: prefs, onboardingDone: true } : null,
        })),

      updateOptIn: (acceptEmail, acceptWhatsapp) =>
        set((s) => ({
          user: s.user ? { ...s.user, acceptEmail, acceptWhatsapp } : null,
        })),

      refreshToken: async () => {
        try {
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          })
          if (!res.ok) { set({ user: null, accessToken: null }); return false }
          const { accessToken } = await res.json()
          set({ accessToken })
          return true
        } catch {
          set({ user: null, accessToken: null })
          return false
        }
      },
    }),
    { name: 'sbt-auth', partialize: (s) => ({ user: s.user, accessToken: s.accessToken }) }
  )
)

// ── Tipos para preferências do onboarding ─────────────

export const PREFERENCE_CATEGORIES = [
  { key: 'gastronomia', label: 'Comer', emoji: '🍽️', desc: 'Restaurantes, bares, lanchonetes' },
  { key: 'natureza',    label: 'Natureza', emoji: '🌿', desc: 'Parques, trilhas, cerrado' },
  { key: 'cultura',     label: 'Cultura', emoji: '🎭', desc: 'Arte, shows, museus' },
  { key: 'esporte',     label: 'Esporte', emoji: '⚽', desc: 'Futebol, academia, esportes' },
  { key: 'familia',     label: 'Família', emoji: '👨‍👩‍👧', desc: 'Passeios com crianças' },
  { key: 'festa',       label: 'Balada', emoji: '🎉', desc: 'Festas, barzinhos, noite' },
  { key: 'compras',     label: 'Compras', emoji: '🛍️', desc: 'Feiras, lojas, mercados' },
  { key: 'trilha',      label: 'Trilha', emoji: '🥾', desc: 'Caminhadas, ecoturismo' },
] as const

export type CategoryKey = typeof PREFERENCE_CATEGORIES[number]['key']
