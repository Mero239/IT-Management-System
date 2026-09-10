import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketsApi, departmentsApi, engineersApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const STATUSES = ['open', 'in_progress', 'resolved', 'closed']

const STATUS_COLORS = {
  open: 'bg-red-100 text-red-600',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-slate-100 text-slate-500',
}
const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700 font-semibold',
}

const emptyForm = {
  title: '', description: '', requester_name: '', requester_email: '',
  department_id: '', priority: 'medium', status: 'open', assigned_to: '', resolution: '',
}

export default function Tickets() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [departments, setDepartments] = useState([])
  const [engineers, setEngineers] = useState([])
  const [filter, setFilter] = useState({ status: '', priority: '' })
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assignModal, setAssignModal] = useState(false)
  const [assignTicket, setAssignTicket] = useState(null)
  const [assignEngineer, setAssignEngineer] = useState('')
  const [assigning, setAssigning] = useState(false)

  const load = () => {
    setLoading(true)
    const params = {}
    if (filter.status) params.status = filter.status
    if (filter.priority) params.priority = filter.priority
    ticketsApi.list(params).then((r) => setItems(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])
  useEffect(() => { departmentsApi.list().then((r) => setDepartments(r.data)) }, [])
  useEffect(() => { engineersApi.list().then((r) => setEngineers(r.data)) }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (item) => {
    setEditing(item)
    setForm({ ...item, department_id: item.department_id || '' })
    setError(''); setModal(true)
  }
  const openDetail = (item) => { setSelected(item); setDetailModal(true) }

  const handleSave = async () => {
    if (!form.title.trim()) { setError(t('tickets.errorTitle')); return }
    setSaving(true); setError('')
    try {
      const data = { ...form, department_id: form.department_id || null }
      if (editing) await ticketsApi.update(editing.id, data)
      else await ticketsApi.create(data)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || 'Error') }
    finally { setSaving(false) }
  }

  const openAssign = (item) => {
    setAssignTicket(item)
    setAssignEngineer(item.assigned_to || '')
    setAssignModal(true)
  }
  const handleAssign = async () => {
    if (!assignEngineer) return
    setAssigning(true)
    try {
      await ticketsApi.assign(assignTicket.id, assignEngineer)
      setAssignModal(false)
      load()
    } finally { setAssigning(false) }
  }

  const handleStatus = async (id, status) => { await ticketsApi.updateStatus(id, status); load() }
  const handleDelete = async (id) => {
    if (!confirm(t('tickets.deleteConfirm'))) return
    await ticketsApi.delete(id); load()
  }

  return (
    <div className="space-y-4">
      <Header title={t('tickets.title')} subtitle={t('tickets.subtitle')} />

      <div className="flex items-center justify-end">
        <button onClick={openAdd} className="btn-primary"><span>+</span> {t('tickets.addBtn')}</button>
      </div>

      <div className="card !p-4 flex gap-3 flex-wrap">
        <select className="form-select w-auto" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
          <option value="">{t('tickets.allStatuses')}</option>
          {STATUSES.map((k) => <option key={k} value={k}>{t(`status.${k}`)}</option>)}
        </select>
        <select className="form-select w-auto" value={filter.priority} onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value }))}>
          <option value="">{t('tickets.allPriorities')}</option>
          {PRIORITIES.map((k) => <option key={k} value={k}>{t(`priority.${k}`)}</option>)}
        </select>
        <span className="text-sm text-slate-400 self-center">{items.length} {t('tickets.countSuffix')}</span>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['col.id','col.title','col.requester','col.priority','col.status','col.assignedTo','col.actions'].map((k) => (
                <th key={k} className="table-th">{t(`tickets.${k}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={7} className="table-td text-center py-12 text-slate-400">{t('common.loading')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="table-td text-center py-12 text-slate-400">{t('tickets.noTickets')}</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="table-td text-slate-400 text-xs">#{item.id}</td>
                <td className="table-td">
                  <button onClick={() => navigate(`/tickets/${item.id}`)} className="font-medium text-yellow-600 hover:underline text-start">
                    {item.title}
                  </button>
                  {item.department?.name && <p className="text-xs text-slate-400">{item.department.name}</p>}
                </td>
                <td className="table-td text-slate-500">{item.requester_name || '—'}</td>
                <td className="table-td">
                  <span className={`badge ${PRIORITY_COLORS[item.priority]}`}>{t(`priority.${item.priority}`)}</span>
                </td>
                <td className="table-td">
                  <span className={`badge ${STATUS_COLORS[item.status]}`}>{t(`status.${item.status}`)}</span>
                </td>
                <td className="table-td text-slate-500">{item.assigned_to || '—'}</td>
                <td className="table-td">
                  <div className="flex gap-1.5 flex-wrap">
                    {item.status === 'open' && (
                      <button onClick={() => handleStatus(item.id, 'in_progress')} className="btn-success">{t('tickets.startProgress')}</button>
                    )}
                    {item.status === 'in_progress' && (
                      <button onClick={() => handleStatus(item.id, 'resolved')} className="btn-success">{t('tickets.resolve')}</button>
                    )}
                    {item.status === 'resolved' && (
                      <button onClick={() => handleStatus(item.id, 'closed')} className="btn-secondary !text-xs !px-3 !py-1.5">{t('tickets.close')}</button>
                    )}
                    <button
                      onClick={() => openAssign(item)}
                      className="!text-xs !px-3 !py-1.5 inline-flex items-center gap-1 rounded-lg font-medium transition-colors bg-yellow-600 hover:bg-yellow-700 text-white"
                      title={t('tickets.assign.tooltip')}
                    >
                      👤 {t('tickets.assign.btn')}
                    </button>
                    <button onClick={() => openEdit(item)} className="btn-secondary !text-xs !px-3 !py-1.5">{t('common.edit')}</button>
                    <button onClick={() => handleDelete(item.id)} className="btn-danger">{t('common.delete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      <Modal isOpen={detailModal} onClose={() => setDetailModal(false)} title={`${t('tickets.detail.ticket')} #${selected?.id}`} size="md">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-bold text-slate-800">{selected.title}</p>
              <div className="flex gap-2 mt-2">
                <span className={`badge ${STATUS_COLORS[selected.status]}`}>{t(`status.${selected.status}`)}</span>
                <span className={`badge ${PRIORITY_COLORS[selected.priority]}`}>{t(`priority.${selected.priority}`)}</span>
              </div>
            </div>
            {selected.description && (
              <div>
                <p className="form-label">{t('tickets.detail.description')}</p>
                <p className="text-sm text-slate-600">{selected.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {selected.requester_name && <div><p className="text-slate-400 text-xs">{t('tickets.detail.requester')}</p><p className="font-medium">{selected.requester_name}</p></div>}
              {selected.requester_email && <div><p className="text-slate-400 text-xs">{t('tickets.detail.email')}</p><p className="font-medium">{selected.requester_email}</p></div>}
              {selected.department?.name && <div><p className="text-slate-400 text-xs">{t('tickets.detail.department')}</p><p className="font-medium">{selected.department.name}</p></div>}
              {selected.assigned_to && <div><p className="text-slate-400 text-xs">{t('tickets.detail.assignedTo')}</p><p className="font-medium">{selected.assigned_to}</p></div>}
              <div><p className="text-slate-400 text-xs">{t('tickets.detail.created')}</p><p className="font-medium">{new Date(selected.created_at).toLocaleDateString()}</p></div>
            </div>
            {selected.resolution && (
              <div className="bg-yellow-50 p-3 rounded-xl">
                <p className="text-xs font-medium text-yellow-700 mb-1">{t('tickets.detail.resolution')}</p>
                <p className="text-sm text-yellow-800">{selected.resolution}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Assign modal */}
      <Modal isOpen={assignModal} onClose={() => setAssignModal(false)} title={`${t('tickets.assign.modalTitle')} #${assignTicket?.id}`} size="sm">
        {assignTicket && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3 font-medium">{assignTicket.title}</p>
            <div>
              <label className="form-label">{t('tickets.assign.chooseEngineer')}</label>
              <div className="space-y-2 mt-2">
                {engineers.filter(e => e.active === 'true').map(eng => (
                  <button
                    key={eng.id}
                    onClick={() => setAssignEngineer(eng.name)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start ${
                      assignEngineer === eng.name
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-slate-100 hover:border-yellow-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-sm flex-shrink-0">
                      {eng.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm">{eng.name}</p>
                      <p className="text-xs text-slate-400">{eng.role}</p>
                    </div>
                    {assignEngineer === eng.name && (
                      <span className="text-yellow-500 text-lg flex-shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={handleAssign}
                disabled={!assignEngineer || assigning}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {assigning ? t('tickets.assign.assigning') : `✅ ${t('tickets.assign.confirm')}`}
              </button>
              <button onClick={() => setAssignModal(false)} className="btn-secondary">{t('common.cancel')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit / add modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? t('tickets.modal.edit') : t('tickets.modal.add')} size="lg">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="form-label">{t('tickets.form.title')}</label>
            <input className="form-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t('tickets.form.titlePlh')} />
          </div>
          <div>
            <label className="form-label">{t('tickets.form.requester')}</label>
            <input className="form-input" value={form.requester_name} onChange={(e) => setForm((f) => ({ ...f, requester_name: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('tickets.form.email')}</label>
            <input type="email" className="form-input" value={form.requester_email} onChange={(e) => setForm((f) => ({ ...f, requester_email: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('tickets.form.department')}</label>
            <select className="form-select" value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}>
              <option value="">{t('common.noDepartment')}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('tickets.form.priority')}</label>
            <select className="form-select" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              {PRIORITIES.map((k) => <option key={k} value={k}>{t(`priority.${k}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('tickets.form.status')}</label>
            <select className="form-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((k) => <option key={k} value={k}>{t(`status.${k}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('tickets.form.assignedTo')}</label>
            <select className="form-select" value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}>
              <option value="">— {t('tickets.form.unassigned')} —</option>
              {engineers.filter(e => e.active === 'true').map(e => (
                <option key={e.id} value={e.name}>{e.name} ({e.role})</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="form-label">{t('tickets.form.description')}</label>
            <textarea className="form-input" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="form-label">{t('tickets.form.resolution')}</label>
            <textarea className="form-input" rows={2} value={form.resolution} onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? t('common.saving') : editing ? t('tickets.saveEdit') : t('tickets.saveAdd')}
          </button>
          <button onClick={() => setModal(false)} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
