import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { assetsApi, departmentsApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

const ASSET_TYPES = ['hardware', 'software', 'network', 'other']
const ASSET_STATUSES = ['active', 'inactive', 'maintenance', 'retired']
const BRANCHES = ['Abu - Rawash', 'IBS - Mohandesien', 'Mohandesien HQ', 'Wood & Steel Mohandesien', 'Alex', 'Heliopolis2', 'Sixth of October', 'Mohandesien']

const STATUS_COLORS = {
  active: 'bg-yellow-100 text-yellow-700',
  inactive: 'bg-slate-100 text-slate-600',
  maintenance: 'bg-yellow-100 text-yellow-700',
  retired: 'bg-red-100 text-red-600',
}

const emptyForm = {
  name: '', asset_type: 'hardware', serial_number: '', brand: '', model: '',
  purchase_date: '', warranty_expiry: '', status: 'active', location: '',
  assigned_to: '', employee_code: '', cost_center: '', branch: '', department_id: '', notes: '',
}

export default function Assets() {
  const { t } = useLanguage()
  const [assets, setAssets] = useState([])
  const [departments, setDepartments] = useState([])
  const [filter, setFilter] = useState({ status: '', asset_type: '', branch: '' })
  const [searchQ, setSearchQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    const params = {}
    if (filter.status) params.status = filter.status
    if (filter.asset_type) params.asset_type = filter.asset_type
    if (filter.branch) params.branch = filter.branch
    assetsApi.list(params).then((r) => setAssets(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])
  useEffect(() => { departmentsApi.list().then((r) => setDepartments(r.data)) }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(''); setModal(true) }
  const openEdit = (a) => { setEditing(a); setForm({ ...a, department_id: a.department_id || '' }); setError(''); setModal(true) }

  const handleSave = async () => {
    if (!form.name.trim()) { setError(t('assets.errorName')); return }
    setSaving(true); setError('')
    try {
      const data = { ...form, department_id: form.department_id || null }
      if (editing) await assetsApi.update(editing.id, data)
      else await assetsApi.create(data)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || 'Error') }
    finally { setSaving(false) }
  }

  const q = searchQ.trim().toLowerCase()
  const displayed = assets.filter(a =>
    !q ||
    (a.employee_code && a.employee_code.toLowerCase().includes(q)) ||
    (a.assigned_to && a.assigned_to.toLowerCase().includes(q)) ||
    (a.name && a.name.toLowerCase().includes(q))
  )

  const handleDelete = async (id) => {
    if (!confirm(t('assets.deleteConfirm'))) return
    await assetsApi.delete(id); load()
  }

  const exportExcel = () => {
    const rows = displayed.map((a, i) => ({
      '#': i + 1,
      [t('assets.col.employeeCode')]: a.employee_code || '',
      [t('assets.col.employeeName')]: a.assigned_to || '',
      [t('assets.col.name')]: a.name || '',
      [t('assets.col.type')]: a.asset_type || '',
      [t('assets.col.brandModel')]: [a.brand, a.model].filter(Boolean).join(' / ') || '',
      [t('assets.col.status')]: a.status || '',
      [t('assets.col.branch')]: a.branch || '',
      [t('assets.col.location')]: a.location || '',
      [t('assets.col.department')]: a.department?.name || '',
      [t('assets.col.costCenter')]: a.cost_center || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    // Auto column widths
    const colWidths = Object.keys(rows[0] || {}).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] || '').length)) + 2
    }))
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Assets')
    XLSX.writeFile(wb, `assets_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <Header title={t('assets.title')} subtitle={t('assets.subtitle')} />

      <div className="flex items-center justify-end gap-2">
        <button onClick={exportExcel} className="btn-secondary flex items-center gap-1.5">
          <span>📥</span> {t('assets.exportExcel')}
        </button>
        <button onClick={openAdd} className="btn-primary"><span>+</span> {t('assets.addBtn')}</button>
      </div>

      <div className="card !p-4 flex gap-3 flex-wrap">
        <select className="form-select w-auto" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
          <option value="">{t('assets.allStatuses')}</option>
          {ASSET_STATUSES.map((k) => <option key={k} value={k}>{t(`status.${k}`)}</option>)}
        </select>
        <select className="form-select w-auto" value={filter.asset_type} onChange={(e) => setFilter((f) => ({ ...f, asset_type: e.target.value }))}>
          <option value="">{t('assets.allTypes')}</option>
          {ASSET_TYPES.map((k) => <option key={k} value={k}>{t(`type.${k}`)}</option>)}
        </select>
        <select className="form-select w-auto" value={filter.branch} onChange={(e) => setFilter((f) => ({ ...f, branch: e.target.value }))}>
          <option value="">{t('assets.form.branch')} — All</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <input
          className="form-input flex-1 min-w-60"
          placeholder={t('assets.searchQ')}
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
        />
        {searchQ && <button onClick={() => setSearchQ('')} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>}
        <span className="text-sm text-slate-400 self-center">{displayed.length} {t('assets.countSuffix')}</span>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['col.name','col.type','col.brandModel','col.status','col.branch','col.location','col.department','col.employeeCode','col.employeeName','col.costCenter','col.actions'].map((k) => (
                <th key={k} className="table-th">{t(`assets.${k}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={11} className="table-td text-center py-12 text-slate-400">{t('common.loading')}</td></tr>
            ) : assets.length === 0 ? (
              <tr><td colSpan={11} className="table-td text-center py-12 text-slate-400">{t('assets.noAssets')}</td></tr>
            ) : displayed.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="table-td font-medium text-slate-800">{a.name}</td>
                <td className="table-td">{t(`type.${a.asset_type}`) || a.asset_type}</td>
                <td className="table-td text-slate-500">{[a.brand, a.model].filter(Boolean).join(' / ') || '—'}</td>
                <td className="table-td">
                  <span className={`badge ${STATUS_COLORS[a.status]}`}>{t(`status.${a.status}`)}</span>
                </td>
                <td className="table-td text-slate-500">{a.branch || '—'}</td>
                <td className="table-td text-slate-500">{a.location || '—'}</td>
                <td className="table-td text-slate-500">{a.department?.name || '—'}</td>
                <td className="table-td">
                  {a.employee_code
                    ? <span className="font-mono text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">{a.employee_code}</span>
                    : '—'}
                </td>
                <td className="table-td text-slate-700">{a.assigned_to || '—'}</td>
                <td className="table-td text-slate-500">{a.cost_center || '—'}</td>
                <td className="table-td">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(a)} className="btn-success">{t('common.edit')}</button>
                    <button onClick={() => handleDelete(a.id)} className="btn-danger">{t('common.delete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? t('assets.modal.edit') : t('assets.modal.add')} size="lg">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="form-label">{t('assets.form.name')}</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('assets.form.namePlh')} />
          </div>
          <div>
            <label className="form-label">{t('assets.form.type')}</label>
            <select className="form-select" value={form.asset_type} onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value }))}>
              {ASSET_TYPES.map((k) => <option key={k} value={k}>{t(`type.${k}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('assets.form.status')}</label>
            <select className="form-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {ASSET_STATUSES.map((k) => <option key={k} value={k}>{t(`status.${k}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('assets.form.brand')}</label>
            <input className="form-input" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder={t('assets.form.brandPlh')} />
          </div>
          <div>
            <label className="form-label">{t('assets.form.model')}</label>
            <input className="form-input" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('assets.form.serial')}</label>
            <input className="form-input" value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('assets.form.department')}</label>
            <select className="form-select" value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}>
              <option value="">{t('common.noDepartment')}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('assets.form.location')}</label>
            <input className="form-input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder={t('assets.form.locationPlh')} />
          </div>
          <div>
            <label className="form-label">{t('assets.form.assignedTo')}</label>
            <input className="form-input" value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('assets.form.employeeCode')}</label>
            <input className="form-input" value={form.employee_code} onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('assets.form.costCenter')}</label>
            <input className="form-input" value={form.cost_center} onChange={(e) => setForm((f) => ({ ...f, cost_center: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('assets.form.branch')}</label>
            <input className="form-input" value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('assets.form.purchaseDate')}</label>
            <input type="date" className="form-input" value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">{t('assets.form.warrantyExpiry')}</label>
            <input type="date" className="form-input" value={form.warranty_expiry} onChange={(e) => setForm((f) => ({ ...f, warranty_expiry: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="form-label">{t('assets.form.notes')}</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? t('common.saving') : editing ? t('assets.saveEdit') : t('assets.saveAdd')}
          </button>
          <button onClick={() => setModal(false)} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
