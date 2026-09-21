import { useEffect, useState } from 'react'
import { tasksApi, engineersApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'one_time']

const todayStr = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
  title: '', description: '', task_type: '', frequency: 'one_time',
  task_date: todayStr(), assigned_to: '', status: 'pending',
}

export default function Tasks() {
  const { t, language } = useLanguage()
  const [items, setItems] = useState([])
  const [engineers, setEngineers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ assigned_to: '', frequency: '', status: '' })

  const load = () => {
    setLoading(true)
    const params = {}
    if (filters.assigned_to) params.assigned_to = filters.assigned_to
    if (filters.frequency) params.frequency = filters.frequency
    if (filters.status) params.status = filters.status
    tasksApi.list(params).then(r => setItems(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [filters])
  useEffect(() => { engineersApi.list().then(r => setEngineers(r.data)) }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (item) => {
    setEditing(item)
    setForm({ ...item, task_date: item.task_date?.slice(0, 10) || todayStr(), task_type: item.task_type || '', assigned_to: item.assigned_to || '' })
    setError(''); setModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError(t('tasks.errorTitle')); return }
    if (!form.task_date) { setError(t('tasks.errorDate')); return }
    setSaving(true); setError('')
    try {
      if (editing) await tasksApi.update(editing.id, form)
      else await tasksApi.create(form)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || t('common.error') || 'Error') }
    finally { setSaving(false) }
  }

  const handleToggleStatus = async (item) => {
    await tasksApi.update(item.id, { ...item, status: item.status === 'done' ? 'pending' : 'done' })
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm(t('tasks.deleteConfirm'))) return
    await tasksApi.delete(id); load()
  }

  const typeSuggestions = t('tasks.typeSuggestions')

  return (
    <div className="space-y-4">
      <Header title={t('tasks.title')} subtitle={t('tasks.subtitle')} />

      <div className="card !p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="form-label">{t('tasks.filter.engineer')}</label>
          <select className="form-select !text-sm" value={filters.assigned_to} onChange={e => setFilters(f => ({ ...f, assigned_to: e.target.value }))}>
            <option value="">{t('tasks.filter.all')}</option>
            {engineers.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">{t('tasks.filter.frequency')}</label>
          <select className="form-select !text-sm" value={filters.frequency} onChange={e => setFilters(f => ({ ...f, frequency: e.target.value }))}>
            <option value="">{t('tasks.filter.all')}</option>
            {FREQUENCIES.map(f => <option key={f} value={f}>{t(`tasks.frequency.${f}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">{t('common.status')}</label>
          <select className="form-select !text-sm" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">{t('tasks.filter.all')}</option>
            <option value="pending">{t('tasks.status.pending')}</option>
            <option value="done">{t('tasks.status.done')}</option>
          </select>
        </div>
        <button onClick={openAdd} className="btn-primary ms-auto">{t('tasks.addBtn')}</button>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">{t('tasks.empty')}</div>
      ) : (
        <div className="card !p-0 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[
                  t('tasks.col.task'), t('tasks.col.type'), t('tasks.col.frequency'), t('tasks.col.date'),
                  t('tasks.col.engineer'), t('common.status'), t('common.actions'),
                ].map(h => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="table-td font-medium text-slate-800">{item.title}</td>
                  <td className="table-td text-slate-500 text-xs">{item.task_type || '—'}</td>
                  <td className="table-td text-slate-500 text-xs">{t(`tasks.frequency.${item.frequency}`) || item.frequency}</td>
                  <td className="table-td text-slate-500 text-xs">{new Date(item.task_date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</td>
                  <td className="table-td text-slate-500 text-xs">{item.assigned_to || '—'}</td>
                  <td className="table-td">
                    <button
                      onClick={() => handleToggleStatus(item)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.status === 'done' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {item.status === 'done' ? `✅ ${t('tasks.status.done')}` : `⏳ ${t('tasks.status.pending')}`}
                    </button>
                  </td>
                  <td className="table-td">
                    <div className="flex gap-1.5">
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

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? t('tasks.modal.edit') : t('tasks.modal.add')} size="md">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="form-label">{t('tasks.form.title')}</label>
            <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('tasks.form.titlePlh')} />
          </div>
          <div>
            <label className="form-label">{t('tasks.form.description')}</label>
            <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{t('tasks.form.type')}</label>
              <input
                className="form-input"
                list="task-type-suggestions"
                value={form.task_type}
                onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))}
                placeholder={t('tasks.form.typePlh')}
              />
              <datalist id="task-type-suggestions">
                {typeSuggestions.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <label className="form-label">{t('tasks.form.frequency')}</label>
              <select className="form-select" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{t(`tasks.frequency.${f}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">{t('tasks.form.date')}</label>
              <input type="date" className="form-input" value={form.task_date} onChange={e => setForm(f => ({ ...f, task_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">{t('tasks.form.engineer')}</label>
              <select className="form-select" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">{t('tasks.form.none')}</option>
                {engineers.filter(e => e.active === 'true').map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="form-label">{t('tasks.form.status')}</label>
              <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="pending">{t('tasks.status.pending')}</option>
                <option value="done">{t('tasks.status.done')}</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? t('common.saving') : editing ? t('common.saveChanges') : t('common.add')}
          </button>
          <button onClick={() => setModal(false)} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
