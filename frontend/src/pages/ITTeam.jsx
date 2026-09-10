import { useEffect, useState } from 'react'
import Header from '../components/Header'
import TicketQR from '../components/TicketQR'
import { engineersApi } from '../api/client'

const PERMISSION_LEVELS = {
  admin: {
    label: 'Admin',
    labelAr: 'مدير',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: '🔴',
    desc: 'صلاحية كاملة على جميع التذاكر',
  },
  engineer: {
    label: 'Engineer',
    labelAr: 'مهندس',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: '🟢',
    desc: 'إنشاء وتعديل التذاكر المسندة إليه',
  },
  viewer: {
    label: 'Viewer',
    labelAr: 'مشاهد',
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: '⚪',
    desc: 'مشاهدة التذاكر فقط بدون تعديل',
  },
}

const PERMISSION_ACTIONS = [
  { key: 'view_all_tickets',  label: 'مشاهدة جميع التذاكر' },
  { key: 'create_ticket',     label: 'إنشاء تذكرة' },
  { key: 'edit_own_ticket',   label: 'تعديل التذاكر المسندة إليه' },
  { key: 'edit_any_ticket',   label: 'تعديل أي تذكرة' },
  { key: 'assign_ticket',     label: 'إسناد التذاكر للمهندسين' },
  { key: 'change_status',     label: 'تغيير حالة التذكرة' },
  { key: 'close_ticket',      label: 'إغلاق التذكرة نهائياً' },
  { key: 'delete_ticket',     label: 'حذف التذكرة' },
]

// Read-only team directory. Adding/editing/deleting engineers or changing
// permissions is admin-only functionality — that lives exclusively in
// AdminEngineers.jsx (/admin/engineers), guarded by AdminGuard + a
// server-side admin check. This page must stay view-only.
export default function ITTeam() {
  const [engineers, setEngineers] = useState([])
  const [matrix, setMatrix] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('team') // team | matrix | qr

  useEffect(() => {
    setLoading(true)
    Promise.all([
      engineersApi.list(),
      engineersApi.permissionMatrix(),
    ]).then(([e, m]) => {
      setEngineers(e.data)
      setMatrix(m.data)
    }).finally(() => setLoading(false))
  }, [])

  const byLevel = (level) => engineers.filter(e => e.permission_level === level)

  return (
    <div className="space-y-5 max-w-5xl">
      <Header title="فريق IT" subtitle="دليل الفريق وصلاحياتهم على التذاكر" />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الفريق', value: engineers.length, icon: '👥', color: '' },
          { label: 'مدراء', value: byLevel('admin').length, icon: '🔴', color: 'border-red-100 bg-red-50' },
          { label: 'مهندسون', value: byLevel('engineer').length, icon: '🟢', color: 'border-yellow-100 bg-yellow-50' },
          { label: 'مشاهدون', value: byLevel('viewer').length, icon: '⚪', color: 'border-slate-100 bg-slate-50' },
        ].map(c => (
          <div key={c.label} className={`card !p-4 border-2 ${c.color || 'border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">{c.label}</p>
                <p className="text-3xl font-bold mt-0.5">{c.value}</p>
              </div>
              <span className="text-2xl">{c.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'team',   label: '👥 الفريق' },
          { key: 'matrix', label: '🔐 جدول الصلاحيات' },
          { key: 'qr',     label: '📱 QR Code' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: TEAM (read-only directory) ── */}
      {tab === 'team' && (
        loading ? (
          <div className="card text-center py-12 text-slate-400">جاري التحميل...</div>
        ) : (
          <div className="card !p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="table-th w-8 text-center">#</th>
                  <th className="table-th">المهندس</th>
                  <th className="table-th">البريد الإلكتروني</th>
                  <th className="table-th">الدور</th>
                  <th className="table-th text-center">الصلاحية</th>
                  <th className="table-th text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {engineers.map((eng, i) => {
                  const perm = PERMISSION_LEVELS[eng.permission_level] || PERMISSION_LEVELS.viewer
                  return (
                    <tr key={eng.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="table-td text-center text-slate-400 text-xs">{i + 1}</td>
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-yellow-100 text-yellow-700 font-bold text-sm flex items-center justify-center shrink-0">
                            {eng.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                          </div>
                          <span className="font-semibold text-slate-800">{eng.name}</span>
                        </div>
                      </td>
                      <td className="table-td text-slate-500 text-sm">
                        <a href={`mailto:${eng.email}`} className="hover:text-yellow-600 transition-colors">{eng.email}</a>
                      </td>
                      <td className="table-td">
                        <span className="badge bg-yellow-50 text-yellow-700">{eng.role}</span>
                      </td>
                      <td className="table-td text-center">
                        <span className={`badge border ${perm.color}`}>{perm.icon} {perm.labelAr}</span>
                      </td>
                      <td className="table-td text-center">
                        {eng.active === 'true'
                          ? <span className="badge bg-yellow-100 text-yellow-700">🟢 نشط</span>
                          : <span className="badge bg-slate-100 text-slate-500">⚪ غير نشط</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── TAB: QR CODE ── */}
      {tab === 'qr' && (
        <div className="max-w-md mx-auto">
          <TicketQR />
        </div>
      )}

      {/* ── TAB: PERMISSION MATRIX (read-only reference) ── */}
      {tab === 'matrix' && matrix && (
        <div className="space-y-4">
          <div className="card !p-0 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="font-bold text-slate-700">🔐 جدول صلاحيات التذاكر</h3>
              <p className="text-xs text-slate-400 mt-0.5">تحديد ما يمكن لكل مستوى صلاحية فعله على التذاكر</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="table-th">الإجراء</th>
                    {Object.entries(PERMISSION_LEVELS).map(([key, p]) => (
                      <th key={key} className="table-th text-center">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${p.color}`}>
                          {p.icon} {p.labelAr}
                        </div>
                        <p className="text-xs text-slate-400 font-normal mt-1">{byLevel(key).length} مهندس</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {PERMISSION_ACTIONS.map((action, i) => (
                    <tr key={action.key} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="table-td font-medium text-slate-700">{action.label}</td>
                      {Object.keys(PERMISSION_LEVELS).map(level => (
                        <td key={level} className="table-td text-center">
                          {matrix[level]?.[action.key]
                            ? <span className="text-yellow-500 text-lg">✅</span>
                            : <span className="text-slate-300 text-lg">❌</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-level summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(PERMISSION_LEVELS).map(([level, p]) => (
              <div key={level} className={`card border-2 ${p.color}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{p.icon}</span>
                  <div>
                    <p className="font-bold text-slate-800">{p.labelAr}</p>
                    <p className="text-xs text-slate-500">{p.desc}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {PERMISSION_ACTIONS.map(a => (
                    <div key={a.key} className="flex items-center gap-2 text-sm">
                      <span>{matrix[level]?.[a.key] ? '✅' : '❌'}</span>
                      <span className={matrix[level]?.[a.key] ? 'text-slate-700' : 'text-slate-400 line-through'}>
                        {a.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                  <p className="text-xs text-slate-500">
                    المهندسون: {byLevel(level).map(e => e.name).join('، ') || '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
