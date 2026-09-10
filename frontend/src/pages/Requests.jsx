import { useEffect, useState } from 'react'
import { requestsApi, departmentsApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useCurrency, CURRENCIES, useFormatCurrency } from '../context/CurrencyContext'
import { useLanguage } from '../context/LanguageContext'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const STATUSES = ['pending', 'approved', 'rejected', 'fulfilled']
const TYPES = ['hardware', 'software', 'network', 'service', 'other']

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-600',
  fulfilled: 'bg-yellow-100 text-yellow-700',
}
const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-600',
}

const emptyForm = {
  title: '', description: '', requester_name: '', requester_email: '',
  department_id: '', asset_type: 'hardware', quantity: 1,
  estimated_cost: '', currency: 'USD', priority: 'medium', status: 'pending', notes: '',
}

export default function Requests() {
  const { t } = useLanguage()
  const { currency: globalCurrency } = useCurrency()
  const formatCurrency = useFormatCurrency()
  const [items, setItems] = useState([])
  const [departments, setDepartments] = useState([])
  const [filter, setFilter] = useState({ status: '', priority: '' })
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...emptyForm, currency: globalCurrency })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    const params = {}
    if (filter.status) params.status = filter.status
    if (filter.priority) params.priority = filter.priority
    requestsApi.list(params).then((r) => setItems(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])
  useEffect(() => { departmentsApi.list().then((r) => setDepartments(r.data)) }, [])

  const openAdd = () => {
    setEditing(null); setForm({ ...emptyForm, currency: globalCurrency }); setError(''); setModal(true)
  }
  const openEdit = (item) => {
    setEditing(item)
    setForm({ ...item, department_id: item.department_id || '', currency: item.currency || globalCurrency })
    setError(''); setModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError(t('requests.errorTitle')); return }
    setSaving(true); setError('')
    try {
      const data = { ...form, department_id: form.department_id || null, quantity: Number(form.quantity) || 1 }
      if (editing) await requestsApi.update(editing.id, data)
      else await requestsApi.create(data)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || 'Error') }
    finally { setSaving(false) }
  }

  const handleStatus = async (id, status) => { await requestsApi.updateStatus(id, status); load() }
  const handleDelete = async (id) => {
    if (!confirm(t('requests.deleteConfirm'))) return
    await requestsApi.delete(id); load()
  }

  return (
    <div className="space-y-4">
      <Header title={t('requests.title')} subtitle={t('requests.subtitle')} />

      <div className="flex items-center justify-end">
        <button onClick={openAdd} className="btn-primary"><span>+</span> {t('requests.addBtn')}</button>
      </div>

      <div className="card !p-4 flex gap-3 flex-wrap">
        <select className="form-select w-auto" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
          <option value="">{t('requests.allStatuses')}</option>
          {STATUSES.map((k) => <option key={k} value={k}>{t(`status.${k}`)}</option>)}
        </select>
        <select className="form-select w-auto" value={filter.priority} onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value }))}>
          <option value="">{t('requests.allPriorities')}</option>
          {PRIORITIES.map((k) => <option key={k} value={k}>{t(`priority.${k}`)}</option>)}
        </select>
        <span className="text-sm text-slate-400 self-center">{items.length} {t('requests.countSuffix')}</span>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="card text-center py-12 text-slate-400">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="card text-center py-12 text-slate-400">{t('requests.noRequests')}</div>
        ) : items.map((item) => (
          <div key={item.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold text-slate-800">{item.title}</span>
                  <span className={`badge ${STATUS_COLORS[item.status]}`}>{t(`status.${item.status}`)}</span>
                  <span className={`badge ${PRIORITY_COLORS[item.priority]}`}>{t(`priority.${item.priority}`)}</span>
                </div>
                <div className="text-sm text-slate-500 flex gap-4 flex-wrap mt-1">
                  {item.description && <span>{item.description}</span>}
                  {item.requester_name && <span>👤 {item.requester_name}</span>}
                  {item.department?.name && <span>🏢 {item.department.name}</span>}
                  {item.quantity > 1 && <span>🔢 {t('requests.qty')} {item.quantity}</span>}
                  {item.estimated_cost && (
                    <span>💰 {t('requests.estCost')} {formatCurrency(item.estimated_cost, item.currency || globalCurrency)}</span>
                  )}
                  <span>📅 {new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                {item.status === 'pending' && (
                  <>
                    <button onClick={() => handleStatus(item.id, 'approved')} className="btn-success">{t('requests.approve')}</button>
                    <button onClick={() => handleStatus(item.id, 'rejected')} className="btn-danger">{t('requests.reject')}</button>
                  </>
                )}
                {item.status === 'approved' && (
                  <button onClick={() => handleStatus(item.id, 'fulfilled')} className="btn-success">{t('requests.fulfill')}</button>
                )}
                <button onClick={() => openEdit(item)} className="btn-secondary !text-xs !px-3 !py-1.5">{t('common.edit')}</button>
                <button onClick={() => handleDelete(item.id)} className="btn-danger">{t('common.delete')}</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? t('requests.modal.edit') : t('requests.modal.add')} size="lg">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="form-label">{t('requests.form.title')}</label>
            <input className="form-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t('requests.form.titlePlh')} />
          </div>
          <div>
            <label className="form-label">{t('requests.form.requester')}</label>
            <input className="form-input" value={form.requester_name} onChange={(e) => setForm((f) => ({ ...f, requester_name: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('requests.form.email')}</label>
            <input type="email" className="form-input" value={form.requester_email} onChange={(e) => setForm((f) => ({ ...f, requester_email: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('requests.form.department')}</label>
            <select className="form-select" value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}>
              <option value="">{t('common.noDepartment')}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('requests.form.assetType')}</label>
            <select className="form-select" value={form.asset_type} onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value }))}>
              {TYPES.map((k) => <option key={k} value={k}>{t(`type.${k}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('requests.form.quantity')}</label>
            <input type="number" min="1" className="form-input" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('requests.form.priority')}</label>
            <select className="form-select" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
              {PRIORITIES.map((k) => <option key={k} value={k}>{t(`priority.${k}`)}</option>)}
            </select>
          </div>

          {/* Estimated cost with per-request currency selector */}
          <div className="col-span-2">
            <label className="form-label">{t('requests.form.estimatedCost')}</label>
            <div className="flex gap-2">
              <div className="flex rounded-xl border border-slate-200 overflow-hidden shrink-0">
                {Object.values(CURRENCIES).map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, currency: c.code }))}
                    className={`px-3 py-2.5 text-sm font-semibold transition-colors flex items-center gap-1 ${
                      form.currency === c.code
                        ? 'bg-yellow-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span>{c.symbol}</span>
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={form.estimated_cost}
                onChange={(e) => setForm((f) => ({ ...f, estimated_cost: e.target.value }))}
                placeholder={`${CURRENCIES[form.currency]?.name}`}
              />
            </div>
            {form.estimated_cost && (
              <p className="text-xs text-slate-400 mt-1">
                {t('requests.form.costPreview')} {formatCurrency(form.estimated_cost, form.currency)}
              </p>
            )}
          </div>

          <div>
            <label className="form-label">{t('requests.form.status')}</label>
            <select className="form-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((k) => <option key={k} value={k}>{t(`status.${k}`)}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="form-label">{t('requests.form.description')}</label>
            <textarea className="form-input" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="form-label">{t('requests.form.notes')}</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? t('common.saving') : editing ? t('requests.saveEdit') : t('requests.saveAdd')}
          </button>
          <button onClick={() => setModal(false)} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
