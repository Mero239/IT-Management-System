import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { engineersApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { DEFAULT_PASSWORD } from '../constants'

const ROLES = ['IT Engineer', 'Support Technician', 'Network Engineer', 'Systems Admin', 'IT Manager']

const PERM = {
  admin:    { label: 'مسؤول',  color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500', icon: '🛡️' },
  engineer: { label: 'مهندس',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500', icon: '⚙️' },
  viewer:   { label: 'مشاهد',  color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', icon: '👁️' },
}

const emptyForm = { name: '', email: '', role: 'IT Engineer', active: 'true', permission_level: 'engineer' }

// ── Admin guard ───────────────────────────────────────────────────────────────
function AdminGuard({ children }) {
  const { engineer } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (engineer && engineer.permission_level !== 'admin') navigate('/', { replace: true })
  }, [engineer])
  if (!engineer || engineer.permission_level !== 'admin') return null
  return children
}

// ── Engineer card ─────────────────────────────────────────────────────────────
function EngineerCard({ eng, onEdit, onPerm, onToggleActive, onResetPwd, onDelete, onViewTickets }) {
  const [stats, setStats] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const perm = PERM[eng.permission_level] || PERM.engineer
  const isActive = eng.active === 'true'

  useEffect(() => {
    engineersApi.stats(eng.id).then(r => setStats(r.data)).catch(() => {})
  }, [eng.id])

  const handleReset = async () => {
    if (!confirm(`إعادة تعيين كلمة مرور ${eng.name} إلى الافتراضية (${DEFAULT_PASSWORD})؟`)) return
    setResetting(true)
    try { await onResetPwd(eng.id) }
    finally { setResetting(false) }
  }

  const handleToggle = async () => {
    setToggling(true)
    try { await onToggleActive(eng.id, isActive ? 'false' : 'true') }
    finally { setToggling(false) }
  }

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${isActive ? 'border-slate-100 hover:border-yellow-200 hover:shadow-md' : 'border-dashed border-slate-200 opacity-60'}`}>
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${isActive ? 'bg-yellow-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {eng.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 truncate">{eng.name}</p>
              <p className="text-xs text-slate-400 truncate">{eng.email}</p>
            </div>
          </div>
          {/* Active toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isActive ? 'bg-yellow-500' : 'bg-slate-300'} ${toggling ? 'opacity-50' : ''}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isActive ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        {/* Role + permission */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="badge bg-slate-100 text-slate-600 text-xs">{eng.role}</span>
          <button
            onClick={() => onPerm(eng)}
            className={`badge border text-xs cursor-pointer hover:opacity-80 transition-opacity ${perm.color}`}
            title="انقر لتغيير الصلاحية"
          >
            {perm.icon} {perm.label}
          </button>
          {!isActive && <span className="badge bg-red-100 text-red-500 text-xs">معطّل</span>}
        </div>
      </div>

      {/* Ticket stats */}
      {stats && (
        <div className="mx-4 mb-3 grid grid-cols-4 gap-1.5 bg-slate-50 rounded-xl p-3">
          {[
            { label: 'مفتوحة', value: stats.open,        color: 'text-red-600' },
            { label: 'جارية',  value: stats.in_progress, color: 'text-amber-600' },
            { label: 'محلولة', value: stats.resolved,    color: 'text-yellow-600' },
            { label: 'الكل',   value: stats.total,       color: 'text-slate-700' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        <button onClick={() => onViewTickets(eng)} className="flex-1 btn-success !text-xs !py-1.5 justify-center">
          🎫 تذاكره
        </button>
        <button onClick={() => onEdit(eng)} className="flex-1 btn-secondary !text-xs !py-1.5 justify-center">
          ✏️ تعديل
        </button>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex-1 !text-xs !py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          title="إعادة تعيين كلمة المرور"
        >
          {resetting ? '...' : '🔑 كلمة المرور'}
        </button>
        <button onClick={() => onDelete(eng.id, eng.name)} className="btn-danger !text-xs !py-1.5">
          🗑️
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminEngineers() {
  const navigate = useNavigate()
  const { engineer: me } = useAuth()

  const [engineers, setEngineers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPerm, setFilterPerm] = useState('')
  const [filterActive, setFilterActive] = useState('')

  // modals
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [permModal, setPermModal] = useState(false)
  const [permTarget, setPermTarget] = useState(null)
  const [matrix, setMatrix] = useState(null)

  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      engineersApi.list(),
      engineersApi.permissionMatrix(),
    ]).then(([e, m]) => {
      setEngineers(e.data)
      setMatrix(m.data)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // ── filter ──
  const filtered = engineers.filter(e => {
    const q = search.toLowerCase()
    if (q && !e.name.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) return false
    if (filterPerm && e.permission_level !== filterPerm) return false
    if (filterActive === 'active' && e.active !== 'true') return false
    if (filterActive === 'inactive' && e.active !== 'false') return false
    return true
  })

  // ── actions ──
  const openAdd  = () => { setEditing(null); setForm({ ...emptyForm }); setFormError(''); setModal(true) }
  const openEdit = (e) => { setEditing(e); setForm({ ...e }); setFormError(''); setModal(true) }

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { setFormError('الاسم والبريد مطلوبان'); return }
    setSaving(true); setFormError('')
    try {
      if (editing) await engineersApi.update(editing.id, form)
      else await engineersApi.create(form)
      setModal(false)
      load()
      showToast(editing ? 'تم تحديث بيانات المهندس' : 'تمت إضافة المهندس بنجاح')
    } catch (err) {
      setFormError(err.response?.data?.detail || 'حدث خطأ')
    } finally { setSaving(false) }
  }

  const handlePerm = async (eng) => { setPermTarget(eng); setPermModal(true) }
  const handleSetPerm = async (id, level) => {
    await engineersApi.setPermission(id, level)
    setPermModal(false)
    load()
    showToast('تم تحديث الصلاحية')
  }

  const handleToggleActive = async (id, active) => {
    await engineersApi.setActive(id, active)
    load()
    showToast(active === 'true' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب', active === 'true' ? 'success' : 'warn')
  }

  const handleResetPwd = async (id) => {
    await engineersApi.resetPassword(id)
    showToast(`تمت إعادة تعيين كلمة المرور إلى ${DEFAULT_PASSWORD}`)
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`حذف ${name} نهائياً؟`)) return
    await engineersApi.delete(id)
    load()
    showToast(`تم حذف ${name}`, 'warn')
  }

  const handleViewTickets = (eng) => {
    // Navigate to engineer dashboard with that engineer pre-selected
    localStorage.setItem('selectedEngineer', JSON.stringify(eng))
    navigate('/engineer-dashboard')
  }

  const counts = {
    total:    engineers.length,
    active:   engineers.filter(e => e.active === 'true').length,
    admin:    engineers.filter(e => e.permission_level === 'admin').length,
    engineer: engineers.filter(e => e.permission_level === 'engineer').length,
    viewer:   engineers.filter(e => e.permission_level === 'viewer').length,
  }

  return (
    <AdminGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">إدارة المهندسين</h2>
            <p className="text-slate-500 text-sm mt-0.5">صفحة المسؤولين — إدارة الحسابات والصلاحيات</p>
          </div>
          <button onClick={openAdd} className="btn-primary">
            + إضافة مهندس
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'الإجمالي',  value: counts.total,    bg: 'bg-slate-50  border-slate-200',   text: 'text-slate-700' },
            { label: 'نشطون',     value: counts.active,   bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
            { label: 'مسؤولون',   value: counts.admin,    bg: 'bg-purple-50  border-purple-200',  text: 'text-purple-700' },
            { label: 'مهندسون',   value: counts.engineer, bg: 'bg-blue-50    border-blue-200',    text: 'text-blue-700' },
            { label: 'مشاهدون',   value: counts.viewer,   bg: 'bg-slate-50   border-slate-200',   text: 'text-slate-600' },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border-2 p-4 ${s.bg}`}>
              <p className={`text-3xl font-bold ${s.text}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <input
              className="form-input pl-9"
              placeholder="بحث بالاسم أو البريد..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
          <select className="form-select w-auto" value={filterPerm} onChange={e => setFilterPerm(e.target.value)}>
            <option value="">كل الصلاحيات</option>
            <option value="admin">🛡️ مسؤول</option>
            <option value="engineer">⚙️ مهندس</option>
            <option value="viewer">👁️ مشاهد</option>
          </select>
          <select className="form-select w-auto" value={filterActive} onChange={e => setFilterActive(e.target.value)}>
            <option value="">الكل</option>
            <option value="active">🟢 نشط</option>
            <option value="inactive">⚪ معطّل</option>
          </select>
          {(search || filterPerm || filterActive) && (
            <button onClick={() => { setSearch(''); setFilterPerm(''); setFilterActive('') }}
              className="btn-secondary !px-3 text-slate-500">✕ إلغاء</button>
          )}
        </div>

        {/* Engineer cards grid */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-slate-500">لا توجد نتائج مطابقة</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(eng => (
              <EngineerCard
                key={eng.id}
                eng={eng}
                onEdit={openEdit}
                onPerm={handlePerm}
                onToggleActive={handleToggleActive}
                onResetPwd={handleResetPwd}
                onDelete={handleDelete}
                onViewTickets={handleViewTickets}
              />
            ))}
          </div>
        )}

        {/* ── Add / Edit Modal ── */}
        <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? `تعديل: ${editing.name}` : 'إضافة مهندس جديد'} size="md">
          {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">⚠️ {formError}</div>}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="form-label">الاسم الكامل</label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="أحمد محمد" />
              </div>
              <div className="col-span-2">
                <label className="form-label">البريد الإلكتروني</label>
                <input type="email" className="form-input" dir="ltr" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="ahmed@mobica.net" />
              </div>
              <div>
                <label className="form-label">الدور الوظيفي</label>
                <select className="form-select" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">الحالة</label>
                <div className="flex gap-2 mt-1">
                  {[['true','🟢 نشط'],['false','⚪ معطّل']].map(([v,l]) => (
                    <button key={v} type="button"
                      onClick={() => setForm(f => ({ ...f, active: v }))}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${form.active === v ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="form-label">مستوى الصلاحية</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {Object.entries(PERM).map(([level, p]) => (
                  <button key={level} type="button"
                    onClick={() => setForm(f => ({ ...f, permission_level: level }))}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${form.permission_level === level ? `${p.color} shadow-sm` : 'border-slate-100 hover:border-slate-200'}`}>
                    <div className="text-xl mb-1">{p.icon}</div>
                    <div className="text-xs font-bold text-slate-700">{p.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {!editing && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                🔑 كلمة المرور الافتراضية عند الإنشاء: <strong>{DEFAULT_PASSWORD}</strong>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-50">
              {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة المهندس'}
            </button>
            <button onClick={() => setModal(false)} className="btn-secondary">إلغاء</button>
          </div>
        </Modal>

        {/* ── Permission Modal ── */}
        <Modal isOpen={permModal} onClose={() => setPermModal(false)} title={`صلاحية: ${permTarget?.name}`} size="sm">
          {permTarget && (
            <div className="space-y-2">
              {Object.entries(PERM).map(([level, p]) => {
                const isCurrent = permTarget.permission_level === level
                const actions = matrix ? Object.entries(matrix[level] || {}).filter(([,v]) => v).map(([k]) => k) : []
                const ACTION_LABELS = {
                  view_all_tickets: 'مشاهدة التذاكر', create_ticket: 'إنشاء تذكرة',
                  edit_own_ticket: 'تعديل تذاكره', edit_any_ticket: 'تعديل أي تذكرة',
                  assign_ticket: 'إسناد التذاكر', change_status: 'تغيير الحالة',
                  close_ticket: 'إغلاق التذكرة', delete_ticket: 'حذف التذكرة',
                }
                return (
                  <button key={level} onClick={() => handleSetPerm(permTarget.id, level)}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-start ${isCurrent ? `${p.color} shadow-sm` : 'border-slate-100 hover:border-slate-200 bg-white'}`}>
                    <span className="text-2xl flex-shrink-0">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{p.label}</span>
                        {isCurrent && <span className="badge bg-yellow-100 text-yellow-700 text-xs">الحالي ✓</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {actions.map(k => ACTION_LABELS[k] || k).join(' · ')}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Modal>

        {/* ── Toast ── */}
        {toast && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2 animate-fadeIn ${
            toast.type === 'warn' ? 'bg-amber-600 text-white' : 'bg-yellow-600 text-white'
          }`}>
            {toast.type === 'warn' ? '⚠️' : '✅'} {toast.msg}
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
