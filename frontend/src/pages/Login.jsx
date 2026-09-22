import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { DEFAULT_PASSWORD, BRAND_TAGLINE } from '../constants'

const LANGUAGES = {
  en: { label: 'EN', flag: '🇺🇸' },
  ar: { label: 'AR', flag: '🇪🇬' },
}

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()
  return (
    <div className="absolute top-4 end-4 flex gap-1 bg-white/10 rounded-xl p-1">
      {Object.entries(LANGUAGES).map(([code, lang]) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            language === code ? 'bg-white text-yellow-800 shadow-sm' : 'text-yellow-100 hover:bg-white/10'
          }`}
        >
          <span>{lang.flag}</span>
          <span>{lang.label}</span>
        </button>
      ))}
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [firstLogin, setFirstLogin] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) { setError(t('login.errorRequired')); return }
    setLoading(true); setError('')
    try {
      const eng = await login(email.trim(), password)
      // If this was their first login (default password), prompt change
      if (password === DEFAULT_PASSWORD) setFirstLogin(true)
      else navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || t('login.errorGeneric'))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-yellow-800 to-yellow-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full" />
      </div>

      <LanguageSwitcher />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-2xl shadow-lg mx-auto mb-4 px-5 py-3 inline-flex items-center justify-center">
            <img src="/mobica-logo.png" alt="Mobica" className="h-8 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('app.name')}</h1>
          <p className="text-yellow-200 text-sm mt-1">{BRAND_TAGLINE}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {!firstLogin ? (
            <>
              <h2 className="text-xl font-bold text-slate-800 mb-1">{t('login.welcome')}</h2>
              <p className="text-slate-500 text-sm mb-6">{t('login.subtitle')}</p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                  <span>⚠️</span> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="form-label">{t('login.email')}</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="name@mobica.net"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                    autoComplete="email"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="form-label">{t('login.password')}</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="form-input pl-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                      tabIndex={-1}
                    >
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <a href="/forgot-password" className="text-xs text-yellow-600 hover:text-yellow-700 hover:underline">
                    {t('login.forgotPassword')}
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="animate-spin text-lg">⏳</span>
                  ) : (
                    <>🔑 {t('login.submit')}</>
                  )}
                </button>
              </form>

              <div className="mt-5 p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 text-center">
                  {t('login.defaultPasswordHint')}{' '}
                  <code className="bg-white px-2 py-0.5 rounded border text-yellow-700 font-mono">{DEFAULT_PASSWORD}</code>
                </p>
              </div>
            </>
          ) : (
            <FirstLoginPrompt onDone={() => navigate(from, { replace: true })} />
          )}
        </div>

        {/* Public ticket link */}
        <div className="text-center mt-6">
          <a href="/new-ticket" className="text-yellow-200 hover:text-white text-sm transition-colors">
            {t('login.publicTicketLink')}
          </a>
        </div>
      </div>
    </div>
  )
}

// ── First login: change default password ─────────────────────────────────────
function FirstLoginPrompt({ onDone }) {
  const { t } = useLanguage()
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const { engineer } = useAuth()

  const handleChange = async (e) => {
    e.preventDefault()
    if (newPass.length < 6)    { setError(t('login.errorPasswordLength')); return }
    if (newPass !== confirm)   { setError(t('login.errorPasswordMismatch')); return }
    if (newPass === DEFAULT_PASSWORD) { setError(t('login.errorSameAsDefault')); return }
    setLoading(true); setError('')
    try {
      const api = (await import('../api/client')).default
      await api.post('/auth/change-password', { current_password: DEFAULT_PASSWORD, new_password: newPass })
      setDone(true)
      setTimeout(onDone, 2000)
    } catch (err) {
      setError(err.response?.data?.detail || t('common.error'))
    } finally { setLoading(false) }
  }

  if (done) return (
    <div className="text-center py-6">
      <div className="text-5xl mb-4">✅</div>
      <p className="font-bold text-slate-800 text-lg">{t('login.passwordChanged')}</p>
      <p className="text-slate-500 text-sm mt-1">{t('login.redirecting')}</p>
    </div>
  )

  return (
    <>
      <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
        {t('login.firstLoginBanner')}
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-4">{t('login.welcomeName').replace('{name}', engineer?.name || '')}</h2>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">⚠️ {error}</div>
      )}
      <form onSubmit={handleChange} className="space-y-4">
        <div>
          <label className="form-label">{t('login.newPassword')}</label>
          <input type="password" className="form-input" dir="ltr" value={newPass} onChange={e => setNewPass(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="form-label">{t('login.confirmPassword')}</label>
          <input type="password" className="form-input" dir="ltr" value={confirm} onChange={e => setConfirm(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">
          {loading ? '...' : t('login.savePasswordContinue')}
        </button>
      </form>
    </>
  )
}
