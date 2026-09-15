import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { ticketReportsApi, departmentsApi, organizationsApi, branchesApi, engineersApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const CATEGORIES = ['network', 'laptop_maintenance', 'internet', 'printing', 'other']
const SOURCES = ['manual', 'email', 'telegram', 'whatsapp']

const emptyFilters = {
  date_from: '', date_to: '', status: '', priority: '', category: '',
  organization_id: '', branch_id: '', department_id: '', assigned_to: '', source: '',
}

function BreakdownCard({ title, data, total, labelFor }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1])
  return (
    <div className="card !p-4 space-y-2.5">
      <h3 className="font-bold text-slate-700 text-sm">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">لا توجد بيانات</p>
      ) : entries.map(([key, count]) => (
        <div key={key} className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 w-28 shrink-0 truncate">{labelFor ? labelFor(key) : key}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
          </div>
          <span className="text-slate-700 font-bold w-8 text-left shrink-0">{count}</span>
        </div>
      ))}
    </div>
  )
}

export default function TicketReports() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ ...emptyFilters })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [branches, setBranches] = useState([])
  const [engineers, setEngineers] = useState([])
  const [presets, setPresets] = useState([])
  const [saveModal, setSaveModal] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [saving, setSaving] = useState(false)

  const loadPresets = () => ticketReportsApi.listPresets().then(r => setPresets(r.data)).catch(() => {})

  useEffect(() => {
    departmentsApi.list().then(r => setDepartments(r.data))
    organizationsApi.list().then(r => setOrganizations(r.data))
    branchesApi.list().then(r => setBranches(r.data))
    engineersApi.list().then(r => setEngineers(r.data))
    loadPresets()
  }, [])

  const runReport = () => {
    setLoading(true)
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ticketReportsApi.data(params).then(r => setData(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { runReport() }, []) // eslint-disable-line

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }))
  const clearFilters = () => { setFilters({ ...emptyFilters }); setTimeout(runReport, 0) }

  const applyPreset = (preset) => {
    setFilters({ ...emptyFilters, ...preset.filters })
    setTimeout(runReport, 0)
  }

  const handleSavePreset = async () => {
    if (!presetName.trim()) return
    setSaving(true)
    try {
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      await ticketReportsApi.savePreset(presetName.trim(), activeFilters)
      setSaveModal(false); setPresetName('')
      loadPresets()
    } finally { setSaving(false) }
  }

  const handleDeletePreset = async (id) => {
    if (!confirm('حذف هذا التقرير المحفوظ؟')) return
    await ticketReportsApi.deletePreset(id)
    loadPresets()
  }

  const exportExcel = () => {
    if (!data?.tickets?.length) return
    const rows = data.tickets.map((t, i) => ({
      '#': i + 1,
      'العنوان': t.title,
      'الحالة': t.status,
      'الأولوية': t.priority,
      'نوع المشكلة': t.category || '',
      'المؤسسة': t.organization?.name || '',
      'الفرع': t.branch?.name || '',
      'القسم': t.department?.name || '',
      'المسؤول': t.assigned_to || '',
      'المصدر': t.source || '',
      'تاريخ الإنشاء': t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
      'موعد الاستحقاق': t.sla_due_at ? new Date(t.sla_due_at).toLocaleDateString() : '',
      'حالة SLA': t.sla_status || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ticket Report')
    XLSX.writeFile(wb, `ticket_report_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const priorityLabel = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' }
  const statusLabel = { open: 'مفتوحة', in_progress: 'قيد التنفيذ', resolved: 'محلولة', closed: 'مغلقة' }
  const categoryLabel = {
    network: '🌐 شبكة', laptop_maintenance: '💻 صيانة لاب', internet: '📶 انترنت',
    printing: '🖨️ طباعة', other: '❓ أخرى', uncategorized: '— بدون —',
  }
  const slaLabel = { on_time: '🟢 في الموعد', at_risk: '🟠 معرّضة', breached: '🔴 متجاوزة', met: '✅ أُنجزت' }
  const sourceLabel = { manual: 'يدوي', email: 'إيميل', telegram: 'تيليجرام', whatsapp: 'واتساب' }

  return (
    <div className="space-y-4">
      <Header title="تقارير التذاكر" subtitle="فلترة، تحليل، وحفظ تقارير مخصصة لنظام التذاكر" />

      {/* Saved presets */}
      {presets.length > 0 && (
        <div className="card !p-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500 shrink-0">التقارير المحفوظة:</span>
          {presets.map(p => (
            <div key={p.id} className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-full pr-1 pl-3 py-1">
              <button onClick={() => applyPreset(p)} className="text-xs font-medium text-yellow-700">{p.name}</button>
              <button onClick={() => handleDeletePreset(p.id)} className="text-yellow-500 hover:text-red-500 text-xs w-5 h-5 rounded-full flex items-center justify-center">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="form-label">من تاريخ</label>
            <input type="date" className="form-input" value={filters.date_from} onChange={e => set('date_from', e.target.value)} />
          </div>
          <div>
            <label className="form-label">إلى تاريخ</label>
            <input type="date" className="form-input" value={filters.date_to} onChange={e => set('date_to', e.target.value)} />
          </div>
          <div>
            <label className="form-label">الحالة</label>
            <select className="form-select" value={filters.status} onChange={e => set('status', e.target.value)}>
              <option value="">الكل</option>
              {STATUSES.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">الأولوية</label>
            <select className="form-select" value={filters.priority} onChange={e => set('priority', e.target.value)}>
              <option value="">الكل</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{priorityLabel[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">نوع المشكلة</label>
            <select className="form-select" value={filters.category} onChange={e => set('category', e.target.value)}>
              <option value="">الكل</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel[c]}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">المؤسسة</label>
            <select className="form-select" value={filters.organization_id} onChange={e => set('organization_id', e.target.value)}>
              <option value="">الكل</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">الفرع</label>
            <select className="form-select" value={filters.branch_id} onChange={e => set('branch_id', e.target.value)}>
              <option value="">الكل</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">القسم</label>
            <select className="form-select" value={filters.department_id} onChange={e => set('department_id', e.target.value)}>
              <option value="">الكل</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">المهندس المسؤول</label>
            <select className="form-select" value={filters.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
              <option value="">الكل</option>
              {engineers.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">المصدر</label>
            <select className="form-select" value={filters.source} onChange={e => set('source', e.target.value)}>
              <option value="">الكل</option>
              {SOURCES.map(s => <option key={s} value={s}>{sourceLabel[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={runReport} className="btn-primary">🔍 تطبيق الفلاتر</button>
          <button onClick={clearFilters} className="btn-secondary">✕ مسح الفلاتر</button>
          <button onClick={() => setSaveModal(true)} className="btn-secondary">💾 حفظ كتقرير مخصص</button>
          <button onClick={exportExcel} disabled={!data?.tickets?.length} className="btn-secondary disabled:opacity-40">📥 تصدير Excel</button>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-slate-400">جاري التحميل...</div>
      ) : data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card !p-4"><p className="text-3xl font-bold text-slate-800">{data.total}</p><p className="text-xs text-slate-500 mt-1">إجمالي التذاكر</p></div>
            <div className="card !p-4"><p className="text-3xl font-bold text-red-600">{data.by_sla_status?.breached || 0}</p><p className="text-xs text-slate-500 mt-1">متجاوزة SLA</p></div>
            <div className="card !p-4"><p className="text-3xl font-bold text-yellow-600">{(data.by_status?.open || 0) + (data.by_status?.in_progress || 0)}</p><p className="text-xs text-slate-500 mt-1">مفتوحة/قيد التنفيذ</p></div>
            <div className="card !p-4"><p className="text-3xl font-bold text-slate-800">{data.avg_resolution_hours ?? '—'}</p><p className="text-xs text-slate-500 mt-1">متوسط ساعات الحل</p></div>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <BreakdownCard title="حسب الحالة" data={data.by_status} total={data.total} labelFor={k => statusLabel[k] || k} />
            <BreakdownCard title="حسب الأولوية" data={data.by_priority} total={data.total} labelFor={k => priorityLabel[k] || k} />
            <BreakdownCard title="حسب نوع المشكلة" data={data.by_category} total={data.total} labelFor={k => categoryLabel[k] || k} />
            <BreakdownCard title="حسب الفرع" data={data.by_branch} total={data.total} />
            <BreakdownCard title="حسب المؤسسة" data={data.by_organization} total={data.total} />
            <BreakdownCard title="حسب المهندس" data={data.by_engineer} total={data.total} />
            <BreakdownCard title="حسب المصدر" data={data.by_source} total={data.total} labelFor={k => sourceLabel[k] || k} />
            <BreakdownCard title="حالة SLA" data={data.by_sla_status} total={data.total} labelFor={k => slaLabel[k] || k} />
          </div>

          {/* Ticket list */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-700 text-sm">التذاكر ({data.tickets.length})</h3>
            </div>
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <tr>
                    {['#', 'العنوان', 'الحالة', 'الأولوية', 'النوع', 'المسؤول', 'تاريخ الإنشاء'].map(h => (
                      <th key={h} className="table-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.tickets.length === 0 ? (
                    <tr><td colSpan={7} className="table-td text-center py-10 text-slate-400">لا توجد تذاكر مطابقة للفلاتر</td></tr>
                  ) : data.tickets.map(tk => (
                    <tr key={tk.id} className="hover:bg-slate-50/50">
                      <td className="table-td text-slate-400 text-xs">#{tk.id}</td>
                      <td className="table-td">
                        <button onClick={() => navigate(`/tickets/${tk.id}`)} className="text-yellow-600 hover:underline text-start">{tk.title}</button>
                      </td>
                      <td className="table-td text-slate-500 text-xs">{statusLabel[tk.status] || tk.status}</td>
                      <td className="table-td text-slate-500 text-xs">{priorityLabel[tk.priority] || tk.priority}</td>
                      <td className="table-td text-slate-500 text-xs">{tk.category ? categoryLabel[tk.category] : '—'}</td>
                      <td className="table-td text-slate-500 text-xs">{tk.assigned_to || '—'}</td>
                      <td className="table-td text-slate-500 text-xs">{tk.created_at ? new Date(tk.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={saveModal} onClose={() => setSaveModal(false)} title="حفظ تقرير مخصص" size="sm">
        <div className="space-y-4">
          <div>
            <label className="form-label">اسم التقرير</label>
            <input className="form-input" value={presetName} onChange={e => setPresetName(e.target.value)}
              placeholder="مثال: تذاكر الشبكة عالية الأولوية" autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSavePreset()} />
          </div>
          <p className="text-xs text-slate-400">هيتم حفظ الفلاتر المطبّقة حاليًا، وتقدر تشغّل نفس التقرير تاني في أي وقت من قائمة "التقارير المحفوظة".</p>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
          <button onClick={handleSavePreset} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button onClick={() => setSaveModal(false)} className="btn-secondary">إلغاء</button>
        </div>
      </Modal>
    </div>
  )
}
