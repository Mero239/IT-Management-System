import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import api from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function age(dateStr) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    const yrs = Math.floor((Date.now() - d) / (365.25 * 86400000))
    return yrs > 0 ? yrs : null
  } catch { return null }
}

function fmt(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return dateStr }
}

function InfoRow({ icon, label, value, mono, dir: d }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <span className="text-base w-6 text-center shrink-0 mt-0.5">{icon}</span>
      <span className="text-slate-400 text-sm w-36 shrink-0">{label}</span>
      <span className={`text-slate-800 text-sm font-medium flex-1 break-all ${mono ? 'font-mono' : ''}`} dir={d}>{value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="font-bold text-slate-700 text-sm">{title}</h3>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  )
}

// ── Related Tickets ───────────────────────────────────────────────────────────

function RelatedTickets({ email, isAr }) {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!email) { setLoading(false); return }
    api.get('/tickets/', { params: { limit: 200 } })
      .then(r => setTickets(r.data.filter(t => t.requester_email?.toLowerCase() === email.toLowerCase())))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [email])

  if (loading) return <div className="py-4 text-center text-slate-400 text-sm">...</div>
  if (!email)  return <div className="py-6 text-center text-slate-400 text-sm">{isAr ? 'لا يوجد بريد إلكتروني' : 'No email available'}</div>
  if (!tickets.length) return <div className="py-6 text-center text-slate-400 text-sm">{isAr ? 'لا توجد تذاكر' : 'No tickets found'}</div>

  const STATUS_MAP = {
    open:        { ar: 'مفتوحة',  cls: 'bg-blue-100 text-blue-700' },
    in_progress: { ar: 'جاري',   cls: 'bg-amber-100 text-amber-700' },
    resolved:    { ar: 'محلولة', cls: 'bg-yellow-100 text-yellow-700' },
    closed:      { ar: 'مغلقة',  cls: 'bg-slate-100 text-slate-600' },
  }
  const PRI_MAP = {
    low:      { ar: 'منخفض',  cls: 'text-yellow-600' },
    medium:   { ar: 'متوسط',  cls: 'text-yellow-500' },
    high:     { ar: 'عالي',   cls: 'text-red-500' },
    critical: { ar: 'حرج',    cls: 'text-red-700 font-black' },
  }

  const open     = tickets.filter(t => !['resolved','closed'].includes(t.status)).length
  const resolved = tickets.length - open

  return (
    <div>
      <div className="flex gap-3 py-3 border-b border-slate-100 text-sm">
        <span className="text-yellow-600 font-bold">{tickets.length} {isAr ? 'إجمالي' : 'total'}</span>
        <span className="text-amber-600 font-bold">{open} {isAr ? 'نشطة' : 'open'}</span>
        <span className="text-slate-400">{resolved} {isAr ? 'منتهية' : 'resolved'}</span>
      </div>
      <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
        {tickets.map(t => {
          const st  = STATUS_MAP[t.status]  || { ar: t.status,   cls: 'bg-slate-100 text-slate-600' }
          const pri = PRI_MAP[t.priority]   || { ar: t.priority, cls: 'text-slate-500' }
          return (
            <div key={t.id} onClick={() => navigate(`/tickets/${t.id}`)}
              className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 -mx-5 px-5 transition-colors">
              <span className="text-slate-400 text-xs font-mono w-9 shrink-0">#{t.id}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(t.created_at).toLocaleDateString('ar-EG')}
                  {t.assigned_to && <> · {t.assigned_to}</>}
                </p>
              </div>
              <span className={`text-xs font-bold shrink-0 ${pri.cls}`}>{pri.ar}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${st.cls}`}>{st.ar}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Mailbox Link ──────────────────────────────────────────────────────────────

function MailboxBadge({ email, isAr }) {
  const navigate = useNavigate()
  const [mb, setMb] = useState(null)

  useEffect(() => {
    if (!email) return
    api.get('/mailboxes', { params: { q: email, limit: 1 } })
      .then(r => { if (r.data.length) setMb(r.data[0]) })
      .catch(() => {})
  }, [email])

  if (!mb) return null

  const sizeGB = mb.total_size_mb ? (mb.total_size_mb / 1024).toFixed(1) : '—'
  const days   = mb.last_logon ? Math.floor((Date.now() - new Date(mb.last_logon)) / 86400000) : null

  return (
    <div onClick={() => navigate(`/mailboxes/${mb.id}`)}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 cursor-pointer hover:border-yellow-300 transition-colors group">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-700 text-sm">📬 {isAr ? 'صندوق البريد' : 'Mailbox'}</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${mb.status === 'active' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
          {mb.status === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { icon: '💾', label: isAr ? 'الحجم' : 'Size',    value: `${sizeGB} GB` },
          { icon: '📧', label: isAr ? 'رسائل' : 'Items',   value: (mb.total_items ?? 0).toLocaleString() },
          { icon: '⏱️', label: isAr ? 'آخر دخول' : 'Last', value: days !== null ? `${days}د` : '—' },
        ].map(s => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-lg">{s.icon}</p>
            <p className="font-black text-slate-800 text-sm">{s.value}</p>
            <p className="text-slate-400 text-xs">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-yellow-600 text-center mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        {isAr ? 'عرض تفاصيل الصندوق ←' : 'View mailbox details →'}
      </p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function EmployeeDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { lang }   = useLanguage()
  const isAr       = lang === 'ar'

  const [emp, setEmp]     = useState(null)
  const [loading, setLd]  = useState(true)
  const [error, setErr]   = useState(false)

  useEffect(() => {
    api.get(`/employees/${id}`)
      .then(r => setEmp(r.data))
      .catch(() => setErr(true))
      .finally(() => setLd(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center space-y-2">
        <div className="text-4xl animate-pulse">👤</div>
        <p>{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    </div>
  )

  if (error || !emp) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3 text-slate-400">
        <div className="text-4xl">❌</div>
        <p>{isAr ? 'لم يتم العثور على الموظف' : 'Employee not found'}</p>
        <button onClick={() => navigate('/employees')}
          className="px-4 py-2 bg-yellow-600 text-white rounded-xl text-sm hover:bg-yellow-700">
          {isAr ? 'رجوع' : 'Back'}
        </button>
      </div>
    </div>
  )

  const displayName = emp.name_ar || emp.name || emp.email?.split('@')[0] || '—'
  const initials    = displayName.split(' ').slice(0, 2).map(w => w[0]).join('')
  const birthAge    = age(emp.birth_date)
  const hireYears   = age(emp.hire_date)

  const companyColor = {
    'موبيكا للصناعات المتكاملة': 'from-yellow-500 to-yellow-700',
    'موبيكا للصناعات المتطورة':  'from-blue-500    to-blue-700',
    'IBS':                        'from-amber-500   to-amber-700',
    'وود ستيل':                   'from-purple-500  to-purple-700',
    'نجارة المبانى العصرية':       'from-yellow-500  to-yellow-700',
  }[emp.company] || 'from-slate-500 to-slate-700'

  return (
    <div className="space-y-5 max-w-5xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Back */}
      <button onClick={() => navigate('/employees')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-yellow-600 transition-colors">
        <span>{isAr ? '→' : '←'}</span>
        <span>{isAr ? 'العودة إلى دليل الموظفين' : 'Back to directory'}</span>
      </button>

      {/* Hero */}
      <div className={`bg-gradient-to-br ${companyColor} rounded-3xl p-6 text-white shadow-xl`}>
        <div className="flex items-start gap-5 flex-wrap">

          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-black text-white shadow-inner shrink-0">
            {initials || '👤'}
          </div>

          {/* Name block */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <h1 className="text-2xl font-black leading-tight">{displayName}</h1>
            {emp.sector && <p className="text-white/80 text-sm">{emp.sector}</p>}
            {emp.company && (
              <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white/90 text-xs font-semibold">
                🏢 {emp.company}
              </span>
            )}
            {emp.email && (
              <p className="text-white/70 font-mono text-sm mt-1" dir="ltr">{emp.email}</p>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex gap-3 flex-wrap">
            {[
              emp.employee_code && { icon: '🔢', label: isAr ? 'كود' : 'Code',  value: emp.employee_code },
              hireYears          && { icon: '📅', label: isAr ? 'سنوات الخدمة' : 'Service', value: `${hireYears}` + (isAr ? ' سنة' : ' yrs') },
              birthAge           && { icon: '🎂', label: isAr ? 'العمر' : 'Age', value: `${birthAge}` + (isAr ? ' سنة' : ' yrs') },
            ].filter(Boolean).map(s => (
              <div key={s.label} className="bg-white/15 rounded-2xl px-4 py-3 text-center min-w-20">
                <p className="text-xl">{s.icon}</p>
                <p className="text-white font-black text-lg leading-tight">{s.value}</p>
                <p className="text-white/60 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
            <div className={`rounded-2xl px-4 py-3 text-center min-w-20 ${emp.email ? 'bg-yellow-400/30' : 'bg-white/10'}`}>
              <p className="text-xl">{emp.email ? '📧' : '📭'}</p>
              <p className="text-white font-black text-sm leading-tight">{emp.email ? (isAr ? 'لديه بريد' : 'Has Email') : (isAr ? 'بدون بريد' : 'No Email')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left col */}
        <div className="lg:col-span-2 space-y-5">

          {/* Personal info */}
          <Section title={`👤 ${isAr ? 'البيانات الشخصية' : 'Personal Info'}`}>
            <InfoRow icon="🪪" label={isAr ? 'الاسم الرباعي'   : 'Full Name'}     value={emp.name_ar} />
            <InfoRow icon="🔢" label={isAr ? 'كود الموظف'      : 'Employee Code'} value={emp.employee_code} mono />
            <InfoRow icon="🎂" label={isAr ? 'تاريخ الميلاد'   : 'Date of Birth'} value={fmt(emp.birth_date)}
              dir="ltr" />
            {birthAge && <InfoRow icon="🧮" label={isAr ? 'العمر' : 'Age'} value={`${birthAge} ${isAr ? 'سنة' : 'years'}`} />}
          </Section>

          {/* Work info */}
          <Section title={`💼 ${isAr ? 'بيانات العمل' : 'Work Info'}`}>
            <InfoRow icon="🏢" label={isAr ? 'الشركة'          : 'Company'}       value={emp.company} />
            <InfoRow icon="🏭" label={isAr ? 'القطاع / الوعاء' : 'Sector'}        value={emp.sector} />
            <InfoRow icon="📅" label={isAr ? 'تاريخ التعيين'   : 'Hire Date'}     value={fmt(emp.hire_date)} dir="ltr" />
            {hireYears && <InfoRow icon="⏳" label={isAr ? 'سنوات الخدمة' : 'Service'} value={`${hireYears} ${isAr ? 'سنة' : 'years'}`} />}
          </Section>

          {/* Contact info */}
          {emp.email && (
            <Section title={`📬 ${isAr ? 'بيانات التواصل' : 'Contact'}`}>
              <InfoRow icon="📧" label={isAr ? 'البريد الإلكتروني' : 'Email'}  value={emp.email}  mono dir="ltr" />
              <InfoRow icon="🌐" label={isAr ? 'الدومين'           : 'Domain'} value={emp.domain} mono dir="ltr" />
            </Section>
          )}

          {/* Tickets */}
          <Section title={`🎫 ${isAr ? 'التذاكر المرتبطة' : 'Related Tickets'}`}>
            <RelatedTickets email={emp.email} isAr={isAr} />
          </Section>
        </div>

        {/* Right col */}
        <div className="space-y-5">

          {/* Mailbox card */}
          <MailboxBadge email={emp.email} isAr={isAr} />

          {/* Summary card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            <h3 className="font-bold text-slate-700 text-sm">📊 {isAr ? 'ملخص' : 'Summary'}</h3>
            {[
              {
                label: isAr ? 'البريد الإلكتروني' : 'Email',
                value: emp.email ? (isAr ? 'متاح ✅' : 'Available ✅') : (isAr ? 'غير متاح ⛔' : 'Not available ⛔'),
                cls: emp.email ? 'text-yellow-600' : 'text-red-500',
              },
              {
                label: isAr ? 'كود الموظف' : 'Employee Code',
                value: emp.employee_code ? `${emp.employee_code} ✅` : (isAr ? 'غير متاح ⛔' : 'Not available ⛔'),
                cls: emp.employee_code ? 'text-yellow-600' : 'text-red-500',
              },
              {
                label: isAr ? 'بيانات HR' : 'HR Data',
                value: emp.name_ar ? (isAr ? 'مكتمل ✅' : 'Complete ✅') : (isAr ? 'غير مكتمل ⛔' : 'Incomplete ⛔'),
                cls: emp.name_ar ? 'text-yellow-600' : 'text-red-500',
              },
              {
                label: isAr ? 'بيانات مدمجة' : 'Data Merged',
                value: (emp.email && emp.name_ar) ? (isAr ? 'مدمج ✅' : 'Merged ✅') : (isAr ? 'جزئي ⚠️' : 'Partial ⚠️'),
                cls: (emp.email && emp.name_ar) ? 'text-yellow-600' : 'text-amber-500',
              },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-1">
                <span className="text-slate-500 text-sm">{r.label}</span>
                <span className={`text-sm font-bold ${r.cls}`}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-2">
            <h3 className="font-bold text-slate-700 text-sm mb-3">⚡ {isAr ? 'إجراءات' : 'Actions'}</h3>
            {emp.email && (
              <a href={`mailto:${emp.email}`}
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-yellow-50 text-yellow-700 hover:bg-yellow-100 text-sm font-medium transition-colors">
                <span>✉️</span>
                <span>{isAr ? 'إرسال بريد إلكتروني' : 'Send Email'}</span>
              </a>
            )}
            <button onClick={() => navigate(`/tickets/new?email=${emp.email || ''}&name=${encodeURIComponent(displayName)}`)}
              className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium transition-colors">
              <span>🎫</span>
              <span>{isAr ? 'إنشاء تذكرة دعم' : 'Create Support Ticket'}</span>
            </button>
            {emp.email && (
              <button onClick={() => navigate(`/mailboxes?q=${emp.email}`)}
                className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 text-sm font-medium transition-colors">
                <span>📬</span>
                <span>{isAr ? 'عرض صندوق البريد' : 'View Mailbox'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
