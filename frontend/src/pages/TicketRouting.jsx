import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketRoutingApi, engineersApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

const emptyForm = { keywords: '', engineer_name: '', engineer_email: '', active: 'true', priority_order: 0 }

function AdminGuard({ children }) {
  const { engineer } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (engineer && engineer.permission_level !== 'admin') navigate('/', { replace: true })
  }, [engineer])
  if (!engineer || engineer.permission_level !== 'admin') return null
  return children
}

export default function TicketRouting() {
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [engineers, setEngineers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    ticketRoutingApi.list().then((r) => setItems(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { engineersApi.list().then((r) => setEngineers(r.data)) }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setError(''); setModal(true) }

  const selectedNames = form.engineer_name ? form.engineer_name.split(',').map((n) => n.trim()).filter(Boolean) : []

  const toggleEngineer = (name) => {
    const next = selectedNames.includes(name)
      ? selectedNames.filter((n) => n !== name)
      : [...selectedNames, name]
    const emails = next
      .map((n) => engineers.find((e) => e.name === n)?.email)
      .filter(Boolean)
    setForm((f) => ({ ...f, engineer_name: next.join(', '), engineer_email: emails.join(', ') }))
  }

  const handleSave = async () => {
    if (!form.keywords.trim()) { setError(t('routing.errorKeywords')); return }
    if (!form.engineer_name.trim()) { setError(t('routing.errorEngineer')); return }
    setSaving(true); setError('')
    try {
      const data = { ...form, priority_order: Number(form.priority_order) || 0 }
      if (editing) await ticketRoutingApi.update(editing.id, data)
      else await ticketRoutingApi.create(data)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || 'Error') }
    finally { setSaving(false) }
  }

  const handleToggleActive = async (item) => {
    await ticketRoutingApi.update(item.id, { ...item, active: item.active === 'true' ? 'false' : 'true' })
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm(t('routing.deleteConfirm'))) return
    await ticketRoutingApi.delete(id); load()
  }

  return (
    <AdminGuard>
      <div className="space-y-4">
        <Header title={t('routing.title')} subtitle={t('routing.subtitle')} />

        <div className="flex items-center justify-end gap-2">
          <button onClick={openAdd} className="btn-primary"><span>+</span> {t('routing.addBtn')}</button>
        </div>

        <div className="card !p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['col.keywords', 'col.engineer', 'col.active', 'col.actions'].map((k) => (
                  <th key={k} className="table-th">{t(`routing.${k}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="table-td text-center py-12 text-slate-400">{t('common.loading')}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="table-td text-center py-12 text-slate-400">{t('routing.empty')}</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="table-td">
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {item.keywords.split(',').map((k) => k.trim()).filter(Boolean).map((k, i) => (
                        <span key={i} className="badge bg-yellow-100 text-yellow-700">{k}</span>
                      ))}
                    </div>
                  </td>
                  <td className="table-td font-medium text-slate-800">
                    👤 {item.engineer_name.split(',').map((n) => n.trim()).filter(Boolean).join(' / ')}
                    {item.engineer_email && <p className="text-xs text-slate-400 font-normal">{item.engineer_email}</p>}
                  </td>
                  <td className="table-td">
                    <button onClick={() => handleToggleActive(item)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${item.active === 'true' ? 'bg-yellow-500' : 'bg-slate-300'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${item.active === 'true' ? 'right-1' : 'left-1'}`} />
                    </button>
                  </td>
                  <td className="table-td">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(item)} className="btn-success">{t('common.edit')}</button>
                      <button onClick={() => handleDelete(item.id)} className="btn-danger">{t('common.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? t('routing.modal.edit') : t('routing.modal.add')} size="sm">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          <div className="space-y-4">
            <div>
              <label className="form-label">{t('routing.form.keywords')}</label>
              <textarea className="form-input" rows={2} value={form.keywords}
                onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                placeholder={t('routing.form.keywordsPlh')} />
              <p className="text-xs text-slate-400 mt-1">{t('routing.form.keywordsHint')}</p>
            </div>
            <div>
              <label className="form-label">{t('routing.form.engineer')}</label>
              <p className="text-xs text-slate-400 mb-2">{t('routing.form.engineerHint')}</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-2">
                {engineers.filter((e) => e.active === 'true').map((e) => (
                  <label key={e.id}
                    className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedNames.includes(e.name) ? 'bg-yellow-50' : 'hover:bg-slate-50'
                    }`}>
                    <input type="checkbox" checked={selectedNames.includes(e.name)} onChange={() => toggleEngineer(e.name)} />
                    <span className="text-sm text-slate-700">{e.name} <span className="text-slate-400">({e.role})</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">{t('routing.form.priorityOrder')}</label>
              <input type="number" className="form-input" value={form.priority_order}
                onChange={(e) => setForm((f) => ({ ...f, priority_order: e.target.value }))} />
              <p className="text-xs text-slate-400 mt-1">{t('routing.form.priorityOrderHint')}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? t('common.saving') : editing ? t('routing.saveEdit') : t('routing.saveAdd')}
            </button>
            <button onClick={() => setModal(false)} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </Modal>
      </div>
    </AdminGuard>
  )
}
