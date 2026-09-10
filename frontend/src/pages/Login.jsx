import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_PASSWORD, BRAND_TAGLINE } from '../constants'

export default function Login() {
  const { login } = useAuth()
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
    if (!email.trim() || !password) { setError('أدخل البريد وكلمة المرور'); return }
    setLoading(true); setError('')
    try {
      const eng = await login(email.trim(), password)
      // If this was their first login (default password), prompt change
      if (password === DEFAULT_PASSWORD) setFirstLogin(true)
      else navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'خطأ في تسجيل الدخول')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-yellow-800 to-yellow-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
            💻
          </div>
          <h1 className="text-2xl font-bold text-white">نظام إدارة تكنولوجيا المعلومات</h1>
          <p className="text-yellow-200 text-sm mt-1">{BRAND_TAGLINE}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {!firstLogin ? (
            <>
              <h2 className="text-xl font-bold text-slate-800 mb-1">مرحباً بك 👋</h2>
              <p className="text-slate-500 text-sm mb-6">سجّل الدخول للمتابعة</p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                  <span>⚠️</span> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="form-label">البريد الإلكتروني</label>
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
                  <label className="form-label">كلمة المرور</label>
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
                    نسيت كلمة المرور؟
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
                    <>🔑 تسجيل الدخول</>
                  )}
                </button>
              </form>

              <div className="mt-5 p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 text-center">
                  كلمة المرور الافتراضية لأول دخول:{' '}
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
            📝 رفع تذكرة دعم فني بدون تسجيل دخول
          </a>
        </div>
      </div>
    </div>
  )
}

// ── First login: change default password ─────────────────────────────────────
function FirstLoginPrompt({ onDone }) {
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const { engineer } = useAuth()

  const handleChange = async (e) => {
    e.preventDefault()
    if (newPass.length < 6)    { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    if (newPass !== confirm)   { setError('كلمتا المرور غير متطابقتين'); return }
    if (newPass === DEFAULT_PASSWORD) { setError('اختر كلمة مرور مختلفة عن الافتراضية'); return }
    setLoading(true); setError('')
    try {
      const api = (await import('../api/client')).default
      await api.post('/auth/change-password', { current_password: DEFAULT_PASSWORD, new_password: newPass })
      setDone(true)
      setTimeout(onDone, 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'حدث خطأ')
    } finally { setLoading(false) }
  }

  if (done) return (
    <div className="text-center py-6">
      <div className="text-5xl mb-4">✅</div>
      <p className="font-bold text-slate-800 text-lg">تم تغيير كلمة المرور!</p>
      <p className="text-slate-500 text-sm mt-1">جاري الانتقال...</p>
    </div>
  )

  return (
    <>
      <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
        🔐 أول تسجيل دخول — يرجى تغيير كلمة المرور الافتراضية
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-4">مرحباً، {engineer?.name}</h2>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">⚠️ {error}</div>
      )}
      <form onSubmit={handleChange} className="space-y-4">
        <div>
          <label className="form-label">كلمة المرور الجديدة</label>
          <input type="password" className="form-input" dir="ltr" value={newPass} onChange={e => setNewPass(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="form-label">تأكيد كلمة المرور</label>
          <input type="password" className="form-input" dir="ltr" value={confirm} onChange={e => setConfirm(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">
          {loading ? '...' : 'حفظ كلمة المرور والمتابعة'}
        </button>
      </form>
    </>
  )
}
