import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { licensedSoftwareApi, departmentsApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

const emptyForm = { software_name: '', department_id: '', user_name: '', quantity: 1, license_renewal_date: '', notes: '' }

export default function LicensedSoftware() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [departments, setDepartments] = useState([])
  const [searchQ, setSearchQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    licensedSoftwareApi.list().then((r) => setItems(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { departmentsApi.list().then((r) => setDepartments(r.data)) }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (item) => {
    setEditing(item)
    setForm({
      software_name: item.software_name,
      department_id: item.department_id || '',
      user_name: item.user_name || '',
      quantity: item.quantity || 1,
      license_renewal_date: item.license_renewal_date || '',
      notes: item.notes || '',
    })
    setError(''); setModal(true)
  }

  const handleSave = async () => {
    if (!form.software_name.trim()) { setError(t('licensedSoftware.errorName')); return }
    setSaving(true); setError('')
    try {
      const data = { ...form, department_id: form.department_id || null, quantity: Number(form.quantity) || 1 }
      if (editing) await licensedSoftwareApi.update(editing.id, data)
      else await licensedSoftwareApi.create(data)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('licensedSoftware.deleteConfirm'))) return
    try { await licensedSoftwareApi.delete(id); load() }
    catch (e) { alert(e.response?.data?.detail || 'Cannot delete') }
  }

  const q = searchQ.trim().toLowerCase()
  const displayed = items.filter((i) =>
    !q ||
    (i.software_name && i.software_name.toLowerCase().includes(q)) ||
    (i.user_name && i.user_name.toLowerCase().includes(q)) ||
    (i.department?.name && i.department.name.toLowerCase().includes(q))
  )

  const isExpiringSoon = (dateStr) => {
    if (!dateStr) return false
    const diffDays = (new Date(dateStr) - new Date()) / 86400000
    return diffDays >= 0 && diffDays <= 30
  }
  const isExpired = (dateStr) => dateStr && new Date(dateStr) < new Date()

  const exportExcel = () => {
    const rows = displayed.map((i, idx) => ({
      '#': idx + 1,
      [t('licensedSoftware.col.software')]: i.software_name || '',
      [t('licensedSoftware.col.department')]: i.department?.name || '',
      [t('licensedSoftware.col.user')]: i.user_name || '',
      [t('licensedSoftware.col.quantity')]: i.quantity ?? 1,
      [t('licensedSoftware.col.renewalDate')]: i.license_renewal_date || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const colWidths = Object.keys(rows[0] || {}).map((k) => ({
      wch: Math.max(k.length, ...rows.map((r) => String(r[k] || '').length)) + 2
    }))
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Licensed Software')
    XLSX.writeFile(wb, `licensed_software_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <Header title={t('licensedSoftware.title')} subtitle={t('licensedSoftware.subtitle')} />

      <div className="flex items-center justify-end gap-2">
        <button onClick={exportExcel} className="btn-secondary flex items-center gap-1.5">
          <span>📤</span> {t('licensedSoftware.exportBtn')}
        </button>
        <button onClick={() => navigate('/import?target=licensed_software')} className="btn-secondary flex items-center gap-1.5">
          <span>📥</span> {t('licensedSoftware.importBtn')}
        </button>
        <button onClick={openAdd} className="btn-primary"><span>+</span> {t('licensedSoftware.addBtn')}</button>
      </div>

      <div className="card !p-4 flex gap-3 flex-wrap">
        <input
          className="form-input flex-1 min-w-60"
          placeholder={t('licensedSoftware.searchQ')}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        {searchQ && <button onClick={() => setSearchQ('')} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>}
        <span className="text-sm text-slate-400 self-center">{displayed.length} {t('licensedSoftware.countSuffix')}</span>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['col.software', 'col.department', 'col.user', 'col.quantity', 'col.renewalDate', 'col.actions'].map((k) => (
                <th key={k} className="table-th">{t(`licensedSoftware.${k}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={6} className="table-td text-center py-12 text-slate-400">{t('common.loading')}</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={6} className="table-td text-center py-12 text-slate-400">{t('licensedSoftware.empty')}</td></tr>
            ) : displayed.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="table-td font-medium text-slate-800">{item.software_name}</td>
                <td className="table-td text-slate-500">{item.department?.name || '—'}</td>
                <td className="table-td text-slate-700">{item.user_name || '—'}</td>
                <td className="table-td text-slate-500">{item.quantity ?? 1}</td>
                <td className="table-td">
                  {item.license_renewal_date ? (
                    <span className={`badge ${
                      isExpired(item.license_renewal_date) ? 'bg-red-100 text-red-600' :
                      isExpiringSoon(item.license_renewal_date) ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {new Date(item.license_renewal_date).toLocaleDateString()}
                    </span>
                  ) : '—'}
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

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? t('licensedSoftware.modal.edit') : t('licensedSoftware.modal.add')} size="sm">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="form-label">{t('licensedSoftware.form.software')}</label>
            <input className="form-input" value={form.software_name} onChange={(e) => setForm((f) => ({ ...f, software_name: e.target.value }))} placeholder={t('licensedSoftware.form.softwarePlh')} />
          </div>
          <div>
            <label className="form-label">{t('licensedSoftware.form.department')}</label>
            <select className="form-select" value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}>
              <option value="">{t('common.noDepartment')}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('licensedSoftware.form.user')}</label>
            <input className="form-input" value={form.user_name} onChange={(e) => setForm((f) => ({ ...f, user_name: e.target.value }))} placeholder={t('licensedSoftware.form.userPlh')} />
          </div>
          <div>
            <label className="form-label">{t('licensedSoftware.form.quantity')}</label>
            <input type="number" min="1" className="form-input" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('licensedSoftware.form.renewalDate')}</label>
            <input type="date" className="form-input" value={form.license_renewal_date} onChange={(e) => setForm((f) => ({ ...f, license_renewal_date: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('licensedSoftware.form.notes')}</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? t('common.saving') : editing ? t('licensedSoftware.saveEdit') : t('licensedSoftware.saveAdd')}
          </button>
          <button onClick={() => setModal(false)} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
