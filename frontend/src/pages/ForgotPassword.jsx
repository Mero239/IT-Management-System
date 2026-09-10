import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= score ? colors[score] : 'bg-slate-200'}`} />
        ))}
      </div>
      <p className={`text-xs ${score < 3 ? 'text-red-500' : score < 5 ? 'text-amber-600' : 'text-yellow-600'}`}>
        {labels[score]}
      </p>
    </div>
  )
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // step: 'form' | 'link-sent' | 'otp'
  const [step, setStep] = useState('form')

  // OTP step state
  const [code, setCode]       = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpDone, setOtpDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await authApi.forgotPassword(email.trim().toLowerCase())
      setStep(res.data?.method === 'otp' ? 'otp' : 'link-sent')
    } catch {
      setError('حدث خطأ — يرجى المحاولة مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    if (newPass !== confirm) { setOtpError('كلمة المرور وتأكيدها غير متطابقتين'); return }
    if (newPass.length < 6)  { setOtpError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    setOtpLoading(true); setOtpError('')
    try {
      await authApi.confirmOtp(email.trim().toLowerCase(), code.trim(), newPass)
      setOtpDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setOtpError(err?.response?.data?.detail || 'حدث خطأ — تأكد من الكود')
    } finally {
      setOtpLoading(false)
    }
  }

  const checks = [
    { ok: newPass.length >= 8,          label: '8 أحرف على الأقل' },
    { ok: /[A-Z]/.test(newPass),        label: 'حرف كبير (A-Z)' },
    { ok: /[a-z]/.test(newPass),        label: 'حرف صغير (a-z)' },
    { ok: /\d/.test(newPass),           label: 'رقم (0-9)' },
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
          {step === 'link-sent' ? (
            /* ── Admins: email-link success state ── */
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                📧
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">تم إرسال الرابط!</h2>
              <p className="text-slate-500 text-sm mb-2">
                إذا كان البريد الإلكتروني مسجلاً، ستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور.
              </p>
              <p className="text-slate-400 text-xs mb-6">
                تحقق من مجلد الرسائل غير المرغوب فيها إذا لم تجده.
                الرابط صالح لمدة <strong>ساعة واحدة</strong>.
              </p>
              <div className="bg-slate-50 rounded-xl p-3 mb-6 text-sm text-slate-600">
                <span className="font-medium">{email}</span>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setStep('form'); setEmail('') }}
                  className="btn-secondary w-full justify-center">
                  إرسال مرة أخرى
                </button>
                <Link to="/login" className="btn-primary w-full justify-center text-center">
                  العودة لتسجيل الدخول
                </Link>
              </div>
            </div>
          ) : step === 'otp' ? (
            /* ── Engineers/viewers: OTP entry + new password ── */
            otpDone ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">
                  ✅
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">تم تغيير كلمة المرور!</h2>
                <p className="text-slate-500 text-sm mb-6">سيتم تحويلك لصفحة تسجيل الدخول تلقائياً...</p>
                <Link to="/login" className="btn-primary w-full justify-center">تسجيل الدخول الآن</Link>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">🔢</span>
                    <h2 className="text-xl font-bold text-slate-800">أدخل كود التحقق (OTP)</h2>
                  </div>
                  <p className="text-slate-500 text-sm">
                    أرسلنا كود مكوّن من 6 أرقام إلى <span className="font-medium">{email}</span>. الكود صالح لمدة 10 دقائق.
                  </p>
                </div>

                {otpError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 flex items-start gap-2">
                    <span>⚠️</span><span>{otpError}</span>
                  </div>
                )}

                <form onSubmit={handleOtpSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">كود التحقق</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      required
                      className="input w-full text-center tracking-[0.5em] font-mono text-lg"
                      dir="ltr"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="أدخل كلمة مرور قوية"
                      required
                      className="input w-full"
                      dir="ltr"
                    />
                    <StrengthBar password={newPass} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">تأكيد كلمة المرور</label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="أعد كتابة كلمة المرور"
                      required
                      className={`input w-full ${confirm && confirm !== newPass ? 'border-red-300 focus:ring-red-200' : confirm && confirm === newPass ? 'border-yellow-300 focus:ring-yellow-200' : ''}`}
                      dir="ltr"
                    />
                  </div>

                  {newPass && (
                    <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-1.5">
                      {checks.map((c) => (
                        <p key={c.label} className={`text-xs flex items-center gap-1.5 ${c.ok ? 'text-yellow-600' : 'text-slate-400'}`}>
                          <span>{c.ok ? '✓' : '○'}</span>{c.label}
                        </p>
                      ))}
                    </div>
                  )}

                  <button type="submit"
                    disabled={otpLoading || code.length !== 6 || !newPass || !confirm || newPass !== confirm || newPass.length < 6}
                    className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                    {otpLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        جاري الحفظ...
                      </span>
                    ) : '🔐 تأكيد وتعيين كلمة المرور'}
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                  <button onClick={() => { setStep('form'); setCode(''); setNewPass(''); setConfirm(''); setOtpError('') }}
                    className="text-sm text-yellow-600 hover:text-yellow-700 font-medium">
                    ← لم يصلك الكود؟ إعادة الإرسال
                  </button>
                </div>
              </>
            )
          ) : (
            /* ── Form state ── */
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800 mb-1">نسيت كلمة المرور؟</h2>
                <p className="text-slate-500 text-sm">
                  أدخل بريدك الإلكتروني وسنرسل لك طريقة إعادة تعيين كلمة المرور.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="input w-full text-left"
                    dir="ltr"
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={loading || !email.trim()}
                  className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جاري الإرسال...
                    </span>
                  ) : '📧 متابعة'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
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
