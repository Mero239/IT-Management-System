import { useEffect, useState } from 'react'
import { departmentsApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

const emptyForm = { name: '', manager: '' }

export default function Departments() {
  const { t } = useLanguage()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    departmentsApi.list().then((r) => setItems(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (item) => { setEditing(item); setForm({ name: item.name, manager: item.manager || '' }); setError(''); setModal(true) }

  const handleSave = async () => {
    if (!form.name.trim()) { setError(t('departments.errorName')); return }
    setSaving(true); setError('')
    try {
      if (editing) await departmentsApi.update(editing.id, form)
      else await departmentsApi.create(form)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('departments.deleteConfirm'))) return
    try { await departmentsApi.delete(id); load() }
    catch (e) { alert(e.response?.data?.detail || 'Cannot delete') }
  }

  return (
    <div className="space-y-4">
      <Header title={t('departments.title')} subtitle={t('departments.subtitle')} />

      <div className="flex items-center justify-end">
        <button onClick={openAdd} className="btn-primary"><span>+</span> {t('departments.addBtn')}</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="card col-span-full text-center py-12 text-slate-400">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="card col-span-full text-center py-12 text-slate-400">
            <p className="text-4xl mb-3">🏢</p>
            <p>{t('departments.empty')}</p>
          </div>
        ) : items.map((item) => (
          <div key={item.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center text-2xl mb-3">🏢</div>
                <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
                {item.manager && (
                  <p className="text-sm text-slate-500 mt-1">{t('departments.manager')} {item.manager}</p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  {t('departments.addedOn')} {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => openEdit(item)} className="btn-success">{t('common.edit')}</button>
                <button onClick={() => handleDelete(item.id)} className="btn-danger">{t('common.delete')}</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? t('departments.modal.edit') : t('departments.modal.add')} size="sm">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="form-label">{t('departments.form.name')}</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('departments.form.namePlh')} />
          </div>
          <div>
            <label className="form-label">{t('departments.form.manager')}</label>
            <input className="form-input" value={form.manager} onChange={(e) => setForm((f) => ({ ...f, manager: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? t('common.saving') : editing ? t('departments.saveEdit') : t('departments.saveAdd')}
          </button>
          <button onClick={() => setModal(false)} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
