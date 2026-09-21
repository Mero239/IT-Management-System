import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketCategoriesApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
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

const emptyForm = { label: '', icon: '🏷️' }

export default function TicketCategories() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    ticketCategoriesApi.list().then(r => setItems(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.label.trim()) { setError('اسم نوع المشكلة مطلوب'); return }
    setSaving(true); setError('')
    try {
      await ticketCategoriesApi.create({ label: form.label.trim(), icon: form.icon.trim() || '🏷️' })
      setForm(emptyForm)
      load()
    } catch (e) { setError(e.response?.data?.detail || 'خطأ') }
    finally { setSaving(false) }
  }

  const handleDelete = async (item) => {
    if (!confirm(`حذف "${item.label}"؟ التذاكر القديمة اللي مستخدمة النوع ده هتفضل زي ما هي.`)) return
    await ticketCategoriesApi.delete(item.id)
    load()
  }

  return (
    <AdminGuard>
    <div className="space-y-4">
      <Header title="أنواع المشاكل" subtitle="الفئات اللي بتظهر لصاحب البلاغ لما يختار نوع المشكلة في تذكرة جديدة" />

      <div className="card !p-4 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm">➕ إضافة نوع جديد</h3>
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <div className="flex gap-2 flex-wrap items-end">
          <div className="w-20">
            <label className="form-label">الأيقونة</label>
            <input
              className="form-input !text-center !text-lg"
              value={form.icon}
              onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              maxLength={4}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="form-label">الاسم</label>
            <input
              className="form-input"
              placeholder="مثال: مشكلة في طابعة الشبكة"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <button onClick={handleAdd} disabled={saving} className="btn-primary disabled:opacity-40">
            {saving ? 'جاري الإضافة...' : 'إضافة'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-slate-400">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">لا توجد أنواع مضافة بعد</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(item => (
            <div key={item.id} className="card !p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0">{item.icon}</span>
                <span className="font-semibold text-slate-700 text-sm truncate">{item.label}</span>
              </div>
              <button onClick={() => handleDelete(item)} className="btn-danger !text-xs !px-2 !py-1 shrink-0">🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
    </AdminGuard>
  )
}
