import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketCategoriesApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
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

const emptyForm = { label: '', label_en: '', icon: '🏷️' }

function CategoryFields({ form, setForm, onSubmit, t }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[80px_1fr_1fr] gap-2">
      <div>
        <label className="form-label">{t('catType.icon')}</label>
        <input
          className="form-input !text-center !text-lg"
          value={form.icon}
          onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
          maxLength={4}
        />
      </div>
      <div>
        <label className="form-label">{t('catType.name')}</label>
        <input
          className="form-input"
          placeholder={t('catType.namePlh')}
          value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          dir="rtl"
        />
      </div>
      <div>
        <label className="form-label">{t('catType.nameEn')}</label>
        <input
          className="form-input"
          placeholder={t('catType.nameEnPlh')}
          value={form.label_en}
          onChange={e => setForm(f => ({ ...f, label_en: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          dir="ltr"
        />
      </div>
    </div>
  )
}

export default function TicketCategories() {
  const { t, language } = useLanguage()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)

  const load = () => {
    setLoading(true)
    ticketCategoriesApi.list().then(r => setItems(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.label.trim()) { setError(t('catType.errorRequired')); return }
    setSaving(true); setError('')
    try {
      await ticketCategoriesApi.create({ label: form.label.trim(), label_en: form.label_en.trim() || null, icon: form.icon.trim() || '🏷️' })
      setForm(emptyForm)
      load()
    } catch (e) { setError(e.response?.data?.detail || t('common.error')) }
    finally { setSaving(false) }
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditForm({ label: item.label, label_en: item.label_en || '', icon: item.icon || '🏷️' })
  }

  const handleSaveEdit = async () => {
    if (!editForm.label.trim()) return
    await ticketCategoriesApi.update(editingId, {
      label: editForm.label.trim(), label_en: editForm.label_en.trim() || null, icon: editForm.icon.trim() || '🏷️',
    })
    setEditingId(null)
    load()
  }

  const handleDelete = async (item) => {
    if (!confirm(t('catType.deleteConfirm').replace('{label}', item.label))) return
    await ticketCategoriesApi.delete(item.id)
    load()
  }

  return (
    <AdminGuard>
    <div className="space-y-4">
      <Header title={t('catType.title')} subtitle={t('catType.subtitle')} />

      <div className="card !p-4 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm">{t('catType.addNew')}</h3>
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[280px]">
            <CategoryFields form={form} setForm={setForm} onSubmit={handleAdd} t={t} />
          </div>
          <button onClick={handleAdd} disabled={saving} className="btn-primary disabled:opacity-40">
            {saving ? t('catType.adding') : t('common.add')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">{t('catType.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => (
            <div key={item.id} className="card !p-4 space-y-2">
              {editingId === item.id ? (
                <>
                  <CategoryFields form={editForm} setForm={setEditForm} onSubmit={handleSaveEdit} t={t} />
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} className="btn-primary !text-xs !px-2 !py-1 flex-1">{t('common.saveChanges')}</button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary !text-xs !px-2 !py-1">{t('common.cancel')}</button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-700 text-sm truncate block">
                        {language === 'en' ? (item.label_en || item.label) : item.label}
                      </span>
                      {!item.label_en && (
                        <span className="text-[10px] text-amber-500">{t('catType.noEnglish')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => startEdit(item)} className="btn-secondary !text-xs !px-2 !py-1">✏️</button>
                    <button onClick={() => handleDelete(item)} className="btn-danger !text-xs !px-2 !py-1">🗑️</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </AdminGuard>
  )
}
