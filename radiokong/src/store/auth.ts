import { create } from 'zustand'

export interface User {
  id: string
  email: string
  displayName: string
  avatar?: string
  createdAt: string
  tier: 'free' | 'pro' | 'studio' | 'enterprise'
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  showAuthModal: boolean

  // Actions
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string, displayName: string) => Promise<boolean>
  logout: () => void
  updateProfile: (updates: Partial<Pick<User, 'displayName' | 'avatar'>>) => void
  setShowAuthModal: (show: boolean) => void
  clearError: () => void
  checkAuth: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  showAuthModal: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })

    try {
      // Try Electron IPC first (production path)
      if (window.electronAPI?.authLogin) {
        const result = await window.electronAPI.authLogin({ email, password })
        if (result.status === 'ok' && result.user) {
          const typedUser = { ...result.user, tier: (result.user.tier || 'free') as User['tier'] }
          set({
            user: typedUser,
            isAuthenticated: true,
            isLoading: false,
            showAuthModal: false,
          })
          // Persist to localStorage
          localStorage.setItem('radiokong_auth', JSON.stringify(typedUser))
          return true
        }
        throw new Error(result.message || 'Invalid email or password')
      }

      // Dev fallback: simulate login with local validation
      await new Promise((resolve) => setTimeout(resolve, 1000))

      if (!email || !password) {
        throw new Error('Email and password are required')
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }

      // Check if user exists in localStorage
      const existingUsers = JSON.parse(localStorage.getItem('radiokong_users') || '[]')
      const found = existingUsers.find((u: any) => u.email === email)

      if (found && found.password !== password) {
        throw new Error('Invalid email or password')
      }

      const user: User = found
        ? { id: found.id, email: found.email, displayName: found.displayName, createdAt: found.createdAt, tier: (found.tier || 'free') as User['tier'], avatar: found.avatar }
        : {
            id: `user-${Date.now()}`,
            email,
            displayName: email.split('@')[0],
            createdAt: new Date().toISOString(),
            tier: 'free' as const,
          }

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        showAuthModal: false,
      })
      localStorage.setItem('radiokong_auth', JSON.stringify(user))
      return true
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      return false
    }
  },

  signup: async (email: string, password: string, displayName: string) => {
    set({ isLoading: true, error: null })

    try {
      // Try Electron IPC first
      if (window.electronAPI?.authSignup) {
        const result = await window.electronAPI.authSignup({ email, password, displayName })
        if (result.status === 'ok' && result.user) {
          const typedUser = { ...result.user, tier: (result.user.tier || 'free') as User['tier'] }
          set({
            user: typedUser,
            isAuthenticated: true,
            isLoading: false,
            showAuthModal: false,
          })
          localStorage.setItem('radiokong_auth', JSON.stringify(typedUser))
          return true
        }
        throw new Error(result.message || 'Sign up failed')
      }

      // Dev fallback: simulate signup
      await new Promise((resolve) => setTimeout(resolve, 1200))

      if (!email || !password || !displayName) {
        throw new Error('All fields are required')
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters')
      }
      if (!email.includes('@')) {
        throw new Error('Please enter a valid email address')
      }

      // Check if email already taken
      const existingUsers = JSON.parse(localStorage.getItem('radiokong_users') || '[]')
      if (existingUsers.find((u: any) => u.email === email)) {
        throw new Error('An account with this email already exists')
      }

      const user: User = {
        id: `user-${Date.now()}`,
        email,
        displayName,
        createdAt: new Date().toISOString(),
        tier: 'free' as const,
      }

      // Save to user list
      existingUsers.push({ ...user, password })
      localStorage.setItem('radiokong_users', JSON.stringify(existingUsers))

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        showAuthModal: false,
      })
      localStorage.setItem('radiokong_auth', JSON.stringify(user))
      return true
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      return false
    }
  },

  logout: () => {
    localStorage.removeItem('radiokong_auth')
    set({ user: null, isAuthenticated: false, showAuthModal: false })
  },

  updateProfile: (updates) => {
    const currentUser = get().user
    if (!currentUser) return

    const updatedUser = { ...currentUser, ...updates }
    set({ user: updatedUser })
    localStorage.setItem('radiokong_auth', JSON.stringify(updatedUser))
  },

  setShowAuthModal: (show) => set({ showAuthModal: show, error: null }),

  clearError: () => set({ error: null }),

  checkAuth: () => {
    const saved = localStorage.getItem('radiokong_auth')
    if (saved) {
      try {
        const user = JSON.parse(saved)
        set({ user, isAuthenticated: true })
      } catch {
        localStorage.removeItem('radiokong_auth')
      }
    }
  },
}))

// NOTE: Window.electronAPI is typed via src/types/index.ts
// Do not re-declare here to avoid conflicts
