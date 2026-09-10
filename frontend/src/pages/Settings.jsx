import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useDisplay } from '../context/DisplayContext'
import { useNavigate } from 'react-router-dom'
import { authApi, engineersApi, API_BASE } from '../api/client'
import api from '../api/client'

// ── Backup API ─────────────────────────────────────────────────────────────────
const adminApi = {
  dbInfo:  () => api.get('/auth/db-info'),
  backup:  async () => {
    const token = localStorage.getItem('it_token')
    const res = await fetch(`${API_BASE}/auth/backup`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('فشل التنزيل')
    const blob = await res.blob()
    const ts   = new Date().toISOString().slice(0, 10)
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `it_management_backup_${ts}.db`
    a.click()
    URL.revokeObjectURL(url)
  },
  restore: async (file) => {
    const token    = localStorage.getItem('it_token')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/auth/restore`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    formData,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'فشلت الاستعادة')
    return data
  },
}

// ── helpers ────────────────────────────────────────────────────────────────────
const PERM = {
  admin:    { label: 'مسؤول النظام', color: 'bg-purple-100 text-purple-700', icon: '🛡️' },
  engineer: { label: 'مهندس IT',     color: 'bg-yellow-100 text-yellow-700', icon: '👷' },
  viewer:   { label: 'مشاهد',        color: 'bg-slate-100 text-slate-600', icon: '👁️' },
}

const AVATAR_COLORS = [
  'from-yellow-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-yellow-600',
  'from-cyan-500 to-sky-600',
  'from-indigo-500 to-blue-600',
]

function avatarGradient(name = '') {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([])
  const show = (msg, type = 'success') => {
    const id = Date.now()
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }
  const el = toasts.length > 0 && (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`px-5 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2.5 animate-fadeIn
          ${t.type === 'success' ? 'bg-yellow-600 text-white' : 'bg-red-600 text-white'}`}>
          {t.type === 'success' ? '✅' : '⚠️'} {t.msg}
        </div>
      ))}
    </div>
  )
  return { show, el }
}

// ── SECTION: Profile ───────────────────────────────────────────────────────────
function ProfileSection({ engineer, updateEngineer }) {
  const { show, el } = useToast()
  const [edit, setEdit]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ name: engineer?.name || '', role: engineer?.role || '' })
  const perm = PERM[engineer?.permission_level] || PERM.engineer

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const { data } = await authApi.updateProfile({ name: form.name.trim(), role: form.role.trim() || 'IT Engineer' })
      updateEngineer(data)
      setEdit(false)
      show('تم حفظ الملف الشخصي بنجاح')
    } catch (err) {
      show(err.response?.data?.detail || 'فشل الحفظ', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm({ name: engineer?.name || '', role: engineer?.role || '' })
    setEdit(false)
  }

  return (
    <>
      {el}
      <div className="space-y-6">
        {/* Avatar + header */}
        <div className="flex items-center gap-5">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarGradient(engineer?.name)}
            flex items-center justify-center text-white font-bold text-3xl shadow-lg flex-shrink-0`}>
            {engineer?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-slate-800 truncate">{engineer?.name}</h3>
            <p className="text-slate-400 text-sm mt-0.5" style={{ direction: 'ltr' }}>{engineer?.email}</p>
            <span className={`badge text-xs mt-2 ${perm.color}`}>{perm.icon} {perm.label}</span>
          </div>
          {!edit && (
            <button onClick={() => setEdit(true)} className="btn-secondary !py-2 !px-4 text-sm flex-shrink-0">
              ✏️ تعديل
            </button>
          )}
        </div>

        {/* Edit form */}
        {edit ? (
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
            <h4 className="font-semibold text-slate-700 text-sm">تعديل المعلومات الشخصية</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">الاسم الكامل</label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="الاسم الكامل" />
              </div>
              <div>
                <label className="form-label">المسمى الوظيفي</label>
                <input className="form-input" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  placeholder="مثل: IT Engineer" style={{ direction: 'ltr' }} />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="btn-primary disabled:opacity-50">
                {saving ? '⏳ جاري الحفظ...' : '💾 حفظ التغييرات'}
              </button>
              <button onClick={handleCancel} className="btn-secondary">إلغاء</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'الاسم الكامل',       value: engineer?.name },
              { label: 'البريد الإلكتروني',  value: engineer?.email, ltr: true },
              { label: 'المسمى الوظيفي',     value: engineer?.role },
              { label: 'مستوى الصلاحية',     value: perm.label },
              { label: 'تاريخ الانضمام',     value: fmtDate(engineer?.created_at) },
              { label: 'معرّف المستخدم',      value: `#${engineer?.id}`, ltr: true },
            ].map((row, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{row.label}</p>
                <p className="text-sm font-semibold text-slate-700 truncate"
                  style={row.ltr ? { direction: 'ltr', textAlign: 'left' } : {}}>
                  {row.value || '—'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-amber-500 flex-shrink-0">ℹ️</span>
          <p className="text-sm text-amber-700">
            لتغيير البريد الإلكتروني يرجى التواصل مع مسؤول النظام — البريد هو معرّفك الرئيسي ولا يمكن تغييره ذاتياً.
          </p>
        </div>
      </div>
    </>
  )
}

// ── SECTION: Security ──────────────────────────────────────────────────────────
function SecuritySection() {
  const { show, el } = useToast()
  const [form, setForm]     = useState({ current: '', next: '', confirm: '' })
  const [vis, setVis]       = useState({ current: false, next: false, confirm: false })
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)

  const toggle = k => setVis(v => ({ ...v, [k]: !v[k] }))
  const set    = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const checks = [
    { label: '8 أحرف على الأقل',      ok: form.next.length >= 8 },
    { label: 'حرف كبير (A-Z)',         ok: /[A-Z]/.test(form.next) },
    { label: 'حرف صغير (a-z)',         ok: /[a-z]/.test(form.next) },
    { label: 'رقم (0-9)',              ok: /[0-9]/.test(form.next) },
    { label: 'رمز خاص (@, #, !, …)',  ok: /[^A-Za-z0-9]/.test(form.next) },
  ]
  const score    = checks.filter(c => c.ok).length
  const strLabel = ['', 'ضعيفة جداً', 'ضعيفة', 'مقبولة', 'قوية', 'قوية جداً'][score]
  const strColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-amber-400', 'bg-yellow-400', 'bg-yellow-600'][score]
  const strText  = ['', 'text-red-500', 'text-yellow-500', 'text-amber-600', 'text-yellow-600', 'text-yellow-700'][score]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.current) { show('أدخل كلمة المرور الحالية', 'error'); return }
    if (form.next.length < 6) { show('كلمة المرور الجديدة يجب 6 أحرف على الأقل', 'error'); return }
    if (form.next !== form.confirm) { show('كلمتا المرور غير متطابقتين', 'error'); return }
    if (form.next === form.current) { show('كلمة المرور الجديدة يجب أن تختلف عن الحالية', 'error'); return }

    setSaving(true)
    try {
      await api.post('/auth/change-password', { current_password: form.current, new_password: form.next })
      setDone(true)
      setForm({ current: '', next: '', confirm: '' })
      show('تم تغيير كلمة المرور بنجاح')
      setTimeout(() => setDone(false), 6000)
    } catch (err) {
      show(err.response?.data?.detail || 'حدث خطأ، حاول مجدداً', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {el}
      <div className="space-y-5">
        {done && (
          <div className="flex items-center gap-4 p-5 bg-yellow-50 border border-yellow-200 rounded-2xl">
            <span className="text-3xl">✅</span>
            <div>
              <p className="font-bold text-yellow-800">تم تغيير كلمة المرور بنجاح</p>
              <p className="text-yellow-600 text-sm mt-0.5">استخدم كلمة المرور الجديدة في تسجيل الدخول القادم</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current */}
          <div>
            <label className="form-label">كلمة المرور الحالية</label>
            <div className="relative">
              <input type={vis.current ? 'text' : 'password'} className="form-input pl-10"
                style={{ direction: 'ltr' }} value={form.current}
                onChange={e => set('current', e.target.value)}
                placeholder="أدخل كلمة مرورك الحالية" autoComplete="current-password" />
              <button type="button" onClick={() => toggle('current')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base">
                {vis.current ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-5">
            {/* New */}
            <div>
              <label className="form-label">كلمة المرور الجديدة</label>
              <div className="relative">
                <input type={vis.next ? 'text' : 'password'} className="form-input pl-10"
                  style={{ direction: 'ltr' }} value={form.next}
                  onChange={e => set('next', e.target.value)}
                  placeholder="اختر كلمة مرور قوية" autoComplete="new-password" />
                <button type="button" onClick={() => toggle('next')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base">
                  {vis.next ? '🙈' : '👁️'}
                </button>
              </div>

              {form.next && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300
                        ${i <= score ? strColor : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-semibold ${strText}`}>قوة كلمة المرور: {strLabel}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                    {checks.map((c, i) => (
                      <div key={i} className={`flex items-center gap-1.5 text-xs transition-colors
                        ${c.ok ? 'text-yellow-600' : 'text-slate-400'}`}>
                        <span>{c.ok ? '✓' : '○'}</span>
                        {c.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="form-label">تأكيد كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type={vis.confirm ? 'text' : 'password'}
                  className={`form-input pl-10 pr-10 ${
                    form.confirm && form.next !== form.confirm ? 'border-red-300 focus:ring-red-400' :
                    form.confirm && form.next === form.confirm && form.next ? 'border-yellow-300 focus:ring-yellow-400' : ''}`}
                  style={{ direction: 'ltr' }} value={form.confirm}
                  onChange={e => set('confirm', e.target.value)}
                  placeholder="أعد كتابة كلمة المرور الجديدة" autoComplete="new-password" />
                <button type="button" onClick={() => toggle('confirm')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-base">
                  {vis.confirm ? '🙈' : '👁️'}
                </button>
                {form.confirm && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {form.next === form.confirm ? '✅' : '❌'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50 !rounded-xl">
            {saving
              ? <span className="flex items-center gap-2"><span className="animate-spin inline-block">⏳</span> جاري الحفظ...</span>
              : '🔐 حفظ كلمة المرور الجديدة'}
          </button>
        </form>

        <div className="text-center border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">
            نسيت كلمة المرور الحالية؟{' '}
            <a href="/forgot-password" className="text-yellow-600 hover:underline font-medium">
              استعادة عبر البريد الإلكتروني
            </a>
          </p>
        </div>
      </div>
    </>
  )
}

// ── SECTION: Preferences ───────────────────────────────────────────────────────
function Toggle({ on, onToggle }) {
  return (
    <button onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-yellow-500' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
        ${on ? 'right-0.5 left-auto' : 'left-0.5 right-auto'}`} />
    </button>
  )
}

function PreferencesSection() {
  const { language, setLanguage } = useLanguage()
  const { mobileView, setMobileView } = useDisplay()
  const { show, el } = useToast()
  const [notifEmail,  setNotifEmail]  = useState(() => localStorage.getItem('pref_notif_email')  !== 'false')
  const [notifSound,  setNotifSound]  = useState(() => localStorage.getItem('pref_notif_sound')  === 'true')
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('pref_compact')       === 'true')
  const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem('pref_autorefresh')  !== 'false')

  const handleSave = () => {
    localStorage.setItem('pref_notif_email',  String(notifEmail))
    localStorage.setItem('pref_notif_sound',  String(notifSound))
    localStorage.setItem('pref_compact',      String(compactMode))
    localStorage.setItem('pref_autorefresh',  String(autoRefresh))
    show('تم حفظ التفضيلات')
  }

  return (
    <>
      {el}
      <div className="space-y-7">
        {/* Language */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-3 text-sm flex items-center gap-2">
            🌐 اللغة
          </h4>
          <div className="flex gap-3">
            {[
              { code: 'ar', label: 'العربية', flag: '🇸🇦', sub: 'Arabic · RTL' },
              { code: 'en', label: 'English',  flag: '🇬🇧', sub: 'English · LTR' },
            ].map(lang => (
              <button key={lang.code} onClick={() => setLanguage(lang.code)}
                className={`flex-1 flex items-center gap-3 p-4 rounded-2xl border-2 text-right transition-all
                  ${language === lang.code
                    ? 'border-yellow-500 bg-yellow-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                <span className="text-2xl">{lang.flag}</span>
                <div>
                  <p className={`font-bold text-sm ${language === lang.code ? 'text-yellow-700' : 'text-slate-700'}`}>
                    {lang.label}
                  </p>
                  <p className="text-xs text-slate-400">{lang.sub}</p>
                </div>
                {language === lang.code && <span className="mr-auto text-yellow-500 font-bold">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-3 text-sm">🔔 الإشعارات</h4>
          <div className="space-y-2">
            {[
              { label: 'إشعارات البريد الإلكتروني', desc: 'استقبال إشعارات التذاكر عبر البريد', state: notifEmail, set: setNotifEmail },
              { label: 'الأصوات والتنبيهات',        desc: 'تشغيل صوت عند وصول إشعار جديد',    state: notifSound,  set: setNotifSound },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
                <Toggle on={item.state} onToggle={() => item.set(v => !v)} />
              </div>
            ))}
          </div>
        </div>

        {/* Display */}
        <div>
          <h4 className="font-semibold text-slate-700 mb-3 text-sm">🖥️ العرض والأداء</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-700">☰ إخفاء القائمة الجانبية تلقائياً</p>
                <p className="text-xs text-slate-400 mt-0.5">القائمة تظهر كقائمة منسدلة بزر ☰ بدل شريط ثابت — يعطي أقصى مساحة لعرض الجداول والتقارير (مفعّل بشكل افتراضي)</p>
              </div>
              <Toggle on={mobileView} onToggle={() => setMobileView(!mobileView)} />
            </div>
            {[
              { label: 'الوضع المضغوط',     desc: 'تصغير المسافات لعرض مزيد من المعلومات', state: compactMode, set: setCompactMode },
              { label: 'التحديث التلقائي',  desc: 'تحديث البيانات تلقائياً كل دقيقة',       state: autoRefresh,  set: setAutoRefresh },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
                <Toggle on={item.state} onToggle={() => item.set(v => !v)} />
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleSave} className="btn-primary !py-3 w-full justify-center !rounded-xl">
          💾 حفظ التفضيلات
        </button>
      </div>
    </>
  )
}

// ── SECTION: My Stats ──────────────────────────────────────────────────────────
function StatsSection({ engineer }) {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!engineer?.id) return
    engineersApi.stats(engineer.id)
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [engineer?.id])

  const pct = n => stats?.total ? Math.round((n / stats.total) * 100) : 0

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
      <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      جاري التحميل...
    </div>
  )

  if (!stats || stats.total === 0) return (
    <div className="text-center py-16 text-slate-400">
      <div className="text-5xl mb-4">🎫</div>
      <p className="font-medium text-slate-500">لا توجد تذاكر مسندة إليك بعد</p>
      <p className="text-sm mt-1">ستظهر إحصائياتك هنا بمجرد تعيين تذاكر لك</p>
    </div>
  )

  const resolved = stats.resolved + stats.closed

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'إجمالي التذاكر', value: stats.total,       bg: 'bg-slate-700',    icon: '📋' },
          { label: 'قيد التنفيذ',    value: stats.in_progress, bg: 'bg-amber-600',    icon: '🔄' },
          { label: 'مفتوحة',         value: stats.open,        bg: 'bg-red-600',      icon: '🔴' },
          { label: 'مكتملة',         value: resolved,          bg: 'bg-yellow-600',  icon: '✅' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} text-white rounded-2xl p-5 flex items-center gap-4`}>
            <span className="text-3xl">{s.icon}</span>
            <div>
              <p className="text-2xl font-bold leading-none">{s.value}</p>
              <p className="text-xs opacity-80 mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Resolution rate */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-slate-700 text-sm">معدل الإنجاز</span>
          <span className="font-bold text-yellow-600 text-xl">{pct(resolved)}%</span>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-500 to-teal-500 rounded-full"
            style={{ width: `${pct(resolved)}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>{resolved} مكتملة</span>
          <span>{stats.total} إجمالي</span>
        </div>
      </div>

      {/* Status breakdown bars */}
      <div className="space-y-3">
        {[
          { label: 'مفتوحة',        value: stats.open,        color: 'bg-red-500' },
          { label: 'قيد التنفيذ',   value: stats.in_progress, color: 'bg-amber-500' },
          { label: 'محلولة',        value: stats.resolved,    color: 'bg-yellow-500' },
          { label: 'مغلقة',         value: stats.closed,      color: 'bg-slate-400' },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-24 flex-shrink-0">{row.label}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${row.color} rounded-full`} style={{ width: `${pct(row.value)}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-600 w-5 text-left">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SECTION: Account / Danger zone ─────────────────────────────────────────────
function AccountSection({ engineer }) {
  const { logout } = useAuth()
  const navigate   = useNavigate()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="space-y-4">
      {/* Session info */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
        <h4 className="font-semibold text-slate-600 text-sm mb-4">الجلسة الحالية</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { icon: '👤', label: 'الاسم',    value: engineer?.name },
            { icon: '✉️', label: 'البريد',   value: engineer?.email, ltr: true },
            { icon: '🛡️', label: 'الصلاحية', value: (PERM[engineer?.permission_level] || PERM.engineer).label },
            { icon: '🕐', label: 'الحالة',   value: '🟢 متصل الآن' },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-600">
              <span>{row.icon}</span>
              <span className="text-slate-400 text-xs">{row.label}:</span>
              <span className="font-medium text-xs truncate" style={row.ltr ? { direction: 'ltr' } : {}}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Logout card */}
      <div className={`rounded-2xl border p-5 transition-all ${confirm ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-800">تسجيل الخروج</p>
            <p className="text-xs text-slate-500 mt-1">ستنتهي جلستك الحالية وتحتاج إلى إعادة تسجيل الدخول</p>
          </div>
          {!confirm ? (
            <button onClick={() => setConfirm(true)}
              className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0">
              🚪 تسجيل الخروج
            </button>
          ) : (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => { logout(); navigate('/login') }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                تأكيد الخروج
              </button>
              <button onClick={() => setConfirm(false)} className="btn-secondary !py-2 text-sm">
                إلغاء
              </button>
            </div>
          )}
        </div>
        {confirm && (
          <p className="text-red-600 text-xs mt-3 font-semibold">⚠️ هل أنت متأكد؟ ستحتاج لإعادة تسجيل الدخول.</p>
        )}
      </div>
    </div>
  )
}

// ── SECTION: Backup (admin only) ───────────────────────────────────────────────
const TABLE_AR = {
  assets:               'الأصول',
  departments:          'الأقسام',
  it_engineers:         'المهندسون',
  needs_requests:       'طلبات الاحتياجات',
  notifications:        'الإشعارات',
  password_reset_tokens:'رموز إعادة التعيين',
  processed_emails:     'البريد المعالج',
  support_tickets:      'تذاكر الدعم',
  ticket_comments:      'تعليقات التذاكر',
}

function BackupSection() {
  const { show, el } = useToast()
  const [info, setInfo]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [lastBackup, setLastBackup]   = useState(() => localStorage.getItem('last_backup_at') || null)

  useEffect(() => {
    adminApi.dbInfo()
      .then(r => setInfo(r.data))
      .catch(() => show('تعذّر جلب معلومات قاعدة البيانات', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await adminApi.backup()
      const now = new Date().toLocaleString('ar-EG')
      setLastBackup(now)
      localStorage.setItem('last_backup_at', now)
      show('تم تنزيل النسخة الاحتياطية بنجاح ✅')
    } catch (err) {
      show(err.message || 'فشل التنزيل', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      {el}
      <div className="space-y-5">

        {/* Download card */}
        <div className="bg-gradient-to-br from-yellow-50 to-teal-50 border border-yellow-200 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center text-2xl flex-shrink-0">
              💾
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-800">نسخة احتياطية كاملة</h4>
              <p className="text-sm text-slate-500 mt-0.5">
                تنزيل ملف قاعدة البيانات SQLite بالكامل — يشمل جميع الجداول والبيانات
              </p>
              {lastBackup && (
                <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1.5">
                  <span>✓</span> آخر نسخة احتياطية: <strong>{lastBackup}</strong>
                </p>
              )}
            </div>
            <button onClick={handleDownload} disabled={downloading}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 flex-shrink-0 shadow-sm">
              {downloading
                ? <><span className="animate-spin inline-block">⏳</span> جاري التنزيل...</>
                : <><span>⬇️</span> تنزيل النسخة الاحتياطية</>}
            </button>
          </div>
        </div>

        {/* DB Info */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 gap-3">
            <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            جاري جلب المعلومات...
          </div>
        ) : info && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🗄️', label: 'حجم قاعدة البيانات', value: `${info.size_kb} KB` },
                { icon: '📋', label: 'عدد الجداول',         value: `${info.tables.length} جدول` },
                { icon: '📊', label: 'إجمالي السجلات',      value: info.total_rows.toLocaleString('ar-EG') },
              ].map((s, i) => (
                <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <p className="font-bold text-slate-800 text-lg">{s.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tables breakdown */}
            <div>
              <h5 className="font-semibold text-slate-600 text-sm mb-3">تفاصيل الجداول</h5>
              <div className="space-y-2">
                {info.tables.map((t, i) => {
                  const pct = info.total_rows > 0 ? (t.rows / info.total_rows) * 100 : 0
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-40 flex-shrink-0 truncate">
                        {TABLE_AR[t.name] || t.name}
                      </span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 rounded-full"
                          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-600 w-16 text-left">
                        {t.rows.toLocaleString('ar-EG')} سجل
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Modified at */}
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              🕐 آخر تعديل على قاعدة البيانات:{' '}
              <strong className="text-slate-500">
                {new Date(info.modified_at).toLocaleString('ar-EG')}
              </strong>
            </p>
          </>
        )}

        {/* Info note */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-blue-400 flex-shrink-0">ℹ️</span>
          <p className="text-sm text-blue-700">
            الملف المنزّل بصيغة <strong>.db</strong> يمكن استعادته مباشرة كملف قاعدة بيانات SQLite.
            يُنصح بأخذ نسخة احتياطية دورية وحفظها في مكان آمن.
          </p>
        </div>
      </div>
    </>
  )
}

// ── SECTION: Restore ───────────────────────────────────────────────────────────
const TABLE_AR_RESTORE = {
  assets: 'الأصول', departments: 'الأقسام', it_engineers: 'المهندسون',
  needs_requests: 'طلبات الاحتياجات', notifications: 'الإشعارات',
  password_reset_tokens: 'رموز التعيين', processed_emails: 'البريد المعالج',
  support_tickets: 'تذاكر الدعم', ticket_comments: 'تعليقات التذاكر',
}

function RestoreSection() {
  const { show, el } = useToast()
  const [file, setFile]           = useState(null)
  const [fileError, setFileError] = useState('')
  const [preview, setPreview]     = useState(null)   // {tables, total_rows, size_kb}
  const [modal, setModal]         = useState(false)
  const [confirm, setConfirm]     = useState('')
  const [restoring, setRestoring] = useState(false)
  const [result, setResult]       = useState(null)
  const [drag, setDrag]           = useState(false)
  const dropRef = useRef(null)

  // validate & preview file locally (magic bytes + size)
  const validateFile = (f) => {
    setFileError('')
    setPreview(null)
    setResult(null)
    if (!f) return
    if (!f.name.endsWith('.db')) {
      setFileError('الملف يجب أن يكون بامتداد .db')
      return
    }
    if (f.size < 1024) {
      setFileError('حجم الملف صغير جداً — يبدو أنه تالف')
      return
    }
    // read magic bytes
    const reader = new FileReader()
    reader.onload = (e) => {
      const bytes = new Uint8Array(e.target.result.slice(0, 16))
      const magic = String.fromCharCode(...bytes).startsWith('SQLite format 3')
      if (!magic) {
        setFileError('الملف ليس قاعدة بيانات SQLite صالحة')
        return
      }
      setFile(f)
      setPreview({ size_kb: (f.size / 1024).toFixed(1), name: f.name })
    }
    reader.readAsArrayBuffer(f.slice(0, 16))
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) validateFile(f)
  }

  const handleRestore = async () => {
    if (confirm !== 'استعادة') return
    setRestoring(true)
    setModal(false)
    try {
      const data = await adminApi.restore(file)
      setResult(data)
      setFile(null); setPreview(null); setConfirm('')
      show('تمت الاستعادة بنجاح — يُنصح بتسجيل الخروج وإعادة الدخول')
    } catch (err) {
      show(err.message, 'error')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      {el}

      {/* Confirm Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-2xl flex-shrink-0">⚠️</div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">تأكيد الاستعادة</h3>
                <p className="text-xs text-red-500 font-medium">إجراء لا يمكن التراجع عنه</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2 text-sm text-red-700">
              <p className="font-semibold">⛔ سيتم:</p>
              <ul className="space-y-1 list-none">
                <li>• حذف جميع البيانات الحالية بشكل نهائي</li>
                <li>• استبدالها ببيانات الملف: <strong className="text-red-800">{preview?.name}</strong></li>
                <li>• حفظ نسخة احتياطية تلقائية من الحالة الراهنة</li>
              </ul>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">
                اكتب <strong className="text-red-600">استعادة</strong> للتأكيد:
              </label>
              <input
                autoFocus
                className="form-input text-center font-bold tracking-widest"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="استعادة"
                onKeyDown={e => e.key === 'Enter' && confirm === 'استعادة' && handleRestore()}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleRestore}
                disabled={confirm !== 'استعادة'}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-colors">
                ⚠️ تنفيذ الاستعادة
              </button>
              <button onClick={() => { setModal(false); setConfirm('') }}
                className="flex-1 btn-secondary py-3 !rounded-xl font-medium">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <span className="text-red-500 text-xl flex-shrink-0">⚠️</span>
          <div>
            <p className="font-bold text-red-700 text-sm">تحذير: إجراء خطير</p>
            <p className="text-sm text-red-600 mt-0.5">
              استعادة النسخة الاحتياطية ستحذف جميع البيانات الحالية وتستبدلها ببيانات الملف المختار.
              يتم حفظ نسخة احتياطية تلقائية من الحالة الراهنة قبل الاستعادة.
            </p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          onClick={() => { if (!file) document.getElementById('db-file-input').click() }}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
            ${drag ? 'border-yellow-400 bg-yellow-50' : file ? 'border-yellow-300 bg-yellow-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'}`}>
          <input id="db-file-input" type="file" accept=".db" className="hidden"
            onChange={e => validateFile(e.target.files[0])} />

          {!file ? (
            <>
              <div className="text-4xl mb-3">{drag ? '📂' : '💾'}</div>
              <p className="font-semibold text-slate-600">اسحب ملف النسخة الاحتياطية هنا</p>
              <p className="text-sm text-slate-400 mt-1">أو انقر لاختيار الملف</p>
              <p className="text-xs text-slate-300 mt-3">ملفات .db فقط</p>
            </>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center text-2xl">🗄️</div>
              <div className="text-right">
                <p className="font-bold text-slate-800" style={{ direction: 'ltr' }}>{file.name}</p>
                <p className="text-sm text-yellow-600 font-medium">{preview?.size_kb} KB · ✅ ملف SQLite صالح</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); setFileError('') }}
                className="mr-auto text-slate-400 hover:text-red-500 text-xl transition-colors">✕</button>
            </div>
          )}
        </div>

        {/* File error */}
        {fileError && (
          <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            <span>❌</span> {fileError}
          </div>
        )}

        {/* Restore button */}
        {file && !fileError && (
          <button
            onClick={() => setModal(true)}
            disabled={restoring}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
            {restoring
              ? <><span className="animate-spin inline-block">⏳</span> جاري الاستعادة...</>
              : '🔄 استعادة النسخة الاحتياطية'}
          </button>
        )}

        {/* Success result */}
        {result && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="text-3xl">✅</span>
              <div>
                <p className="font-bold text-yellow-800">تمت الاستعادة بنجاح</p>
                <p className="text-sm text-yellow-600 mt-0.5">
                  حجم الملف المستعاد: <strong>{result.file_size_kb} KB</strong> ·
                  إجمالي السجلات: <strong>{result.total_rows?.toLocaleString('ar-EG')}</strong>
                </p>
              </div>
            </div>

            {/* Restored tables */}
            <div className="space-y-1.5">
              {result.restored_tables?.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{TABLE_AR_RESTORE[t.name] || t.name}</span>
                  <span className="font-bold text-yellow-700">{t.rows.toLocaleString('ar-EG')} سجل</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs">
              <span>💡</span>
              <span>
                تم حفظ نسخة احتياطية من البيانات القديمة باسم:{' '}
                <strong className="font-mono">{result.pre_restore_backup}</strong>
                {' '}على الخادم.
              </span>
            </div>

            <p className="text-xs text-slate-500 text-center">
              يُنصح بتسجيل الخروج وإعادة تسجيل الدخول لتحديث جميع البيانات
            </p>
          </div>
        )}

        {/* How it works */}
        <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100">
          <div className="px-5 py-3 bg-slate-50 rounded-t-2xl">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">كيف تعمل الاستعادة؟</p>
          </div>
          {[
            { icon: '1️⃣', text: 'اختر ملف .db تم تنزيله مسبقاً من زر "تنزيل النسخة الاحتياطية"' },
            { icon: '2️⃣', text: 'يتحقق النظام من صحة الملف ومطابقته لبنية قاعدة البيانات' },
            { icon: '3️⃣', text: 'يتم حفظ نسخة احتياطية تلقائية من البيانات الحالية قبل أي تغيير' },
            { icon: '4️⃣', text: 'تُستبدل قاعدة البيانات فوراً ويصبح النظام جاهزاً بالبيانات المستعادة' },
          ].map((s, i) => (
            <div key={i} className="px-5 py-3 flex items-start gap-3 text-sm text-slate-600">
              <span className="flex-shrink-0">{s.icon}</span>
              {s.text}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
const ALL_TABS = [
  { id: 'profile',     icon: '👤', label: 'الملف الشخصي',           adminOnly: false },
  { id: 'security',    icon: '🔐', label: 'الأمان وكلمة المرور',     adminOnly: false },
  { id: 'preferences', icon: '⚙️', label: 'التفضيلات',               adminOnly: false },
  { id: 'stats',       icon: '📊', label: 'إحصائياتي',               adminOnly: false },
  { id: 'backup',      icon: '💾', label: 'النسخ الاحتياطي',         adminOnly: true  },
  { id: 'restore',     icon: '🔄', label: 'استعادة النسخة الاحتياطية', adminOnly: true  },
  { id: 'account',     icon: '🚪', label: 'الحساب',                  adminOnly: false },
]

export default function Settings() {
  const { engineer, updateEngineer } = useAuth()
  const [tab, setTab] = useState('profile')

  const TABS = ALL_TABS.filter(t => !t.adminOnly || engineer?.permission_level === 'admin')
  const current = TABS.find(t => t.id === tab)

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">الإعدادات</h2>
        <p className="text-slate-500 text-sm mt-0.5">إدارة حسابك وتفضيلاتك الشخصية</p>
      </div>

      <div className="flex gap-5 flex-col md:flex-row items-start">
        {/* Sidebar nav */}
        <nav className="md:w-52 w-full flex-shrink-0">
          <div className="card !p-2 space-y-0.5">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-right
                  ${tab === t.id
                    ? 'bg-yellow-50 text-yellow-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
                <span>{t.icon}</span>
                {t.label}
                {tab === t.id && <span className="mr-auto w-1.5 h-1.5 rounded-full bg-yellow-500" />}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 w-full">
          <div className="card">
            <div className="flex items-center gap-2.5 mb-6 pb-5 border-b border-slate-100">
              <span className="text-xl">{current?.icon}</span>
              <h3 className="font-bold text-slate-800 text-lg">{current?.label}</h3>
            </div>

            {tab === 'profile'     && <ProfileSection engineer={engineer} updateEngineer={updateEngineer} />}
            {tab === 'security'    && <SecuritySection />}
            {tab === 'preferences' && <PreferencesSection />}
            {tab === 'stats'       && <StatsSection engineer={engineer} />}
            {tab === 'backup'      && <BackupSection />}
            {tab === 'restore'     && <RestoreSection />}
            {tab === 'account'     && <AccountSection engineer={engineer} />}
          </div>
        </div>
      </div>
    </div>
  )
}
