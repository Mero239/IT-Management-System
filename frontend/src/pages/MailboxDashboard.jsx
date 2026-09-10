import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import api from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => (n ?? 0).toLocaleString()

function sizeFmt(mb) {
  if (!mb && mb !== 0) return '—'
  if (mb >= 1024 * 1024) return `${(mb / 1024 / 1024).toFixed(1)} TB`
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

function logonAge(dt) {
  if (!dt) return { label: 'غير متاح', cls: 'text-slate-400', days: null }
  const days = Math.floor((Date.now() - new Date(dt)) / 86400000)
  if (days <= 7)   return { label: `${days}د`, cls: 'text-yellow-600', days }
  if (days <= 30)  return { label: `${days}د`, cls: 'text-yellow-500', days }
  if (days <= 90)  return { label: `${days}د`, cls: 'text-amber-500', days }
  if (days <= 365) return { label: `${Math.floor(days/30)}ش`, cls: 'text-yellow-500', days }
  return { label: `${Math.floor(days/365)}س+`, cls: 'text-red-500', days }
}

function StatCard({ icon, label, value, sub, color = 'yellow' }) {
  const colors = {
    yellow: 'from-yellow-500 to-yellow-600',
    blue:    'from-blue-500 to-blue-600',
    amber:   'from-amber-500 to-amber-600',
    red:     'from-red-500 to-red-600',
    purple:  'from-purple-500 to-purple-600',
    slate:   'from-slate-500 to-slate-600',
  }
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white text-lg shadow-sm`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-black text-slate-800">{value}</p>
      <p className="text-slate-500 text-sm mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function Bar({ label, value, max, color = 'bg-yellow-500' }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-500 w-28 text-right shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-700 font-bold w-10 text-left shrink-0">{value}</span>
    </div>
  )
}

const LOGON_META = {
  '7d':    { label: 'آخر 7 أيام',   color: 'bg-yellow-500' },
  '30d':   { label: 'آخر 30 يوم',   color: 'bg-yellow-400' },
  '90d':   { label: 'آخر 90 يوم',   color: 'bg-amber-400' },
  '1y':    { label: 'آخر سنة',       color: 'bg-yellow-400' },
  'over1y':{ label: 'أكثر من سنة',  color: 'bg-red-500' },
  'never': { label: 'لم يسجل دخول', color: 'bg-slate-400' },
}

const SIZE_META = {
  '100gb+':   { label: '> 100 GB',  color: 'bg-red-500' },
  '50gb+':    { label: '50–100 GB', color: 'bg-yellow-500' },
  '10gb+':    { label: '10–50 GB',  color: 'bg-amber-500' },
  '1gb+':     { label: '1–10 GB',   color: 'bg-yellow-400' },
  '100mb+':   { label: '100MB–1GB', color: 'bg-yellow-400' },
  'under100mb':{ label: '< 100 MB', color: 'bg-yellow-200' },
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MailboxDashboard() {
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const isAr = lang === 'ar'

  const [tab, setTab]         = useState('dashboard')   // dashboard | list
  const [stats, setStats]     = useState(null)
  const [mailboxes, setMb]    = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [importing, setImp]   = useState(false)
  const [importRes, setImpRes] = useState(null)
  const [page, setPage]       = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const fileRef = useRef()

  // Filters
  const [q, setQ]             = useState('')
  const [domain, setDomain]   = useState('')
  const [status, setStatus]   = useState('')
  const [logon, setLogon]     = useState('')
  const [sort, setSort]       = useState('last_logon_desc')
  const searchTimer = useRef()

  const LIMIT = 50

  const fetchStats = () => {
    api.get('/mailboxes/stats').then(r => setStats(r.data)).catch(() => {})
  }

  useEffect(() => { fetchStats() }, [])

  const fetchMb = useCallback((reset = false) => {
    const offset = reset ? 0 : page * LIMIT
    setLoading(true)
    const params = { limit: LIMIT, offset, sort }
    if (q) params.q = q
    if (domain) params.domain = domain
    if (status) params.status = status
    if (logon)  params.logon  = logon
    api.get('/mailboxes', { params }).then(r => {
      if (reset) { setMb(r.data); setPage(1) }
      else { setMb(prev => [...prev, ...r.data]); setPage(p => p + 1) }
      setHasMore(r.data.length === LIMIT)
    }).finally(() => setLoading(false))
  }, [q, domain, status, logon, sort, page])

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchMb(true), 300)
    return () => clearTimeout(searchTimer.current)
  }, [q, domain, status, logon, sort])

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImp(true); setImpRes(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await api.post('/mailboxes/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImpRes(r.data)
      fetchStats()
      fetchMb(true)
    } catch (err) {
      setImpRes({ error: err.response?.data?.detail || 'فشل الاستيراد' })
    } finally {
      setImp(false)
      fileRef.current.value = ''
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isAr ? 'لوحة البريد الإلكتروني' : 'Email Mailbox Dashboard'}
          </h1>
          {stats && (
            <p className="text-slate-500 text-sm mt-0.5">
              {stats.total} {isAr ? 'صندوق بريد' : 'mailboxes'} —
              إجمالي {sizeFmt(stats.total_size_gb * 1024)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <label className={`px-3 py-2 rounded-xl text-sm font-medium cursor-pointer ${importing ? 'bg-slate-100 text-slate-400' : 'bg-yellow-600 text-white hover:bg-yellow-700'}`}>
            {importing ? '⏳ ...' : `📥 ${isAr ? 'استيراد Excel' : 'Import Excel'}`}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
        </div>
      </div>

      {/* Import result */}
      {importRes && (
        <div className={`rounded-xl px-4 py-3 text-sm ${importRes.error ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {importRes.error ? importRes.error : (
            <>✅ تم: <strong>{importRes.imported}</strong> جديد، <strong>{importRes.updated}</strong> محدث، <strong>{importRes.skipped}</strong> بدون تغيير</>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { id: 'dashboard', label: isAr ? '📊 الإحصائيات' : '📊 Dashboard' },
          { id: 'list',      label: isAr ? '📋 قائمة الصناديق' : '📋 Mailbox List' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ── */}
      {tab === 'dashboard' && stats && (
        <div className="space-y-6">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="📬" label={isAr ? 'إجمالي الصناديق' : 'Total Mailboxes'} value={fmt(stats.total)} color="yellow" />
            <StatCard icon="✅" label={isAr ? 'نشطة' : 'Active'} value={fmt(stats.active)}
              sub={`${Math.round(stats.active/stats.total*100)}%`} color="yellow" />
            <StatCard icon="⛔" label={isAr ? 'غير نشطة' : 'Inactive'} value={fmt(stats.inactive)} color="red" />
            <StatCard icon="📱" label={isAr ? 'مع جهاز موبايل' : 'Mobile Device'} value={fmt(stats.with_mobile)}
              sub={`${Math.round(stats.with_mobile/stats.total*100)}%`} color="blue" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="💾" label={isAr ? 'إجمالي الحجم' : 'Total Size'} value={sizeFmt(stats.total_size_gb * 1024)} color="purple" />
            <StatCard icon="📏" label={isAr ? 'متوسط الحجم' : 'Avg Size'} value={sizeFmt(stats.avg_size_gb * 1024)} color="slate" />
            <StatCard icon="📧" label={isAr ? 'متوسط الرسائل' : 'Avg Items'} value={fmt(stats.avg_items)} color="blue" />
            <StatCard icon="🚨" label={isAr ? 'غير نشط > سنة' : 'Stale > 1yr'} value={fmt(stats.stale_count)} color="amber" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Last Logon */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-4">
                {isAr ? '⏱️ آخر تسجيل دخول' : '⏱️ Last Logon'}
              </h3>
              <div className="space-y-3">
                {Object.entries(LOGON_META).map(([key, meta]) => {
                  const val = stats.logon_buckets?.[key] ?? 0
                  const max = Math.max(...Object.values(stats.logon_buckets ?? {}))
                  return (
                    <div key={key} className="flex items-center gap-3 text-sm cursor-pointer group"
                      onClick={() => { setLogon(logon === key ? '' : key); setTab('list') }}>
                      <span className="text-slate-500 w-32 text-right shrink-0 group-hover:text-yellow-600 transition-colors">{meta.label}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-full rounded-full ${meta.color} transition-all`} style={{ width: max > 0 ? `${val/max*100}%` : '0%' }} />
                      </div>
                      <span className="text-slate-700 font-bold w-10 text-left shrink-0">{val}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Size distribution */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-4">
                {isAr ? '💾 توزيع الحجم' : '💾 Size Distribution'}
              </h3>
              <div className="space-y-3">
                {Object.entries(SIZE_META).map(([key, meta]) => {
                  const val = stats.size_buckets?.[key] ?? 0
                  const max = Math.max(...Object.values(stats.size_buckets ?? {}))
                  return (
                    <Bar key={key} label={meta.label} value={val} max={max} color={meta.color} />
                  )
                })}
              </div>
            </div>

            {/* Create year */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-700 mb-4">
                {isAr ? '📅 تاريخ الإنشاء' : '📅 Created By Year'}
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.create_years ?? {}).sort((a,b) => Number(b[0])-Number(a[0])).map(([yr, cnt]) => {
                  const max = Math.max(...Object.values(stats.create_years))
                  return (
                    <div key={yr} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500 w-12 text-right shrink-0 font-mono">{yr}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div className="h-full rounded-full bg-yellow-500" style={{ width: `${cnt/max*100}%` }} />
                      </div>
                      <span className="text-slate-700 font-bold w-10 text-left shrink-0">{cnt}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Domain distribution */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4">🌐 {isAr ? 'توزيع الدومين' : 'Domain Distribution'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(stats.domains ?? {}).map(([dom, cnt]) => (
                <button key={dom}
                  onClick={() => { setDomain(domain === dom ? '' : dom); setTab('list') }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${domain === dom ? 'bg-yellow-600 text-white border-yellow-600' : 'bg-slate-50 border-slate-100 hover:border-yellow-300 text-slate-700'}`}>
                  <span className="truncate font-medium">{dom}</span>
                  <span className={`font-black ml-2 ${domain === dom ? 'text-white' : 'text-yellow-600'}`}>{cnt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Top 10 largest */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-4">🏆 {isAr ? 'أكبر 10 صناديق حجماً' : 'Top 10 Largest Mailboxes'}</h3>
            <div className="space-y-2">
              {(stats.top_largest ?? []).map((m, i) => {
                const age = logonAge(m.last_logon)
                return (
                  <div key={i} onClick={() => m.id && navigate(`/mailboxes/${m.id}`)} className="flex items-center gap-4 py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                    <span className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {(m.display_name || m.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{m.display_name || m.email}</p>
                      <p className="text-slate-400 text-xs truncate" dir="ltr">{m.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-700 text-sm">{sizeFmt(m.total_size_mb)}</p>
                      <p className="text-slate-400 text-xs">{fmt(m.total_items)} رسالة</p>
                    </div>
                    <div className="text-right shrink-0 hidden md:block">
                      <p className={`text-xs font-bold ${age.cls}`}>
                        {m.last_logon ? new Date(m.last_logon).toLocaleDateString('ar-EG') : '—'}
                      </p>
                      <p className="text-slate-400 text-xs">{isAr ? 'آخر دخول' : 'last logon'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${m.status === 'active' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                      {m.status === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── LIST TAB ── */}
      {tab === 'list' && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input value={q} onChange={e => setQ(e.target.value)}
                  placeholder={isAr ? 'بحث باسم أو إيميل...' : 'Search by name or email...'}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" dir="ltr" />
              </div>

              <select value={domain} onChange={e => setDomain(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                <option value="">{isAr ? 'كل الدومينات' : 'All Domains'}</option>
                {Object.keys(stats?.domains ?? {}).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select value={status} onChange={e => setStatus(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                <option value="">{isAr ? 'كل الحالات' : 'All Status'}</option>
                <option value="active">{isAr ? 'نشط' : 'Active'}</option>
                <option value="inactive">{isAr ? 'غير نشط' : 'Inactive'}</option>
              </select>

              <select value={logon} onChange={e => setLogon(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                <option value="">{isAr ? 'كل أوقات الدخول' : 'All Logon Times'}</option>
                {Object.entries(LOGON_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              <select value={sort} onChange={e => setSort(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                <option value="last_logon_desc">{isAr ? 'آخر دخول (الأحدث)' : 'Last Logon ↓'}</option>
                <option value="last_logon_asc">{isAr ? 'آخر دخول (الأقدم)' : 'Last Logon ↑'}</option>
                <option value="size_desc">{isAr ? 'الأكبر حجماً' : 'Size ↓'}</option>
                <option value="size_asc">{isAr ? 'الأصغر حجماً' : 'Size ↑'}</option>
                <option value="items_desc">{isAr ? 'أكثر رسائل' : 'Items ↓'}</option>
                <option value="create_desc">{isAr ? 'الأحدث إنشاءً' : 'Newest'}</option>
                <option value="email_asc">{isAr ? 'الإيميل أبجدياً' : 'Email A-Z'}</option>
              </select>

              {(q || domain || status || logon) && (
                <button onClick={() => { setQ(''); setDomain(''); setStatus(''); setLogon('') }}
                  className="px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-red-500 border border-slate-200 hover:border-red-200 transition-colors">
                  ✕ {isAr ? 'مسح الفلاتر' : 'Clear'}
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-start text-slate-500 font-medium">{isAr ? 'الاسم / الإيميل' : 'Name / Email'}</th>
                    <th className="px-4 py-3 text-start text-slate-500 font-medium hidden md:table-cell">{isAr ? 'الكود' : 'Code'}</th>
                    <th className="px-4 py-3 text-start text-slate-500 font-medium hidden md:table-cell">{isAr ? 'تاريخ الإنشاء' : 'Created'}</th>
                    <th className="px-4 py-3 text-start text-slate-500 font-medium">{isAr ? 'آخر دخول' : 'Last Logon'}</th>
                    <th className="px-4 py-3 text-start text-slate-500 font-medium">{isAr ? 'الحجم' : 'Size'}</th>
                    <th className="px-4 py-3 text-start text-slate-500 font-medium hidden lg:table-cell">{isAr ? 'الرسائل' : 'Items'}</th>
                    <th className="px-4 py-3 text-start text-slate-500 font-medium hidden lg:table-cell">{isAr ? 'موبايل' : 'Mobile'}</th>
                    <th className="px-4 py-3 text-start text-slate-500 font-medium">{isAr ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {mailboxes.map(m => {
                    const age = logonAge(m.last_logon)
                    return (
                      <tr key={m.id} onClick={() => navigate(`/mailboxes/${m.id}`)} className="hover:bg-yellow-50 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-xs shrink-0">
                              {(m.display_name || m.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 truncate max-w-[160px]">
                                {m.name_ar || m.display_name || '—'}
                              </p>
                              <p className="text-slate-400 text-xs truncate max-w-[160px]" dir="ltr">{m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {m.employee_code ? (
                            <span className="px-2 py-0.5 rounded-lg bg-yellow-50 text-yellow-700 font-mono text-xs font-bold">
                              {m.employee_code}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                          {m.create_date || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {m.last_logon ? (
                            <div>
                              <p className={`text-xs font-bold ${age.cls}`}>
                                {age.days !== null ? `منذ ${age.days < 365 ? age.days + ' يوم' : Math.floor(age.days/365) + ' سنة'}` : age.label}
                              </p>
                              <p className="text-slate-400 text-[10px]" dir="ltr">
                                {new Date(m.last_logon).toLocaleDateString('en-GB')}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${m.total_size_mb > 50*1024 ? 'text-red-600' : m.total_size_mb > 10*1024 ? 'text-amber-600' : 'text-slate-700'}`}>
                            {sizeFmt(m.total_size_mb)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs hidden lg:table-cell">
                          {m.total_items ? fmt(m.total_items) : '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {m.mobile_device === 'true' ? (
                            <span className="text-blue-500 text-base" title="Has mobile device">📱</span>
                          ) : (
                            <span className="text-slate-200">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === 'active' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                            {m.status === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {loading && (
              <div className="py-8 text-center text-slate-400 text-sm">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
            )}
            {!loading && mailboxes.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <div className="text-4xl mb-2">📭</div>
                <p>{isAr ? 'لا يوجد صناديق بريد' : 'No mailboxes found'}</p>
              </div>
            )}
            {hasMore && !loading && mailboxes.length > 0 && (
              <div className="p-4 border-t border-slate-100 text-center">
                <button onClick={() => fetchMb(false)}
                  className="px-6 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium">
                  {isAr ? 'تحميل المزيد' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
