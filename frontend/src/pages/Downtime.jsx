import { useEffect, useState } from 'react'
import { downtimeApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'

const SERVICES = ['email', 'internet', 'sap', 'power', 'network', 'server', 'other']

const nowLocalInput = () => toLocalInput(new Date().toISOString())

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyForm = { service: 'internet', title: '', reason: '', start_time: nowLocalInput(), end_time: '' }

export default function Downtime() {
  const { t, language } = useLanguage()
  const { engineer } = useAuth()
  const isAdmin = engineer?.permission_level === 'admin'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ service: '', status: '' })
  const locale = language === 'ar' ? 'ar-EG' : 'en-US'

  const load = () => {
    setLoading(true)
    const params = {}
    if (filters.service) params.service = filters.service
    if (filters.status === 'ongoing') params.ongoing_only = true
    downtimeApi.list(params)
      .then(r => setItems(filters.status === 'resolved' ? r.data.filter(i => i.end_time) : r.data))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [filters])

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm, start_time: nowLocalInput() }); setError(''); setModal(true) }
  const openEdit = (item) => {
    setEditing(item)
    setForm({
      service: item.service, title: item.title, reason: item.reason || '',
      start_time: toLocalInput(item.start_time), end_time: toLocalInput(item.end_time),
    })
    setError(''); setModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError(t('downtime.errorTitle')); return }
    if (!form.start_time) { setError(t('downtime.errorStart')); return }
    if (form.end_time && new Date(form.end_time) < new Date(form.start_time)) { setError(t('downtime.errorEnd')); return }
    setSaving(true); setError('')
    try {
      const payload = {
        service: form.service,
        title: form.title.trim(),
        reason: form.reason.trim() || null,
        start_time: new Date(form.start_time).toISOString(),
        end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      }
      if (editing) await downtimeApi.update(editing.id, payload)
      else await downtimeApi.create(payload)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || t('common.error') || 'Error') }
    finally { setSaving(false) }
  }

  const handleEndNow = async (item) => {
    if (!confirm(t('downtime.endNowConfirm'))) return
    await downtimeApi.update(item.id, {
      service: item.service, title: item.title, reason: item.reason,
      start_time: item.start_time, end_time: new Date().toISOString(),
    })
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm(t('downtime.deleteConfirm'))) return
    await downtimeApi.delete(id); load()
  }

  const fmtDt = (iso) => iso ? new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

  const formatDuration = (start, end) => {
    const startMs = new Date(start).getTime()
    const endMs = end ? new Date(end).getTime() : Date.now()
    const mins = Math.max(0, Math.round((endMs - startMs) / 60000))
    const h = Math.floor(mins / 60), m = mins % 60
    return h > 0 ? t('downtime.duration.hm').replace('{h}', h).replace('{m}', m) : t('downtime.duration.m').replace('{m}', m)
  }

  return (
    <div className="space-y-4">
      <Header title={t('downtime.title')} subtitle={t('downtime.subtitle')} />

      <div className="card !p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="form-label">{t('downtime.filter.service')}</label>
          <select className="form-select !text-sm" value={filters.service} onChange={e => setFilters(f => ({ ...f, service: e.target.value }))}>
            <option value="">{t('downtime.filter.all')}</option>
            {SERVICES.map(s => <option key={s} value={s}>{t(`downtime.service.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">{t('downtime.filter.status')}</label>
          <select className="form-select !text-sm" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">{t('downtime.filter.all')}</option>
            <option value="ongoing">{t('downtime.status.ongoing')}</option>
            <option value="resolved">{t('downtime.status.resolved')}</option>
          </select>
        </div>
        <button onClick={openAdd} className="btn-primary ms-auto">{t('downtime.addBtn')}</button>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">{t('downtime.empty')}</div>
      ) : (
        <div className="card !p-0 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {[
                  t('downtime.col.service'), t('downtime.col.title'), t('downtime.col.reason'),
                  t('downtime.col.start'), t('downtime.col.end'), t('downtime.col.duration'),
                  t('downtime.col.status'), t('downtime.col.loggedBy'), t('downtime.col.actions'),
                ].map(h => <th key={h} className="table-th">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(item => {
                const ongoing = !item.end_time
                return (
                  <tr key={item.id} className={`hover:bg-slate-50/50 ${ongoing ? 'bg-red-50/50' : ''}`}>
                    <td className="table-td text-slate-600 text-xs whitespace-nowrap">{t(`downtime.service.${item.service}`)}</td>
                    <td className="table-td">
                      <button onClick={() => openEdit(item)} className="font-medium text-slate-800 hover:text-yellow-600 transition-colors text-start">
                        {item.title}
                      </button>
                    </td>
                    <td className="table-td text-slate-500 text-xs max-w-[220px] truncate" title={item.reason || ''}>{item.reason || '—'}</td>
                    <td className="table-td text-slate-500 text-xs whitespace-nowrap">{fmtDt(item.start_time)}</td>
                    <td className="table-td text-slate-500 text-xs whitespace-nowrap">{fmtDt(item.end_time)}</td>
                    <td className="table-td text-slate-500 text-xs whitespace-nowrap">{formatDuration(item.start_time, item.end_time)}</td>
                    <td className="table-td">
                      {ongoing ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1 w-fit">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                          </span>
                          {t('downtime.status.ongoing')}
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
                          ✅ {t('downtime.status.resolved')}
                        </span>
                      )}
                    </td>
                    <td className="table-td text-slate-500 text-xs">{item.logged_by || '—'}</td>
                    <td className="table-td">
                      <div className="flex gap-1.5">
                        {ongoing && (
                          <button onClick={() => handleEndNow(item)} className="btn-secondary !text-xs !px-2 !py-1">{t('downtime.endNow')}</button>
                        )}
                        <button onClick={() => openEdit(item)} className="btn-secondary !text-xs !px-2 !py-1">✏️</button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(item.id)} className="btn-danger !text-xs !px-2 !py-1">🗑️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? t('downtime.modal.edit') : t('downtime.modal.add')} size="md">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="form-label">{t('downtime.form.service')}</label>
            <select className="form-select" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}>
              {SERVICES.map(s => <option key={s} value={s}>{t(`downtime.service.${s}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('downtime.form.title')}</label>
            <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('downtime.form.titlePlh')} />
          </div>
          <div>
            <label className="form-label">{t('downtime.form.reason')}</label>
            <textarea className="form-input" rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={t('downtime.form.reasonPlh')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{t('downtime.form.start')}</label>
              <input type="datetime-local" className="form-input" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">{t('downtime.form.end')}</label>
              <input type="datetime-local" className="form-input" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
              <p className="text-xs text-slate-400 mt-1">{t('downtime.form.endHint')}</p>
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
