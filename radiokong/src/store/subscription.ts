import { create } from 'zustand'

export type SubscriptionTier = 'free' | 'pro' | 'studio'
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'none'

export interface SubscriptionPlan {
  tier: SubscriptionTier
  name: string
  price: number
  currency: string
  period: string
  features: string[]
  highlighted?: boolean
}

export interface AdditionalServer {
  id: string
  host: string
  port: number
  mount: string
  username: string
  password: string
  protocol: 'icecast' | 'shoutcast'
  enabled: boolean
  label: string
}

export interface SubscriptionState {
  tier: SubscriptionTier
  status: SubscriptionStatus
  currentPeriodEnd: string | null
  pesapalTrackingId: string | null
  email: string
  isLoading: boolean
  error: string | null

  // Actions
  setTier: (tier: SubscriptionTier) => void
  setStatus: (status: SubscriptionStatus) => void
  setEmail: (email: string) => void
  initiatePayment: (tier: SubscriptionTier) => Promise<string | null>
  verifyPayment: (trackingId: string) => Promise<boolean>
  cancelSubscription: () => Promise<void>
  checkStatus: () => Promise<void>
}

export const PLANS: SubscriptionPlan[] = [
  {
    tier: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    period: 'forever',
    features: [
      '1 streaming server',
      'MP3 encoding only',
      'Basic mixer (2 channels)',
      'Standard quality',
      'Community support',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 9.99,
    currency: 'USD',
    period: '/month',
    features: [
      '5 streaming servers',
      'All encoders (MP3/OGG/AAC)',
      'Full mixer + DSP effects',
      '8 channels',
      'Auto-reconnect',
      'Recording (WAV/MP3)',
      'Priority email support',
      'Metadata scheduling',
    ],
    highlighted: true,
  },
  {
    tier: 'studio',
    name: 'Studio',
    price: 24.99,
    currency: 'USD',
    period: '/month',
    features: [
      'Unlimited servers',
      'All encoders + FLAC lossless',
      'Advanced DSP suite',
      '16 channels',
      'Multi-output streaming',
      'Auto-reconnect + failover',
      'Priority support + Slack',
      'Custom metadata API',
      'White-label option',
      'Team collaboration',
    ],
  },
]

// Feature gating based on tier
export const TIER_LIMITS = {
  free: {
    maxServers: 1,
    maxChannels: 2,
    encoders: ['mp3'] as string[],
    dsp: false,
    recording: false,
    autoReconnect: false,
    multiOutput: false,
  },
  pro: {
    maxServers: 5,
    maxChannels: 8,
    encoders: ['mp3', 'ogg', 'aac'] as string[],
    dsp: true,
    recording: true,
    autoReconnect: true,
    multiOutput: false,
  },
  studio: {
    maxServers: Infinity,
    maxChannels: 16,
    encoders: ['mp3', 'ogg', 'aac', 'flac'] as string[],
    dsp: true,
    recording: true,
    autoReconnect: true,
    multiOutput: true,
  },
} as const

export function hasFeature(tier: SubscriptionTier, feature: keyof typeof TIER_LIMITS.free): boolean {
  return TIER_LIMITS[tier][feature] as boolean
}

export function getTierLimit<K extends keyof typeof TIER_LIMITS.free>(
  tier: SubscriptionTier,
  limit: K
): (typeof TIER_LIMITS.free)[K] {
  return TIER_LIMITS[tier][limit]
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  status: 'none',
  currentPeriodEnd: null,
  pesapalTrackingId: null,
  email: '',
  isLoading: false,
  error: null,

  setTier: (tier) => set({ tier }),
  setStatus: (status) => set({ status }),
  setEmail: (email) => set({ email }),

  initiatePayment: async (tier: SubscriptionTier) => {
    set({ isLoading: true, error: null })
    const plan = PLANS.find((p) => p.tier === tier)
    if (!plan || plan.price === 0) {
      set({ tier: 'free', status: 'active', isLoading: false })
      return null
    }

    try {
      // Use Electron IPC for server-side PesaPal API calls (keeps credentials secure)
      if (window.electronAPI?.subscriptionInitiate) {
        const result = await window.electronAPI.subscriptionInitiate({
          tier,
          email: get().email,
        })

        if (result.status === 'ok' && result.trackingId) {
          set({ pesapalTrackingId: result.trackingId, isLoading: false })
          // The payment page is opened automatically by Electron's shell.openExternal
          return result.trackingId
        }

        throw new Error(result.message || 'Failed to initiate PesaPal payment')
      }

      // Fallback: Direct client-side API calls (for dev without Electron)
      // This is less secure as PesaPal credentials would be exposed
      const PESAPAL_BASE = 'https://pay.pesapal.com/v3/api'

      const tokenRes = await fetch(`${PESAPAL_BASE}/Auth/RequestToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          consumer_key: '',
          consumer_secret: '',
        }),
      })
      const tokenData = await tokenRes.json()
      const accessToken = tokenData.token

      if (!accessToken) {
        throw new Error('PesaPal not configured. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET environment variables.')
      }

      const ipnRes = await fetch(`${PESAPAL_BASE}/URLSetup/RegisterIPN`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          url: 'https://api.radiokong.com/api/pesapal/ipn',
          ipn_notification_type: 'GET',
        }),
      })
      const ipnData = await ipnRes.json()

      const orderRes = await fetch(`${PESAPAL_BASE}/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: `RK-${tier}-${Date.now()}`,
          currency: plan.currency,
          amount: plan.price,
          description: `RadioKong ${plan.name} Subscription`,
          callback_url: 'radiokong://subscription/callback',
          notification_id: ipnData.ipn_id,
          billing_address: {
            email_address: get().email,
            first_name: 'RadioKong',
            last_name: 'User',
          },
        }),
      })
      const orderData = await orderRes.json()

      if (orderData.redirect_url) {
        set({ pesapalTrackingId: orderData.order_tracking_id, isLoading: false })
        window.open(orderData.redirect_url, '_blank')
        return orderData.order_tracking_id
      }

      throw new Error(orderData.error?.message || 'Failed to create payment')
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      return null
    }
  },

  verifyPayment: async (trackingId: string) => {
    set({ isLoading: true })
    try {
      // Use Electron IPC
      if (window.electronAPI?.subscriptionVerify) {
        const result = await window.electronAPI.subscriptionVerify(trackingId)

        if (result.completed && result.tier) {
          set({
            tier: result.tier as SubscriptionTier,
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            isLoading: false,
          })
          return true
        }

        set({ isLoading: false })
        return false
      }

      // Fallback: client-side
      const PESAPAL_BASE = 'https://pay.pesapal.com/v3/api'
      const tokenRes = await fetch(`${PESAPAL_BASE}/Auth/RequestToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ consumer_key: '', consumer_secret: '' }),
      })
      const tokenData = await tokenRes.json()

      const statusRes = await fetch(
        `${PESAPAL_BASE}/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`,
        { headers: { Accept: 'application/json', Authorization: `Bearer ${tokenData.token}` } }
      )
      const statusData = await statusRes.json()

      if (statusData.payment_status === 'COMPLETED') {
        const orderDescription = statusData.description || ''
        let newTier: SubscriptionTier = 'pro'
        if (orderDescription.toLowerCase().includes('studio')) newTier = 'studio'

        set({
          tier: newTier,
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isLoading: false,
        })
        return true
      }

      set({ isLoading: false })
      return false
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      return false
    }
  },

  cancelSubscription: async () => {
    if (window.electronAPI?.subscriptionCancel) {
      await window.electronAPI.subscriptionCancel()
    }
    set({ tier: 'free', status: 'cancelled', currentPeriodEnd: null })
  },

  checkStatus: async () => {
    // Read from localStorage for persistence
    const saved = localStorage.getItem('radiokong_subscription')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        set({
          tier: data.tier || 'free',
          status: data.status || 'none',
          currentPeriodEnd: data.currentPeriodEnd,
          email: data.email || '',
        })
      } catch {}
    }
  },
}))

// Persist subscription state to localStorage
useSubscriptionStore.subscribe((state) => {
  localStorage.setItem(
    'radiokong_subscription',
    JSON.stringify({
      tier: state.tier,
      status: state.status,
      currentPeriodEnd: state.currentPeriodEnd,
      email: state.email,
    })
  )
})
