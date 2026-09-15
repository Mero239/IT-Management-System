import { useEffect, useState } from 'react'
import { organizationsApi, branchesApi } from '../api/client'
import Header from '../components/Header'

function OrgSection({ organizations, branches, onChanged }) {
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState('')

  const add = async () => {
    if (!name.trim()) return
    setError('')
    try { await organizationsApi.create(name.trim()); setName(''); onChanged() }
    catch (e) { setError(e.response?.data?.detail || 'خطأ') }
  }

  const saveEdit = async (id) => {
    if (!editingName.trim()) return
    await organizationsApi.update(id, editingName.trim())
    setEditingId(null); onChanged()
  }

  const remove = async (id) => {
    const inUse = branches.some(b => b.organization_id === id)
    if (inUse && !confirm('فيه فروع مرتبطة بالمؤسسة دي — هيفضل مرتبطين بدون مؤسسة. تكمل الحذف؟')) return
    await organizationsApi.delete(id); onChanged()
  }

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">🏢 المؤسسات</h3>
      </div>
      <div className="p-4 flex gap-2">
        <input className="form-input flex-1" placeholder="اسم مؤسسة جديدة" value={name}
          onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button onClick={add} className="btn-primary">+ إضافة</button>
      </div>
      {error && <div className="mx-4 mb-3 p-2 bg-red-50 text-red-600 rounded-lg text-xs">{error}</div>}
      <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
        {organizations.length === 0 ? (
          <p className="text-center text-slate-400 py-8 text-sm">لا توجد مؤسسات بعد</p>
        ) : organizations.map(o => (
          <div key={o.id} className="flex items-center gap-2 px-4 py-2.5">
            {editingId === o.id ? (
              <>
                <input className="form-input flex-1 !py-1.5 !text-sm" value={editingName}
                  onChange={e => setEditingName(e.target.value)} autoFocus
                  onKeyDown={e => e.key === 'Enter' && saveEdit(o.id)} />
                <button onClick={() => saveEdit(o.id)} className="btn-success !text-xs">حفظ</button>
                <button onClick={() => setEditingId(null)} className="btn-secondary !text-xs">إلغاء</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-700">{o.name}</span>
                <span className="text-xs text-slate-400">{branches.filter(b => b.organization_id === o.id).length} فرع</span>
                <button onClick={() => { setEditingId(o.id); setEditingName(o.name) }} className="btn-secondary !text-xs !px-2 !py-1">✏️</button>
                <button onClick={() => remove(o.id)} className="btn-danger !text-xs !px-2 !py-1">🗑️</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function BranchSection({ organizations, branches, onChanged }) {
  const [name, setName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingOrgId, setEditingOrgId] = useState('')
  const [error, setError] = useState('')

  const add = async () => {
    if (!name.trim()) return
    setError('')
    try { await branchesApi.create(name.trim(), orgId || null); setName(''); onChanged() }
    catch (e) { setError(e.response?.data?.detail || 'خطأ') }
  }

  const saveEdit = async (id) => {
    if (!editingName.trim()) return
    await branchesApi.update(id, editingName.trim(), editingOrgId || null)
    setEditingId(null); onChanged()
  }

  const remove = async (id) => {
    if (!confirm('حذف هذا الفرع؟')) return
    await branchesApi.delete(id); onChanged()
  }

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">📍 الفروع</h3>
      </div>
      <div className="p-4 space-y-2">
        <input className="form-input w-full" placeholder="اسم فرع جديد" value={name}
          onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <div className="flex gap-2">
          <select className="form-select flex-1" value={orgId} onChange={e => setOrgId(e.target.value)}>
            <option value="">— بدون مؤسسة —</option>
            {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={add} className="btn-primary shrink-0">+ إضافة</button>
        </div>
      </div>
      {error && <div className="mx-4 mb-3 p-2 bg-red-50 text-red-600 rounded-lg text-xs">{error}</div>}
      <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
        {branches.length === 0 ? (
          <p className="text-center text-slate-400 py-8 text-sm">لا توجد فروع بعد</p>
        ) : branches.map(b => (
          <div key={b.id} className="flex items-center gap-2 px-4 py-2.5">
            {editingId === b.id ? (
              <>
                <input className="form-input flex-1 !py-1.5 !text-sm" value={editingName}
                  onChange={e => setEditingName(e.target.value)} autoFocus />
                <select className="form-select !py-1.5 !text-xs w-32" value={editingOrgId} onChange={e => setEditingOrgId(e.target.value)}>
                  <option value="">— بدون —</option>
                  {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button onClick={() => saveEdit(b.id)} className="btn-success !text-xs">حفظ</button>
                <button onClick={() => setEditingId(null)} className="btn-secondary !text-xs">إلغاء</button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{b.name}</p>
                  {b.organization?.name && <p className="text-xs text-slate-400 truncate">{b.organization.name}</p>}
                </div>
                <button onClick={() => { setEditingId(b.id); setEditingName(b.name); setEditingOrgId(b.organization_id || '') }} className="btn-secondary !text-xs !px-2 !py-1">✏️</button>
                <button onClick={() => remove(b.id)} className="btn-danger !text-xs !px-2 !py-1">🗑️</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OrganizationsBranches() {
  const [organizations, setOrganizations] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([organizationsApi.list(), branchesApi.list()])
      .then(([o, b]) => { setOrganizations(o.data); setBranches(b.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <Header title="المؤسسات والفروع" subtitle="بيانات أساسية تظهر عند فتح تذكرة جديدة" />
      {loading ? (
        <div className="card text-center py-12 text-slate-400">جاري التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OrgSection organizations={organizations} branches={branches} onChanged={load} />
          <BranchSection organizations={organizations} branches={branches} onChanged={load} />
        </div>
      )}
    </div>
  )
}
