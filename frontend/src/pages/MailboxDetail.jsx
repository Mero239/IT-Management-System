import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import api from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function sizeFmt(mb) {
  if (!mb && mb !== 0) return '—'
  if (mb >= 1024 * 1024) return `${(mb / 1024 / 1024).toFixed(2)} TB`
  if (mb >= 1024)        return `${(mb / 1024).toFixed(2)} GB`
  return `${mb} MB`
}

function fmt(n) { return (n ?? 0).toLocaleString() }

function fmtDate(dt, locale = 'ar-EG') {
  if (!dt) return '—'
  return new Date(dt).toLocaleString(locale, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function daysSince(dt) {
  if (!dt) return null
  return Math.floor((Date.now() - new Date(dt)) / 86400000)
}

function logonColor(days) {
  if (days === null) return { bar: 'bg-slate-300', text: 'text-slate-400', badge: 'bg-slate-100 text-slate-500' }
  if (days <= 7)    return { bar: 'bg-yellow-500', text: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700' }
  if (days <= 30)   return { bar: 'bg-yellow-400', text: 'text-yellow-500', badge: 'bg-yellow-50 text-yellow-600' }
  if (days <= 90)   return { bar: 'bg-amber-400',   text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700' }
  if (days <= 365)  return { bar: 'bg-yellow-400',  text: 'text-yellow-600',  badge: 'bg-yellow-100 text-yellow-700' }
  return             { bar: 'bg-red-500',    text: 'text-red-600',   badge: 'bg-red-100 text-red-700' }
}

function SizeGauge({ mb, maxMb = 307200 }) {   // maxMb ~300 GB reference
  const pct = Math.min((mb / maxMb) * 100, 100)
  const color =
    pct > 80 ? 'from-red-400 to-red-600' :
    pct > 50 ? 'from-yellow-400 to-amber-500' :
    pct > 20 ? 'from-amber-400 to-yellow-500' :
    'from-yellow-400 to-yellow-600'
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span>0</span>
        <span className="font-bold text-slate-700">{sizeFmt(mb)}</span>
        <span>{sizeFmt(maxMb)}</span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 text-center">{pct.toFixed(1)}% {pct > 80 ? '⚠️ مليان' : pct > 50 ? '🔶 كبير' : '✅ طبيعي'}</p>
    </div>
  )
}

function InfoRow({ icon, label, value, mono }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-base mt-0.5 shrink-0 w-6 text-center">{icon}</span>
      <span className="text-slate-500 text-sm w-36 shrink-0">{label}</span>
      <span className={`text-slate-800 text-sm font-medium flex-1 ${mono ? 'font-mono' : ''}`} dir={mono ? 'ltr' : undefined}>{value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="font-bold text-slate-700 text-sm">{title}</h3>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  )
}

// ── Related Tickets ────────────────────────────────────────────────────────────

function RelatedTickets({ email }) {
  const [tickets, setTickets] = useState([])
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const isAr = lang === 'ar'

  useEffect(() => {
    if (!email) return
    api.get('/tickets/', { params: { limit: 10, offset: 0 } })
      .then(r => {
        const matched = r.data.filter(t =>
          t.requester_email?.toLowerCase() === email.toLowerCase()
        )
        setTickets(matched)
      })
      .catch(() => {})
  }, [email])

  if (tickets.length === 0) return (
    <div className="py-6 text-center text-slate-400 text-sm">
      {isAr ? 'لا توجد تذاكر مرتبطة' : 'No related tickets'}
    </div>
  )

  const statusColor = { open: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', resolved: 'bg-yellow-100 text-yellow-700', closed: 'bg-slate-100 text-slate-600' }
  const statusAr    = { open: 'مفتوحة', in_progress: 'جاري', resolved: 'محلولة', closed: 'مغلقة' }

  return (
    <div className="divide-y divide-slate-50">
      {tickets.map(t => (
        <div key={t.id}
          onClick={() => navigate(`/tickets/${t.id}`)}
          className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 -mx-5 px-5 transition-colors">
          <span className="text-slate-400 text-xs font-mono w-8 shrink-0">#{t.id}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
            <p className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('ar-EG')}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColor[t.status] || 'bg-slate-100 text-slate-600'}`}>
            {statusAr[t.status] || t.status}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MailboxDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const isAr = lang === 'ar'

  const [mb, setMb]       = useState(null)
  const [loading, setLd]  = useState(true)
  const [error, setErr]   = useState(null)

  useEffect(() => {
    api.get(`/mailboxes/${id}`)
      .then(r => setMb(r.data))
      .catch(() => setErr(true))
      .finally(() => setLd(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center space-y-2">
        <div className="text-4xl animate-pulse">📬</div>
        <p>{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    </div>
  )

  if (error || !mb) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center space-y-3">
        <div className="text-4xl">❌</div>
        <p>{isAr ? 'لم يتم العثور على الصندوق' : 'Mailbox not found'}</p>
        <button onClick={() => navigate('/mailboxes')}
          className="px-4 py-2 bg-yellow-600 text-white rounded-xl text-sm hover:bg-yellow-700">
          {isAr ? 'رجوع' : 'Back'}
        </button>
      </div>
    </div>
  )

  const days   = daysSince(mb.last_logon)
  const lColor = logonColor(days)

  const createYear = mb.create_date
    ? (() => { try { return mb.create_date.split('/').pop() } catch { return '—' } })()
    : '—'

  const accountAge = mb.create_date
    ? (() => {
        try {
          const parts = mb.create_date.split('/')
          const d = new Date(`${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`)
          const yrs = Math.floor((Date.now() - d) / (365.25 * 86400000))
          return yrs > 0 ? `${yrs} ${isAr ? 'سنة' : 'yr'}` : `< 1 ${isAr ? 'سنة' : 'yr'}`
        } catch { return '—' }
      })()
    : '—'

  return (
    <div className="space-y-5 max-w-5xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Back */}
      <button onClick={() => navigate('/mailboxes')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-yellow-600 transition-colors">
        <span>{isAr ? '→' : '←'}</span>
        <span>{isAr ? 'العودة إلى قائمة الصناديق' : 'Back to mailboxes'}</span>
      </button>

      {/* Hero card */}
      <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex items-start gap-5 flex-wrap">

          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-4xl font-black text-white shadow-inner shrink-0">
            {(mb.display_name || mb.email).charAt(0).toUpperCase()}
          </div>

          {/* Name & Email */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black">{mb.name_ar || mb.display_name || mb.email}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${mb.status === 'active' ? 'bg-yellow-400/30 text-yellow-100' : 'bg-red-400/30 text-red-200'}`}>
                {mb.status === 'active' ? (isAr ? '✅ نشط' : '✅ Active') : (isAr ? '⛔ معطل' : '⛔ Inactive')}
              </span>
              {mb.employee_code && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white font-mono">
                  🔢 {mb.employee_code}
                </span>
              )}
              {mb.mobile_device === 'true' && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-400/30 text-blue-100">📱 {isAr ? 'موبايل' : 'Mobile'}</span>
              )}
            </div>
            <p className="text-yellow-200 font-mono text-sm" dir="ltr">{mb.email}</p>
            {mb.domain && <p className="text-yellow-300 text-xs">{mb.domain}</p>}
          </div>

          {/* Quick stats */}
          <div className="flex gap-4 flex-wrap">
            {[
              { label: isAr ? 'الحجم' : 'Size',    value: sizeFmt(mb.total_size_mb), icon: '💾' },
              { label: isAr ? 'الرسائل' : 'Items',  value: fmt(mb.total_items),       icon: '📧' },
              { label: isAr ? 'عمر الحساب' : 'Age', value: accountAge,                icon: '📅' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-2xl px-4 py-3 text-center min-w-20">
                <p className="text-xl">{s.icon}</p>
                <p className="text-white font-black text-lg leading-tight">{s.value}</p>
                <p className="text-yellow-200 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Activity */}
          <Section title={`⏱️ ${isAr ? 'النشاط والاستخدام' : 'Activity & Usage'}`}>
            <div className="space-y-4 py-2">

              {/* Last logon highlight */}
              <div className={`rounded-2xl px-4 py-4 ${lColor.badge}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs font-medium opacity-70">{isAr ? 'آخر تسجيل دخول' : 'Last Logon'}</p>
                    <p className={`text-lg font-black mt-0.5 ${lColor.text}`}>
                      {days === null ? (isAr ? 'لم يسجل دخول' : 'Never logged in') :
                       days === 0   ? (isAr ? 'اليوم' : 'Today') :
                       isAr ? `منذ ${days} يوم` : `${days} days ago`}
                    </p>
                    {mb.last_logon && (
                      <p className="text-xs opacity-60 mt-0.5" dir="ltr">{fmtDate(mb.last_logon, 'en-GB')}</p>
                    )}
                  </div>
                  {days !== null && (
                    <div className={`text-4xl font-black opacity-20`}>{days}د</div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                {[
                  { label: isAr ? 'تاريخ إنشاء الحساب' : 'Account Created', value: mb.create_date || '—', icon: '🎂', mono: false },
                  { label: isAr ? 'آخر تسجيل دخول' : 'Last Logon',  value: fmtDate(mb.last_logon,  'en-GB'), icon: '🔓', mono: true },
                  { label: isAr ? 'آخر تسجيل خروج' : 'Last Logoff', value: fmtDate(mb.last_logoff, 'en-GB'), icon: '🔒', mono: true },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-4 py-2 border-b border-slate-50 last:border-0">
                    <span className="text-xl w-8 text-center shrink-0">{r.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs text-slate-400">{r.label}</p>
                      <p className={`text-sm font-semibold text-slate-800 mt-0.5 ${r.mono ? 'font-mono' : ''}`} dir={r.mono ? 'ltr' : undefined}>
                        {r.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Storage */}
          <Section title={`💾 ${isAr ? 'مساحة التخزين' : 'Storage'}`}>
            <div className="py-3 space-y-4">
              <SizeGauge mb={mb.total_size_mb} />
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: isAr ? 'الحجم الكلي' : 'Total Size', value: sizeFmt(mb.total_size_mb), icon: '💾' },
                  { label: isAr ? 'إجمالي الرسائل' : 'Total Items', value: fmt(mb.total_items), icon: '📧' },
                  { label: isAr ? 'حجم المرفقات' : 'Attachments', value: mb.attachment_size?.split('(')[0]?.trim() || '—', icon: '📎' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xl">{s.icon}</p>
                    <p className="font-black text-slate-800 text-sm mt-1">{s.value}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Related Tickets */}
          <Section title={`🎫 ${isAr ? 'التذاكر المرتبطة' : 'Related Tickets'}`}>
            <RelatedTickets email={mb.email} />
          </Section>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Personal info */}
          <Section title={`👤 ${isAr ? 'بيانات الموظف' : 'Employee Info'}`}>
            <div>
              <InfoRow icon="🪪" label={isAr ? 'الاسم الكامل' : 'Full Name'}
                value={[mb.first_name, mb.last_name].filter(Boolean).join(' ') || mb.display_name} />
              <InfoRow icon="💼" label={isAr ? 'المسمى الوظيفي' : 'Job Title'}  value={mb.job_title} />
              <InfoRow icon="🏢" label={isAr ? 'القسم' : 'Department'}          value={mb.department} />
              <InfoRow icon="🏬" label={isAr ? 'المكتب' : 'Office'}             value={mb.office} />
              <InfoRow icon="📞" label={isAr ? 'هاتف العمل' : 'Business Phone'} value={mb.business_phone} mono />
              <InfoRow icon="📱" label={isAr ? 'المحمول' : 'Mobile'}            value={mb.mobile_phone} mono />
              {!mb.first_name && !mb.job_title && !mb.department && !mb.office && !mb.business_phone && !mb.mobile_phone && (
                <p className="py-4 text-center text-slate-400 text-sm">{isAr ? 'لا توجد بيانات إضافية' : 'No additional info'}</p>
              )}
            </div>
          </Section>

          {/* Account info */}
          <Section title={`⚙️ ${isAr ? 'بيانات الحساب' : 'Account Details'}`}>
            <div>
              <InfoRow icon="🔢" label={isAr ? 'كود الموظف' : 'Employee Code'} value={mb.employee_code} mono />
              <InfoRow icon="🆔" label={isAr ? 'معرف الحساب' : 'Account ID'}   value={mb.account_id}   mono />
              <InfoRow icon="🔑" label={isAr ? 'اسم الحساب' : 'Account Name'}  value={mb.account_name} mono />
              <InfoRow icon="🌐" label={isAr ? 'الدومين' : 'Domain'}           value={mb.domain}       mono />
              <InfoRow icon="📅" label={isAr ? 'سنة الإنشاء' : 'Created Year'} value={createYear} />
              <InfoRow icon="📱" label={isAr ? 'جهاز موبايل' : 'Mobile Device'}
                value={mb.mobile_device === 'true' ? (isAr ? 'مرتبط' : 'Linked') : (isAr ? 'غير مرتبط' : 'None')} />
            </div>
          </Section>

          {/* Last logon summary badge */}
          <div className={`rounded-2xl p-4 text-center ${lColor.badge}`}>
            <p className="text-3xl mb-1">
              {days === null ? '❓' : days <= 7 ? '🟢' : days <= 30 ? '🟡' : days <= 90 ? '🟠' : '🔴'}
            </p>
            <p className={`font-black text-lg ${lColor.text}`}>
              {days === null
                ? (isAr ? 'لا يوجد تسجيل دخول' : 'No logon record')
                : days === 0
                  ? (isAr ? 'نشط اليوم' : 'Active today')
                  : days <= 7
                    ? (isAr ? 'نشط هذا الأسبوع' : 'Active this week')
                    : days <= 30
                      ? (isAr ? 'نشط هذا الشهر' : 'Active this month')
                      : days <= 90
                        ? (isAr ? 'نشط آخر 3 أشهر' : 'Last 3 months')
                        : days <= 365
                          ? (isAr ? 'أكثر من 90 يوم' : 'Over 90 days')
                          : (isAr ? '⚠️ غير نشط > سنة' : '⚠️ Inactive > 1yr')}
            </p>
            {days !== null && (
              <p className="text-xs opacity-60 mt-1">
                {isAr ? `آخر دخول: ${days} يوم` : `Last seen: ${days} days ago`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
