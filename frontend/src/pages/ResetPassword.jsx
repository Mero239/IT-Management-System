import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import { BRAND_TAGLINE } from '../constants'

function StrengthBar({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['', 'bg-red-400', 'bg-yellow-400', 'bg-amber-400', 'bg-yellow-400', 'bg-yellow-600']
  const labels = ['', 'ضعيفة جداً', 'ضعيفة', 'متوسطة', 'قوية', 'قوية جداً']
  if (!password) return null
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= score ? colors[score] : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className={`text-xs ${score < 3 ? 'text-red-500' : score < 5 ? 'text-amber-600' : 'text-yellow-600'}`}>
        {labels[score]}
      </p>
    </div>
  )
}

export default function ResetPassword() {
  const [params]    = useSearchParams()
  const navigate    = useNavigate()
  const token       = params.get('token') || ''

  const [newPass,  setNewPass]  = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showNew,  setShowNew]  = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!token) setError('الرابط غير صالح أو مكسور — يرجى طلب رابط جديد')
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPass !== confirm) { setError('كلمة المرور وتأكيدها غير متطابقتين'); return }
    if (newPass.length < 6)  { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    setLoading(true)
    setError('')
    try {
      await authApi.confirmReset(token, newPass)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err?.response?.data?.detail || 'حدث خطأ — الرابط غير صالح أو منتهي الصلاحية')
    } finally {
      setLoading(false)
    }
  }

  const checks = [
    { ok: newPass.length >= 8,      label: '8 أحرف على الأقل' },
    { ok: /[A-Z]/.test(newPass),    label: 'حرف كبير (A-Z)' },
    { ok: /[a-z]/.test(newPass),    label: 'حرف صغير (a-z)' },
    { ok: /\d/.test(newPass),       label: 'رقم (0-9)' },
    { ok: /[^A-Za-z0-9]/.test(newPass), label: 'رمز خاص (!@#$)' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-yellow-800 to-yellow-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg">
            💻
          </div>
          <h1 className="text-white font-bold text-xl">نظام إدارة IT</h1>
          <p className="text-yellow-200 text-sm mt-1">{BRAND_TAGLINE}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {success ? (
            /* ── Success ── */
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">
                ✅
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">تم تغيير كلمة المرور!</h2>
              <p className="text-slate-500 text-sm mb-6">
                كلمة مرورك الجديدة فعّالة الآن.
                سيتم تحويلك لصفحة تسجيل الدخول تلقائياً...
              </p>
              <div className="w-full bg-slate-100 rounded-full h-1 mb-6 overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full animate-[loading_3s_linear_forwards]" />
              </div>
              <Link to="/login" className="btn-primary w-full justify-center">
                تسجيل الدخول الآن
              </Link>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🔑</span>
                  <h2 className="text-xl font-bold text-slate-800">تعيين كلمة مرور جديدة</h2>
                </div>
                <p className="text-slate-500 text-sm">أدخل كلمة مرورك الجديدة أدناه.</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {!token ? (
                <div className="text-center pt-4">
                  <Link to="/forgot-password" className="btn-primary w-full justify-center">
                    طلب رابط جديد
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      كلمة المرور الجديدة
                    </label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        placeholder="أدخل كلمة مرور قوية"
                        required
                        className="input w-full pl-10"
                        autoFocus
                      />
                      <button type="button" onClick={() => setShowNew(v => !v)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showNew ? '🙈' : '👁️'}
                      </button>
                    </div>
                    <StrengthBar password={newPass} />
                  </div>

                  {/* Confirm */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      تأكيد كلمة المرور
                    </label>
                    <div className="relative">
                      <input
                        type={showConf ? 'text' : 'password'}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="أعد كتابة كلمة المرور"
                        required
                        className={`input w-full pl-10 ${confirm && confirm !== newPass ? 'border-red-300 focus:ring-red-200' : confirm && confirm === newPass ? 'border-yellow-300 focus:ring-yellow-200' : ''}`}
                      />
                      <button type="button" onClick={() => setShowConf(v => !v)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showConf ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {confirm && (
                      <p className={`text-xs mt-1 ${confirm === newPass ? 'text-yellow-600' : 'text-red-500'}`}>
                        {confirm === newPass ? '✓ كلمتا المرور متطابقتان' : '✗ كلمتا المرور غير متطابقتين'}
                      </p>
                    )}
                  </div>

                  {/* Checklist */}
                  {newPass && (
                    <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-1.5">
                      {checks.map(c => (
                        <p key={c.label} className={`text-xs flex items-center gap-1.5 ${c.ok ? 'text-yellow-600' : 'text-slate-400'}`}>
                          <span>{c.ok ? '✓' : '○'}</span>{c.label}
                        </p>
                      ))}
                    </div>
                  )}

                  <button type="submit"
                    disabled={loading || !newPass || !confirm || newPass !== confirm || newPass.length < 6}
                    className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        جاري الحفظ...
                      </span>
                    ) : '🔐 حفظ كلمة المرور الجديدة'}
                  </button>
                </form>
              )}

              <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                <Link to="/login" className="text-sm text-yellow-600 hover:text-yellow-700 font-medium">
                  ← العودة لتسجيل الدخول
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
