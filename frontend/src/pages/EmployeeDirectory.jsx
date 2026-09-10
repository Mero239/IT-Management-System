import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import api from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatChip({ label, value, color = 'yellow', onClick }) {
  const cls = {
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    blue:    'bg-blue-50    text-blue-700    border-blue-200',
    amber:   'bg-amber-50   text-amber-700   border-amber-200',
    slate:   'bg-slate-50   text-slate-600   border-slate-200',
    purple:  'bg-purple-50  text-purple-700  border-purple-200',
  }
  return (
    <div onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-center ${cls[color]} ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}>
      <p className="text-2xl font-black">{(value ?? 0).toLocaleString()}</p>
      <p className="text-xs mt-0.5 font-medium">{label}</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EmployeeDirectory() {
  const { lang } = useLanguage()
  const navigate  = useNavigate()
  const isAr = lang === 'ar'

  const [employees, setEmployees] = useState([])
  const [stats, setStats]         = useState(null)
  const [q, setQ]                 = useState('')
  const [company, setCompany]     = useState('')
  const [hasEmail, setHasEmail]   = useState('')   // '' | 'true' | 'false'
  const [loading, setLoading]     = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImpRes] = useState(null)
  const [page, setPage]           = useState(0)
  const [hasMore, setHasMore]     = useState(true)
  const fileRef  = useRef()
  const timer    = useRef()
  const LIMIT    = 50

  const fetchStats = () => {
    api.get('/employees/count').then(r => setStats(r.data)).catch(() => {})
  }

  useEffect(() => { fetchStats() }, [])

  const fetchEmployees = useCallback((reset = false) => {
    const offset = reset ? 0 : page * LIMIT
    setLoading(true)
    const params = { limit: LIMIT, offset }
    if (q)        params.q        = q
    if (company)  params.company  = company
    if (hasEmail) params.has_email = hasEmail
    api.get('/employees', { params }).then(r => {
      if (reset) { setEmployees(r.data); setPage(1) }
      else        { setEmployees(p => [...p, ...r.data]); setPage(p => p + 1) }
      setHasMore(r.data.length === LIMIT)
    }).finally(() => setLoading(false))
  }, [q, company, hasEmail, page])

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => fetchEmployees(true), 300)
    return () => clearTimeout(timer.current)
  }, [q, company, hasEmail])

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setImpRes(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await api.post('/employees/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setImpRes(r.data)
      fetchStats()
      fetchEmployees(true)
    } catch (err) {
      setImpRes({ error: err.response?.data?.detail || 'فشل الاستيراد' })
    } finally {
      setImporting(false)
      fileRef.current.value = ''
    }
  }

  const handleSyncEngineers = async () => {
    try {
      const r = await api.post('/employees/sync-engineers')
      alert(`تم مزامنة ${r.data.synced} مهندس`)
    } catch {}
  }

  const companyColor = (c) => {
    const map = {
      'موبيكا للصناعات المتكاملة': 'bg-yellow-100 text-yellow-700',
      'موبيكا للصناعات المتطورة':  'bg-blue-100    text-blue-700',
      'IBS':                        'bg-amber-100   text-amber-700',
      'وود ستيل':                   'bg-purple-100  text-purple-700',
      'نجارة المبانى العصرية':       'bg-yellow-100  text-yellow-700',
    }
    return map[c] || 'bg-slate-100 text-slate-600'
  }

  const displayName = (emp) => emp.name_ar || emp.name || emp.email?.split('@')[0] || '—'

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isAr ? 'دليل الموظفين' : 'Employee Directory'}
          </h1>
          {stats && (
            <p className="text-slate-500 text-sm mt-0.5">
              {stats.total?.toLocaleString()} {isAr ? 'موظف' : 'employees'} —
              {stats.with_email?.toLocaleString()} {isAr ? 'لديهم إيميل' : 'with email'} —
              {stats.merged?.toLocaleString()} {isAr ? 'مدمجون' : 'merged'}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => navigate('/employees/discrepancies')}
            className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-medium border border-amber-200">
            ⚠️ {isAr ? 'تقرير الفروقات' : 'Discrepancy Report'}
          </button>
          <button onClick={handleSyncEngineers}
            className="px-3 py-2 rounded-xl bg-yellow-50 text-yellow-700 hover:bg-yellow-100 text-sm font-medium border border-yellow-200">
            🔗 {isAr ? 'مزامنة IT' : 'Sync IT'}
          </button>
          <label className={`px-3 py-2 rounded-xl text-sm font-medium cursor-pointer ${importing ? 'bg-slate-100 text-slate-400' : 'bg-yellow-600 text-white hover:bg-yellow-700'}`}>
            {importing ? '⏳ ...' : `📥 ${isAr ? 'استيراد Excel' : 'Import Excel'}`}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`rounded-xl px-4 py-3 text-sm ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {importResult.error ? importResult.error : (
            <>✅ {importResult.imported} جديد — {importResult.updated} محدث — {importResult.skipped} بدون تغيير</>
          )}
        </div>
      )}

      {/* KPI chips */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatChip label={isAr ? 'إجمالي الموظفين' : 'Total'} value={stats.total} color="yellow"
            onClick={() => { setHasEmail(''); setCompany('') }} />
          <StatChip label={isAr ? 'لديهم بريد' : 'With Email'} value={stats.with_email} color="blue"
            onClick={() => setHasEmail(hasEmail === 'true' ? '' : 'true')} />
          <StatChip label={isAr ? 'بدون بريد' : 'No Email'} value={stats.total - stats.with_email} color="amber"
            onClick={() => setHasEmail(hasEmail === 'false' ? '' : 'false')} />
          <StatChip label={isAr ? 'لديهم كود' : 'With Code'} value={stats.with_code} color="purple" />
          <StatChip label={isAr ? 'مدمجون' : 'Merged'} value={stats.merged} color="slate" />
        </div>
      )}

      {/* Company filter chips */}
      {stats?.companies && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCompany('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!company ? 'bg-yellow-600 text-white border-yellow-600' : 'bg-white text-slate-600 border-slate-200 hover:border-yellow-300'}`}>
            {isAr ? 'الكل' : 'All'}
          </button>
          {stats.companies.map(c => (
            <button key={c.company} onClick={() => setCompany(company === c.company ? '' : c.company)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${company === c.company ? 'bg-yellow-600 text-white border-yellow-600' : 'bg-white text-slate-600 border-slate-200 hover:border-yellow-300'}`}>
              {c.company} ({c.count})
            </button>
          ))}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder={isAr ? 'ابحث بالاسم أو الكود أو الإيميل أو القطاع...' : 'Search name, code, email, sector...'}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
        </div>
        <select value={hasEmail} onChange={e => setHasEmail(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
          <option value="">{isAr ? 'كل الموظفين' : 'All'}</option>
          <option value="true">{isAr ? 'لديهم بريد' : 'With email'}</option>
          <option value="false">{isAr ? 'بدون بريد' : 'No email'}</option>
        </select>
        {(q || company || hasEmail) && (
          <button onClick={() => { setQ(''); setCompany(''); setHasEmail('') }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 text-sm transition-colors">
            ✕ {isAr ? 'مسح' : 'Clear'}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-start text-slate-500 font-medium w-10">#</th>
              <th className="px-4 py-3 text-start text-slate-500 font-medium">{isAr ? 'الاسم' : 'Name'}</th>
              <th className="px-4 py-3 text-start text-slate-500 font-medium">{isAr ? 'الكود' : 'Code'}</th>
              <th className="px-4 py-3 text-start text-slate-500 font-medium hidden md:table-cell">{isAr ? 'الشركة / القطاع' : 'Company / Sector'}</th>
              <th className="px-4 py-3 text-start text-slate-500 font-medium hidden lg:table-cell">{isAr ? 'البريد' : 'Email'}</th>
              <th className="px-4 py-3 text-start text-slate-500 font-medium hidden lg:table-cell">{isAr ? 'تاريخ التعيين' : 'Hire Date'}</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {employees.map((emp, i) => (
                <tr key={emp.id}
                  onClick={() => navigate(`/employees/${emp.id}`)}
                  className="hover:bg-yellow-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-sm shrink-0">
                        {displayName(emp).charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 leading-tight">{displayName(emp)}</p>
                        {emp.email && (
                          <p className="text-slate-400 text-xs mt-0.5" dir="ltr">{emp.email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {emp.employee_code ? (
                      <span className="px-2 py-0.5 rounded-lg bg-yellow-50 text-yellow-700 font-mono text-xs font-bold">
                        {emp.employee_code}
                      </span>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {emp.company && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${companyColor(emp.company)}`}>
                        {emp.company}
                      </span>
                    )}
                    {emp.sector && (
                      <p className="text-slate-400 text-xs mt-1 max-w-[180px] truncate">{emp.sector}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {emp.email
                      ? <span className="text-slate-600 font-mono text-xs">{emp.email}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">
                    {emp.hire_date || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">›</td>
                </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="py-8 text-center text-slate-400 text-sm">
            {isAr ? 'جاري التحميل...' : 'Loading...'}
          </div>
        )}
        {!loading && employees.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <div className="text-4xl mb-2">👥</div>
            <p>{isAr ? 'لا يوجد موظفون' : 'No employees found'}</p>
          </div>
        )}
        {hasMore && !loading && employees.length > 0 && (
          <div className="p-4 border-t border-slate-100 text-center">
            <button onClick={() => fetchEmployees(false)}
              className="px-6 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium">
              {isAr ? 'تحميل المزيد' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
