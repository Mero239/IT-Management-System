import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { backupApi } from '../api/client'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

const ROOT_EMAIL = 'abo.hagar309@gmail.com'

function RootGuard({ children }) {
  const { engineer } = useAuth()
  const navigate = useNavigate()
  const isRoot = engineer?.email?.toLowerCase() === ROOT_EMAIL
  useEffect(() => {
    if (engineer && !isRoot) navigate('/', { replace: true })
  }, [engineer])
  if (!engineer || !isRoot) return null
  return children
}

function fmtBytes(n) {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(1)} ${units[i]}`
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

function BackupCard({ icon, title, desc, available, unavailableMsg, meta, onDownload, t }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const handleClick = async () => {
    setDownloading(true); setError('')
    try { await onDownload() }
    catch { setError(t('backup.downloadFailed')) }
    finally { setDownloading(false) }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-yellow-50 flex items-center justify-center text-2xl shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-800">{title}</h3>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${available ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-400'}`}>
              {available ? t('backup.available') : t('backup.unavailable')}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{desc}</p>
          {available && meta && <p className="text-xs text-slate-400 mt-1">{meta}</p>}
          {!available && unavailableMsg && <p className="text-xs text-amber-600 mt-1">{unavailableMsg}</p>}
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button onClick={handleClick} disabled={!available || downloading}
        className="btn-primary w-full !py-2.5 disabled:opacity-40">
        {downloading ? t('backup.downloading') : `📥 ${t('backup.download')}`}
      </button>
    </div>
  )
}

export default function AdminBackup() {
  const { t } = useLanguage()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { backupApi.status().then(r => setStatus(r.data)).finally(() => setLoading(false)) }, [])

  const today = () => new Date().toISOString().slice(0, 10)

  return (
    <RootGuard>
      <div className="space-y-5 max-w-3xl">
        <Header title={t('backup.title')} subtitle={t('backup.subtitle')} />

        {loading ? (
          <div className="card text-center py-12 text-slate-400">{t('common.loading')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BackupCard
              icon="🗄️" t={t}
              title={t('backup.database.title')}
              desc={t('backup.database.desc')}
              available={status?.database?.available}
              meta={fmtBytes(status?.database?.size_bytes)}
              onDownload={async () => {
                const r = await backupApi.downloadDatabase()
                triggerDownload(r.data, `it_management_${today()}.db`)
              }}
            />
            <BackupCard
              icon="🧩" t={t}
              title={t('backup.code.title')}
              desc={t('backup.code.desc')}
              available={status?.code?.available}
              unavailableMsg={t('backup.code.unavailable')}
              onDownload={async () => {
                const r = await backupApi.downloadCode()
                triggerDownload(r.data, `itms_code_${today()}.zip`)
              }}
            />
            <BackupCard
              icon="📜" t={t}
              title={t('backup.logs.title')}
              desc={t('backup.logs.desc')}
              available={status?.logs?.available}
              unavailableMsg={t('backup.logs.unavailable')}
              meta={status?.logs?.available ? `${status.logs.file_count} · ${fmtBytes(status.logs.size_bytes)}` : ''}
              onDownload={async () => {
                const r = await backupApi.downloadLogs()
                triggerDownload(r.data, `itms_logs_${today()}.zip`)
              }}
            />
          </div>
        )}
      </div>
    </RootGuard>
  )
}
