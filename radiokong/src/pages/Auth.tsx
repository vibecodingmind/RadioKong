import { useState } from 'react'
import {
  Mic,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Radio,
  Shield,
  Crown,
  Building2,
  CheckCircle,
  Zap,
  CreditCard,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { PLANS } from '../store/subscription'

type AuthView = 'login' | 'signup' | 'forgot' | 'pricing'

export function AuthPage() {
  const [view, setView] = useState<AuthView>('login')

  return (
    <div className="flex min-h-screen bg-surface-950">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-surface-950 via-brand-950/30 to-surface-950 p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 h-64 w-64 rounded-full bg-brand-500 blur-[120px]" />
          <div className="absolute bottom-20 right-20 h-48 w-48 rounded-full bg-purple-500 blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 h-32 w-32 rounded-full bg-emerald-500 blur-[80px]" />
        </div>

        {/* Logo & Tagline */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
              <Mic className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">RadioKong</h1>
              <p className="text-xs text-surface-400">Professional Internet Radio</p>
            </div>
          </div>
        </div>

        {/* Center message */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold leading-tight text-white">
              Broadcast Your Voice<br />
              <span className="text-brand-400">To The World</span>
            </h2>
            <p className="max-w-md text-lg text-surface-300">
              Professional-grade internet radio streaming. Compatible with Icecast, SHOUTcast,
              and any hardware setup. Go live in seconds.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-4">
            <FeatureHighlight icon={Radio} text="Icecast & SHOUTcast" />
            <FeatureHighlight icon={Mic} text="Hardware Input Support" />
            <FeatureHighlight icon={Shield} text="DSP Effects Suite" />
            <FeatureHighlight icon={CreditCard} text="PesaPal Payments" />
          </div>
        </div>

        {/* Bottom testimonial */}
        <div className="relative z-10">
          <div className="rounded-xl border border-surface-800/50 bg-surface-900/50 p-4">
            <p className="text-sm italic text-surface-300">
              "RadioKong made it incredibly easy to go live with our station.
              The mixer integration and multi-server support are game changers."
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600/20">
                <User className="h-4 w-4 text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">DJ Mista K</p>
                <p className="text-[10px] text-surface-500">Nairobi FM, Kenya</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
              <Mic className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">RadioKong</h1>
          </div>

          {view === 'login' && <LoginForm onSwitchView={setView} />}
          {view === 'signup' && <SignupForm onSwitchView={setView} />}
          {view === 'forgot' && <ForgotPasswordForm onSwitchView={setView} />}
          {view === 'pricing' && <PricingPreview onSwitchView={setView} />}
        </div>
      </div>
    </div>
  )
}

function LoginForm({ onSwitchView }: { onSwitchView: (v: AuthView) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const auth = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await auth.login(email, password)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Welcome back</h2>
        <p className="mt-1 text-sm text-surface-400">
          Sign in to your RadioKong account to continue streaming
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error */}
        {auth.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{auth.error}</p>
          </div>
        )}

        {/* Email */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-lg border border-surface-700 bg-surface-800 py-3 pl-10 pr-4 text-sm text-white placeholder-surface-500 outline-none transition-colors focus:border-brand-500"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full rounded-lg border border-surface-700 bg-surface-800 py-3 pl-10 pr-12 text-sm text-white placeholder-surface-500 outline-none transition-colors focus:border-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Forgot password */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => onSwitchView('forgot')}
            className="text-xs font-medium text-brand-400 hover:text-brand-300"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={auth.isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {auth.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Sign In
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-surface-800" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface-950 px-2 text-surface-500">or</span>
        </div>
      </div>

      {/* Quick view pricing */}
      <button
        type="button"
        onClick={() => onSwitchView('pricing')}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-700 bg-surface-800/50 py-3 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-800"
      >
        <CreditCard className="h-4 w-4" />
        View Plans & Pricing
      </button>

      {/* Switch to signup */}
      <p className="text-center text-sm text-surface-400">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={() => onSwitchView('signup')}
          className="font-semibold text-brand-400 hover:text-brand-300"
        >
          Create one free
        </button>
      </p>
    </div>
  )
}

function SignupForm({ onSwitchView }: { onSwitchView: (v: AuthView) => void }) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const auth = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      auth.clearError()
      return
    }
    await auth.signup(email, password, displayName)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Create your account</h2>
        <p className="mt-1 text-sm text-surface-400">
          Start streaming for free. Upgrade anytime via PesaPal.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error */}
        {auth.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{auth.error}</p>
          </div>
        )}

        {/* Display Name */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">
            Display Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name or DJ alias"
              required
              className="w-full rounded-lg border border-surface-700 bg-surface-800 py-3 pl-10 pr-4 text-sm text-white placeholder-surface-500 outline-none transition-colors focus:border-brand-500"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-lg border border-surface-700 bg-surface-800 py-3 pl-10 pr-4 text-sm text-white placeholder-surface-500 outline-none transition-colors focus:border-brand-500"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              required
              minLength={6}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 py-3 pl-10 pr-12 text-sm text-white placeholder-surface-500 outline-none transition-colors focus:border-brand-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-300"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-surface-400">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
              minLength={6}
              className={`w-full rounded-lg border bg-surface-800 py-3 pl-10 pr-4 text-sm text-white placeholder-surface-500 outline-none transition-colors focus:border-brand-500 ${
                confirmPassword && confirmPassword !== password
                  ? 'border-red-500/50'
                  : 'border-surface-700'
              }`}
            />
          </div>
          {confirmPassword && confirmPassword !== password && (
            <p className="mt-1 text-[11px] text-red-400">Passwords do not match</p>
          )}
        </div>

        {/* Terms */}
        <p className="text-[11px] text-surface-500">
          By creating an account, you agree to RadioKong's Terms of Service and Privacy Policy.
          Subscriptions are billed monthly via PesaPal.
        </p>

        {/* Submit */}
        <button
          type="submit"
          disabled={auth.isLoading || (confirmPassword !== password && confirmPassword.length > 0)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {auth.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Switch to login */}
      <p className="text-center text-sm text-surface-400">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => onSwitchView('login')}
          className="font-semibold text-brand-400 hover:text-brand-300"
        >
          Sign in
        </button>
      </p>
    </div>
  )
}

function ForgotPasswordForm({ onSwitchView }: { onSwitchView: (v: AuthView) => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In production this would call the backend
    setSent(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Reset Password</h2>
        <p className="mt-1 text-sm text-surface-400">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {sent ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <CheckCircle className="mx-auto h-8 w-8 text-emerald-400" />
            <p className="mt-2 text-sm font-medium text-emerald-400">
              Reset link sent!
            </p>
            <p className="mt-1 text-xs text-surface-400">
              Check your inbox at {email}
            </p>
          </div>
          <button
            onClick={() => onSwitchView('login')}
            className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-surface-400">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full rounded-lg border border-surface-700 bg-surface-800 py-3 pl-10 pr-4 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Send Reset Link
          </button>

          <button
            type="button"
            onClick={() => onSwitchView('login')}
            className="w-full text-center text-sm text-surface-400 hover:text-surface-300"
          >
            Back to Sign In
          </button>
        </form>
      )}
    </div>
  )
}

function PricingPreview({ onSwitchView }: { onSwitchView: (v: AuthView) => void }) {
  const iconMap: Record<string, any> = {
    free: Zap,
    pro: Shield,
    studio: Crown,
    enterprise: Building2,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Plans & Pricing</h2>
        <p className="mt-1 text-sm text-surface-400">
          Start free, upgrade when you're ready. All payments via PesaPal.
        </p>
      </div>

      <div className="space-y-3">
        {PLANS.map((plan) => {
          const Icon = iconMap[plan.tier] || Zap
          return (
            <div
              key={plan.tier}
              className={`rounded-xl border p-4 ${
                plan.highlighted
                  ? 'border-brand-500/50 bg-brand-600/5'
                  : 'border-surface-700/50 bg-surface-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      plan.highlighted ? 'bg-brand-600/20' : 'bg-surface-700/50'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${plan.highlighted ? 'text-brand-400' : 'text-surface-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{plan.name}</h3>
                      {plan.highlighted && (
                        <span className="rounded bg-brand-600/20 px-1.5 py-0.5 text-[9px] font-bold text-brand-400">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-surface-400">
                      {plan.features.slice(0, 3).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">
                    {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  </p>
                  <p className="text-[10px] text-surface-500">{plan.period}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => onSwitchView('signup')}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500"
      >
        Get Started Free
        <ArrowRight className="h-4 w-4" />
      </button>

      <button
        onClick={() => onSwitchView('login')}
        className="w-full text-center text-sm text-surface-400 hover:text-surface-300"
      >
        Already have an account? Sign in
      </button>
    </div>
  )
}

function FeatureHighlight({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-surface-800/50 bg-surface-900/50 px-4 py-3">
      <Icon className="h-4 w-4 text-brand-400" />
      <span className="text-xs font-medium text-surface-300">{text}</span>
    </div>
  )
}
