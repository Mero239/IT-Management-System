import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Modal from '../components/Modal'
import TicketQR from '../components/TicketQR'
import { engineersApi } from '../api/client'
import { useLanguage } from '../context/LanguageContext'

const ROLES = ['IT Engineer', 'Support Technician', 'Network Engineer', 'Systems Admin', 'IT Manager']

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

const emptyForm = { name: '', email: '', role: 'IT Engineer', active: 'true', permission_level: 'engineer' }

export default function ITTeam() {
  const { t } = useLanguage()
  const [engineers, setEngineers] = useState([])
  const [matrix, setMatrix] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [permModal, setPermModal] = useState(false)
  const [permTarget, setPermTarget] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('team') // team | matrix

  const load = () => {
    setLoading(true)
    Promise.all([
      engineersApi.list(),
      engineersApi.permissionMatrix(),
    ]).then(([e, m]) => {
      setEngineers(e.data)
      setMatrix(m.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd  = () => { setEditing(null); setForm({ ...emptyForm }); setError(''); setModal(true) }
  const openEdit = (e) => { setEditing(e); setForm({ ...e }); setError(''); setModal(true) }
  const openPerm = (e) => { setPermTarget(e); setPermModal(true) }

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError('الاسم والبريد مطلوبان'); return }
    setSaving(true); setError('')
    try {
      if (editing) await engineersApi.update(editing.id, form)
      else await engineersApi.create(form)
      setModal(false); load()
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Error')
    } finally { setSaving(false) }
  }

  const handleSetPermission = async (id, level) => {
    await engineersApi.setPermission(id, level)
    setPermModal(false)
    load()
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`حذف ${name}؟`)) return
    await engineersApi.delete(id); load()
  }

  const byLevel = (level) => engineers.filter(e => e.permission_level === level)

  return (
    <div className="space-y-5 max-w-5xl">
      <Header title="فريق IT" subtitle="إدارة المهندسين وصلاحياتهم على التذاكر" />

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

      {/* ── TAB: TEAM ── */}
      {tab === 'team' && (
        <>
          <div className="flex justify-end">
            <button onClick={openAdd} className="btn-primary">+ إضافة مهندس</button>
          </div>

          {loading ? (
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
                    <th className="table-th text-center">إجراءات</th>
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
                          <button
                            onClick={() => openPerm(eng)}
                            className={`badge border ${perm.color} hover:opacity-80 transition-opacity cursor-pointer`}
                            title="انقر لتغيير الصلاحية"
                          >
                            {perm.icon} {perm.labelAr}
                          </button>
                        </td>
                        <td className="table-td text-center">
                          {eng.active === 'true'
                            ? <span className="badge bg-yellow-100 text-yellow-700">🟢 نشط</span>
                            : <span className="badge bg-slate-100 text-slate-500">⚪ غير نشط</span>}
                        </td>
                        <td className="table-td text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => openEdit(eng)} className="btn-secondary !text-xs !px-3 !py-1.5">تعديل</button>
                            <button onClick={() => handleDelete(eng.id, eng.name)} className="btn-danger">حذف</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TAB: QR CODE ── */}
      {tab === 'qr' && (
        <div className="max-w-md mx-auto">
          <TicketQR />
        </div>
      )}

      {/* ── TAB: PERMISSION MATRIX ── */}
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

      {/* ── Change Permission Modal ── */}
      <Modal isOpen={permModal} onClose={() => setPermModal(false)} title={`صلاحيات ${permTarget?.name}`} size="md">
        {permTarget && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">اختر مستوى الصلاحية للمهندس على التذاكر:</p>
            {Object.entries(PERMISSION_LEVELS).map(([level, p]) => {
              const isCurrent = permTarget.permission_level === level
              return (
                <button
                  key={level}
                  onClick={() => handleSetPermission(permTarget.id, level)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-start ${
                    isCurrent
                      ? `${p.color} shadow-sm`
                      : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}
                >
                  <span className="text-2xl mt-0.5">{p.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{p.labelAr}</span>
                      <span className="text-xs text-slate-400">({p.label})</span>
                      {isCurrent && <span className="badge bg-yellow-100 text-yellow-700 text-xs">الحالي</span>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{p.desc}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {PERMISSION_ACTIONS.filter(a => matrix?.[level]?.[a.key]).map(a => (
                        <span key={a.key} className="text-xs bg-white border border-current border-opacity-20 px-2 py-0.5 rounded-full text-slate-600">
                          {a.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Modal>

      {/* ── Add / Edit Modal ── */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'تعديل مهندس' : 'إضافة مهندس'}>
        {error && <div className="mb-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="form-label">الاسم الكامل</label>
            <input className="form-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">البريد الإلكتروني</label>
            <input type="email" className="form-input" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">الدور الوظيفي</label>
              <select className="form-select" value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">الحالة</label>
              <select className="form-select" value={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.value }))}>
                <option value="true">🟢 نشط</option>
                <option value="false">⚪ غير نشط</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">مستوى الصلاحية</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PERMISSION_LEVELS).map(([level, p]) => (
                <button key={level} type="button"
                  onClick={() => setForm(f => ({ ...f, permission_level: level }))}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    form.permission_level === level ? `${p.color} shadow-sm` : 'border-slate-100 hover:border-slate-200'
                  }`}>
                  <div className="text-xl mb-1">{p.icon}</div>
                  <div className="text-xs font-bold text-slate-700">{p.labelAr}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة'}
          </button>
          <button onClick={() => setModal(false)} className="btn-secondary">إلغاء</button>
        </div>
      </Modal>
    </div>
  )
}
