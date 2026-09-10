import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { agreementsApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { BRAND_TAGLINE } from '../constants'

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SupportAgreement() {
  const { t } = useLanguage()
  const { engineer } = useAuth()
  const isAdmin = engineer?.permission_level === 'admin'
  const fileInputRef = useRef()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    agreementsApi.list().then((r) => setItems(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setTitle(''); setFile(null); setError(''); setModal(true) }

  const pickFile = (f) => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError(t('agreements.errorType')); return }
    setError('')
    setFile(f)
    if (!title.trim()) setTitle(f.name.replace(/\.pdf$/i, ''))
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    pickFile(e.dataTransfer.files[0])
  }

  const handleSave = async () => {
    if (!file) { setError(t('agreements.errorFile')); return }
    if (!title.trim()) { setError(t('agreements.errorTitle')); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('file', file)
      await agreementsApi.upload(fd)
      setModal(false); load()
    } catch (e) { setError(e.response?.data?.detail || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('agreements.deleteConfirm'))) return
    try { await agreementsApi.delete(id); load() }
    catch (e) { alert(e.response?.data?.detail || 'Cannot delete') }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Public top bar — this page has no sidebar, it's readable by anyone */}
      <div className="bg-gradient-to-br from-yellow-900 via-yellow-800 to-yellow-700 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0">💻</div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">{t('app.name')}</h1>
              <p className="text-yellow-200 text-xs">{BRAND_TAGLINE}</p>
            </div>
          </div>
          {engineer ? (
            <Link to="/" className="text-yellow-200 hover:text-white text-sm transition-colors">
              ← {t('agreements.backToApp')}
            </Link>
          ) : (
            <Link to="/login" className="text-yellow-200 hover:text-white text-sm transition-colors">
              {t('agreements.staffLogin')} →
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <Header title={t('agreements.title')} subtitle={t('agreements.subtitle')} />

        {isAdmin && (
          <div className="flex items-center justify-end gap-2">
            <button onClick={openAdd} className="btn-primary"><span>+</span> {t('agreements.addBtn')}</button>
          </div>
        )}

        <div className="card !p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['col.title', 'col.file', 'col.size', 'col.uploadedAt', 'col.actions'].map((k) => (
                  <th key={k} className="table-th">{t(`agreements.${k}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="table-td text-center py-12 text-slate-400">{t('common.loading')}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="table-td text-center py-12 text-slate-400">{t('agreements.empty')}</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="table-td font-medium text-slate-800">📄 {item.title}</td>
                  <td className="table-td text-slate-500">{item.original_filename}</td>
                  <td className="table-td text-slate-500">{formatSize(item.file_size)}</td>
                  <td className="table-td text-slate-500">{item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : '—'}</td>
                  <td className="table-td">
                    <div className="flex gap-2">
                      <a href={agreementsApi.downloadUrl(item.id)} target="_blank" rel="noreferrer" className="btn-success">
                        ⬇️ {t('agreements.download')}
                      </a>
                      {isAdmin && (
                        <button onClick={() => handleDelete(item.id)} className="btn-danger">{t('common.delete')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <Modal isOpen={modal} onClose={() => setModal(false)} title={t('agreements.modal.add')} size="sm">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          <div className="space-y-4">
            <div>
              <label className="form-label">{t('agreements.form.title')}</label>
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('agreements.form.titlePlh')} />
            </div>
            <div>
              <label className="form-label">{t('agreements.form.file')}</label>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => pickFile(e.target.files[0])} />
              <div
                onClick={() => fileInputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragging ? 'border-yellow-400 bg-yellow-50' : 'border-slate-200 hover:border-yellow-300 hover:bg-slate-50'
                }`}
              >
                {file ? (
                  <p className="text-slate-700 font-medium">📄 {file.name}</p>
                ) : (
                  <>
                    <p className="text-3xl mb-1">📂</p>
                    <p className="text-slate-500 text-sm">{t('agreements.dropzone')}</p>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? t('common.saving') : t('agreements.saveAdd')}
            </button>
            <button onClick={() => setModal(false)} className="btn-secondary">{t('common.cancel')}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
