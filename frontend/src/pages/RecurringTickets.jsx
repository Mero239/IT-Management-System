import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { recurringTicketsApi, departmentsApi, organizationsApi, branchesApi, engineersApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Header from '../components/Header'

function AdminGuard({ children }) {
  const { engineer } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (engineer && engineer.permission_level !== 'admin') navigate('/', { replace: true })
  }, [engineer])
  if (!engineer || engineer.permission_level !== 'admin') return null
  return children
}

const CATEGORIES = ['network', 'laptop_maintenance', 'internet', 'printing', 'other']
const CATEGORY_LABELS = {
  network: '🌐 مشكلة شبكة', laptop_maintenance: '💻 صيانة لاب توب',
  internet: '📶 انترنت بيقطع', printing: '🖨️ مشكلة طباعة', other: '❓ أخرى',
}
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const PRIORITY_LABELS = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' }
const FREQUENCIES = ['daily', 'weekly', 'monthly']
const FREQUENCY_LABELS = { daily: 'يوميًا', weekly: 'أسبوعيًا', monthly: 'شهريًا' }
const DAYS_OF_WEEK = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']

const emptyForm = {
  title: '', description: '', category: '', priority: 'medium',
  department_id: '', organization_id: '', branch_id: '', assigned_to: '',
  frequency: 'monthly', day_of_week: 0, day_of_month: 1, active: 'true',
}

export default function RecurringTickets() {
  const [items, setItems] = useState([])
  const [departments, setDepartments] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [branches, setBranches] = useState([])
  const [engineers, setEngineers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [runningId, setRunningId] = useState(null)

  const load = () => {
    setLoading(true)
    recurringTicketsApi.list().then(r => setItems(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    departmentsApi.list().then(r => setDepartments(r.data))
    organizationsApi.list().then(r => setOrganizations(r.data))
    branchesApi.list().then(r => setBranches(r.data))
    engineersApi.list().then(r => setEngineers(r.data))
  }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (item) => {
    setEditing(item)
    setForm({
      ...item,
      department_id: item.department_id || '', organization_id: item.organization_id || '',
      branch_id: item.branch_id || '', assigned_to: item.assigned_to || '',
      category: item.category || '', day_of_week: item.day_of_week ?? 0, day_of_month: item.day_of_month || 1,
    })
    setError(''); setModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('العنوان مطلوب'); return }
    setSaving(true); setError('')
    try {
      const data = {
        ...form,
        department_id: form.department_id || null,
        organization_id: form.organization_id || null,
        branch_id: form.branch_id || null,
        category: form.category || null,
        day_of_week: form.frequency === 'weekly' ? Number(form.day_of_week) : null,
        day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : null,
      }
      if (editing) await recurringTicketsApi.update(editing.id, data)
      else await recurringTicketsApi.create(data)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || 'خطأ') }
    finally { setSaving(false) }
  }

  const handleToggleActive = async (item) => {
    await recurringTicketsApi.update(item.id, { ...item, active: item.active === 'true' ? 'false' : 'true' })
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('حذف هذا القالب الدوري؟')) return
    await recurringTicketsApi.delete(id); load()
  }

  const handleRunNow = async (id) => {
    setRunningId(id)
    try {
      const r = await recurringTicketsApi.runNow(id)
      alert(`تم إنشاء تذكرة #${r.data.ticket_id}`)
      load()
    } catch (e) { alert(e.response?.data?.detail || 'خطأ') }
    finally { setRunningId(null) }
  }

  const scheduleLabel = (item) => {
    if (item.frequency === 'daily') return 'يوميًا'
    if (item.frequency === 'weekly') return `أسبوعيًا — كل ${DAYS_OF_WEEK[item.day_of_week ?? 0]}`
    return `شهريًا — يوم ${item.day_of_month || 1} من كل شهر`
  }

  return (
    <AdminGuard>
      <div className="space-y-4">
        <Header title="التذاكر الدورية المجدولة" subtitle="قوالب تذاكر تُنشأ تلقائيًا حسب جدول زمني — مناسبة للصيانة الوقائية" />

        <div className="flex justify-end">
          <button onClick={openAdd} className="btn-primary">+ إضافة قالب دوري</button>
        </div>

        {loading ? (
          <div className="card text-center py-12 text-slate-400">جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="card text-center py-12 text-slate-400">لا توجد قوالب دورية بعد</div>
        ) : (
          <div className="card !p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['العنوان', 'الجدول', 'النوع', 'المسؤول', 'آخر إنشاء', 'مفعّل', 'إجراءات'].map(h => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="table-td font-medium text-slate-800">{item.title}</td>
                    <td className="table-td text-slate-500 text-xs">{scheduleLabel(item)}</td>
                    <td className="table-td text-slate-500 text-xs">{item.category ? CATEGORY_LABELS[item.category] : '—'}</td>
                    <td className="table-td text-slate-500 text-xs">{item.assigned_to || '—'}</td>
                    <td className="table-td text-slate-500 text-xs">{item.last_created_at ? new Date(item.last_created_at).toLocaleDateString() : '—'}</td>
                    <td className="table-td">
                      <button onClick={() => handleToggleActive(item)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${item.active === 'true' ? 'bg-yellow-500' : 'bg-slate-300'}`}>
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${item.active === 'true' ? 'right-1' : 'left-1'}`} />
                      </button>
                    </td>
                    <td className="table-td">
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => handleRunNow(item.id)} disabled={runningId === item.id} className="btn-success !text-xs !px-2 !py-1">
                          {runningId === item.id ? '...' : '▶️ تشغيل الآن'}
                        </button>
                        <button onClick={() => openEdit(item)} className="btn-secondary !text-xs !px-2 !py-1">✏️</button>
                        <button onClick={() => handleDelete(item.id)} className="btn-danger !text-xs !px-2 !py-1">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'تعديل قالب دوري' : 'إضافة قالب دوري'} size="lg">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">عنوان التذكرة</label>
              <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: فحص الشبكة الشهري" />
            </div>
            <div className="col-span-2">
              <label className="form-label">الوصف</label>
              <textarea className="form-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">نوع المشكلة</label>
              <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">— بدون —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">الأولوية</label>
              <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">المهندس المسؤول</label>
              <select className="form-select" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">— تلقائي حسب قواعد التوجيه —</option>
                {engineers.filter(e => e.active === 'true').map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">القسم</label>
              <select className="form-select" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                <option value="">— بدون —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">المؤسسة</label>
              <select className="form-select" value={form.organization_id} onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}>
                <option value="">— بدون —</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">الفرع</label>
              <select className="form-select" value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}>
                <option value="">— بدون —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">التكرار</label>
              <select className="form-select" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
              </select>
            </div>
            {form.frequency === 'weekly' && (
              <div>
                <label className="form-label">يوم الأسبوع</label>
                <select className="form-select" value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))}>
                  {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            {form.frequency === 'monthly' && (
              <div>
                <label className="form-label">يوم الشهر (1-28)</label>
                <input type="number" min="1" max="28" className="form-input" value={form.day_of_month} onChange={e => setForm(f => ({ ...f, day_of_month: e.target.value }))} />
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة'}
            </button>
            <button onClick={() => setModal(false)} className="btn-secondary">إلغاء</button>
          </div>
        </Modal>
      </div>
    </AdminGuard>
  )
}
