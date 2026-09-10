import { useState, useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'
import api from '../api/client'

function Kpi({ label, value, color = 'yellow' }) {
  const cls = {
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    blue:    'bg-blue-50    text-blue-700    border-blue-200',
    red:     'bg-red-50     text-red-700     border-red-200',
    amber:   'bg-amber-50   text-amber-700   border-amber-200',
  }
  return (
    <div className={`rounded-2xl border px-4 py-3 text-center ${cls[color]}`}>
      <p className="text-2xl font-black">{(value ?? 0).toLocaleString()}</p>
      <p className="text-xs mt-0.5 font-medium">{label}</p>
    </div>
  )
}

export default function EmployeeDiscrepancies() {
  const { lang } = useLanguage()
  const isAr = lang === 'ar'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('not_found')   // 'not_found' | 'duplicates'

  useEffect(() => {
    api.get('/employees/discrepancies').then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-12 text-center text-slate-400 text-sm">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
  }
  if (!data) return null

  const { summary, not_found, duplicates } = data

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {isAr ? 'تقرير الفروقات (الأكواد والبريد الإلكتروني)' : 'Discrepancy Report (Codes & Emails)'}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {isAr
            ? 'مقارنة الأكواد المسجلة مع البريد الإلكتروني (مايلبوكس) بالأكواد والأسماء الفعلية من ملف الموارد البشرية'
            : 'Compares codes attached to mailboxes against the actual HR employee directory'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Kpi label={isAr ? 'إجمالي السجلات' : 'Total'} value={summary.total} color="yellow" />
        <Kpi label={isAr ? 'لديهم بريد' : 'With Email'} value={summary.with_email} color="blue" />
        <Kpi label={isAr ? 'لديهم كود' : 'With Code'} value={summary.with_code} color="blue" />
        <Kpi label={isAr ? 'أكواد غير موجودة فعلياً' : 'Codes Not Found'} value={summary.code_not_found} color="red" />
        <Kpi label={isAr ? 'أكواد مكررة' : 'Duplicate Codes'} value={summary.duplicate_codes} color="amber" />
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('not_found')}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${tab === 'not_found' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200'}`}>
          {isAr ? `أكواد غير موجودة (${not_found.length})` : `Codes Not Found (${not_found.length})`}
        </button>
        <button onClick={() => setTab('duplicates')}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${tab === 'duplicates' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200'}`}>
          {isAr ? `أكواد مكررة (${duplicates.length})` : `Duplicate Codes (${duplicates.length})`}
        </button>
      </div>

      {tab === 'not_found' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-start text-slate-500 font-medium w-10">#</th>
                <th className="px-4 py-3 text-start text-slate-500 font-medium">{isAr ? 'البريد الإلكتروني' : 'Email'}</th>
                <th className="px-4 py-3 text-start text-slate-500 font-medium">{isAr ? 'النطاق' : 'Domain'}</th>
                <th className="px-4 py-3 text-start text-slate-500 font-medium">{isAr ? 'الكود' : 'Code'}</th>
                <th className="px-4 py-3 text-start text-slate-500 font-medium">{isAr ? 'ملاحظة' : 'Note'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {not_found.map((e, i) => (
                <tr key={e.id} className="hover:bg-red-50/50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{e.email}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.domain}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-lg bg-red-50 text-red-700 font-mono text-xs font-bold">
                      {e.employee_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-red-500 text-xs">
                    {isAr ? 'الكود غير موجود في ملف الموظفين الفعلي' : 'Code not found in actual HR file'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {not_found.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <div className="text-4xl mb-2">✅</div>
              <p>{isAr ? 'لا توجد أكواد غير متطابقة' : 'No mismatched codes'}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'duplicates' && (
        <div className="space-y-3">
          {duplicates.map(d => (
            <div key={d.employee_code} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-mono text-xs font-bold">
                  {d.employee_code}
                </span>
                {d.name_ar && <span className="text-slate-700 text-sm font-semibold">{d.name_ar}</span>}
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {d.rows.map(r => (
                    <tr key={r.id}>
                      <td className="py-1.5 font-mono text-xs text-slate-600">{r.email || '—'}</td>
                      <td className="py-1.5 text-slate-400 text-xs">{r.domain || '—'}</td>
                      <td className="py-1.5 text-slate-500 text-xs">{r.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {duplicates.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 py-12 text-center text-slate-400">
              <div className="text-4xl mb-2">✅</div>
              <p>{isAr ? 'لا توجد أكواد مكررة' : 'No duplicate codes'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
