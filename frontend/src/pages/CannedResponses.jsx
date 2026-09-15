import { useEffect, useState } from 'react'
import { cannedResponsesApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'

// Reply templates are a shared team resource, not sensitive — any logged-in
// engineer can manage them (matches the backend, which only requires login).
const emptyForm = { title: '', body: '' }

export default function CannedResponses() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    cannedResponsesApi.list().then(r => setItems(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (item) => { setEditing(item); setForm({ title: item.title, body: item.body }); setError(''); setModal(true) }

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) { setError('العنوان والنص مطلوبان'); return }
    setSaving(true); setError('')
    try {
      if (editing) await cannedResponsesApi.update(editing.id, form)
      else await cannedResponsesApi.create(form)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || 'خطأ') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('حذف هذا الرد الجاهز؟')) return
    await cannedResponsesApi.delete(id); load()
  }

  return (
      <div className="space-y-4">
        <Header title="الردود الجاهزة" subtitle="قوالب رد سريعة يقدر المهندسون يدرجوها في تعليقات وحلول التذاكر" />

        <div className="flex justify-end">
          <button onClick={openAdd} className="btn-primary">+ إضافة رد جاهز</button>
        </div>

        {loading ? (
          <div className="card text-center py-12 text-slate-400">جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="card text-center py-12 text-slate-400">لا توجد ردود جاهزة بعد</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(item => (
              <div key={item.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-800">{item.title}</h3>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEdit(item)} className="btn-secondary !text-xs !px-2 !py-1">✏️</button>
                    <button onClick={() => handleDelete(item.id)} className="btn-danger !text-xs !px-2 !py-1">🗑️</button>
                  </div>
                </div>
                <p className="text-sm text-slate-500 whitespace-pre-line">{item.body}</p>
              </div>
            ))}
          </div>
        )}

        <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'تعديل رد جاهز' : 'إضافة رد جاهز'} size="md">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          <div className="space-y-4">
            <div>
              <label className="form-label">العنوان</label>
              <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="مثال: إعادة تشغيل الراوتر" />
            </div>
            <div>
              <label className="form-label">النص</label>
              <textarea className="form-input" rows={5} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة'}
            </button>
            <button onClick={() => setModal(false)} className="btn-secondary">إلغاء</button>
          </div>
        </Modal>
      </div>
  )
}
