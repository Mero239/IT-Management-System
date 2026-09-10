import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../context/LanguageContext'

const API = 'http://localhost:8000/api'

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('it_token') || ''}`, 'Content-Type': 'application/json' }
}

async function apiFetch(path, opts = {}) {
  const r = await fetch(API + path, { headers: authHeader(), ...opts })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// ── Gauge bar ────────────────────────────────────────────────────────────────
function GaugeBar({ label, value, warn = 85, danger = 90 }) {
  const pct   = parseFloat(value) || 0
  const color = pct >= danger ? 'bg-red-500' : pct >= warn ? 'bg-amber-400' : 'bg-yellow-400'
  const text  = pct >= danger ? 'text-red-700' : pct >= warn ? 'text-amber-700' : 'text-yellow-700'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className={`font-bold ${text}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

// ── Server card ──────────────────────────────────────────────────────────────
function ServerCard({ srv, t }) {
  return (
    <div className={`card !p-4 border-r-4 ${srv.up ? 'border-yellow-400' : 'border-red-400'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{srv.up ? '🟢' : '🔴'}</span>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{srv.name}</p>
            <p className="text-xs text-slate-400 font-mono">{srv.ip}</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${srv.up ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
            {srv.up ? t('mon.up') : t('mon.down')}
          </span>
          <p className="text-[10px] text-slate-400 mt-1">{srv.has_ssh ? t('mon.hasSSH') : t('mon.noSSH')}</p>
        </div>
      </div>
    </div>
  )
}

// ── Live Dashboard tab ───────────────────────────────────────────────────────
function DashboardTab({ t }) {
  const [status,  setStatus]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [pinging, setPinging] = useState(false)
  const [reportMsg, setReportMsg] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const s = await apiFetch('/monitor/status')
      setStatus(s)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [load])

  const sendReport = async () => {
    setPinging(true)
    try {
      await apiFetch('/monitor/report-now', { method: 'POST' })
      setReportMsg(t('mon.reportSent'))
      setTimeout(() => setReportMsg(''), 3000)
    } finally { setPinging(false) }
  }

  if (loading && !status) return (
    <div className="py-16 text-center text-slate-400 text-sm">{t('mon.loading')}</div>
  )

  const ls = status?.local || {}
  const th = status?.thresholds || { cpu: 85, ram: 90, disk: 85 }

  return (
    <div className="space-y-5">
      {/* Service status bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center text-2xl">🖥️</div>
          <div>
            <h3 className="font-bold text-slate-800">{t('mon.status')}</h3>
            {status?.running
              ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />{t('mon.running')}
                </span>
              : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />{t('mon.stopped')}
                </span>
            }
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {reportMsg && <span className="text-xs text-yellow-600 font-medium">{reportMsg}</span>}
          <button onClick={sendReport} disabled={pinging || !status?.channel_id} className="btn-secondary !py-1.5 !text-xs disabled:opacity-40">
            {pinging ? '...' : t('mon.reportNow')}
          </button>
          <button onClick={load} className="btn-secondary !py-1.5 !text-xs">🔄</button>
        </div>
      </div>

      {!status?.channel_id && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          ⚠️ {t('mon.noChannel')}
        </div>
      )}

      {/* This server stats */}
      <div className="card !p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🟢</span>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{t('mon.localServer')}</p>
            <p className="text-xs text-slate-400">localhost</p>
          </div>
        </div>
        <div className="space-y-3">
          <GaugeBar label={t('mon.cpu')}  value={ls.cpu}  warn={th.cpu  - 10} danger={th.cpu} />
          <GaugeBar label={t('mon.ram')}  value={ls.ram}  warn={th.ram  - 10} danger={th.ram} />
          <GaugeBar label={t('mon.disk')} value={ls.disk} warn={th.disk - 10} danger={th.disk} />
        </div>
        {ls.ram_used_gb !== undefined && (
          <div className="flex gap-4 mt-3 text-xs text-slate-400">
            <span>RAM: {ls.ram_used_gb}GB / {ls.ram_total_gb}GB</span>
            <span>Disk free: {ls.disk_free_gb}GB</span>
          </div>
        )}
      </div>

      {/* Remote servers grid */}
      <div>
        <h3 className="font-semibold text-slate-700 text-sm mb-3">🌐 {t('mon.servers')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(status?.servers || []).map(srv => (
            <ServerCard key={srv.ip} srv={srv} t={t} />
          ))}
        </div>
      </div>

      {/* Schedule info */}
      {status?.schedule?.length > 0 && (
        <div className="card !p-4">
          <p className="text-sm font-medium text-slate-700 mb-2">📅 {t('mon.schedule')}</p>
          <div className="flex flex-wrap gap-2">
            {status.schedule.map(s => (
              <span key={s} className="text-xs bg-slate-100 text-slate-600 font-mono px-2.5 py-1 rounded-lg">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Settings tab ─────────────────────────────────────────────────────────────
function SettingsTab({ t }) {
  const [config,  setConfig]  = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [starting, setStarting] = useState(false)

  const load = async () => {
    try {
      const c = await apiFetch('/monitor/config')
      setConfig(c)
    } catch (e) { console.error(e) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await apiFetch('/monitor/config', { method: 'POST', body: JSON.stringify(config) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
      await load()
    } finally { setSaving(false) }
  }

  const toggleService = async () => {
    setStarting(true)
    try {
      const endpoint = config?.enabled ? '/monitor/stop' : '/monitor/start'
      await apiFetch(endpoint, { method: 'POST' })
      await load()
    } finally { setStarting(false) }
  }

  const addServer = () => {
    setConfig(c => ({ ...c, servers: [...(c.servers || []), { name: '', ip: '', os: 'none', ssh_user: '', ssh_pass: '' }] }))
  }

  const removeServer = (i) => {
    setConfig(c => ({ ...c, servers: c.servers.filter((_, idx) => idx !== i) }))
  }

  const updateServer = (i, field, val) => {
    setConfig(c => {
      const servers = [...c.servers]
      servers[i] = { ...servers[i], [field]: val }
      return { ...c, servers }
    })
  }

  const toggleSchedule = (time) => {
    setConfig(c => {
      const s = c.schedule || []
      return { ...c, schedule: s.includes(time) ? s.filter(x => x !== time) : [...s, time].sort() }
    })
  }

  if (!config) return <div className="py-12 text-center text-slate-400 text-sm">جاري التحميل...</div>

  const SCHEDULE_OPTIONS = ['07:00','07:30','08:00','09:00','11:00','12:00','13:00','15:00','16:00','16:50','17:00','18:00']

  return (
    <div className="space-y-5">
      {/* Enable / start-stop */}
      <div className="card !p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-semibold text-slate-700">{t('mon.status')}</p>
          <p className="text-xs text-slate-400 mt-0.5">{config.enabled ? t('mon.running') : t('mon.stopped')}</p>
        </div>
        <button
          onClick={toggleService}
          disabled={starting || !config.channel_id}
          className={`!py-2 !px-5 !text-sm disabled:opacity-40 ${config.enabled ? 'btn-danger' : 'btn-success'}`}
        >
          {starting ? '...' : config.enabled ? t('mon.stop') : t('mon.start')}
        </button>
      </div>

      {/* Channel ID */}
      <div className="card !p-5 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">✈️ {t('mon.channelId')}</h3>
        <input
          className="form-input !text-sm font-mono"
          placeholder={t('mon.channelPlh')}
          value={config.channel_id || ''}
          onChange={e => setConfig(c => ({ ...c, channel_id: e.target.value }))}
          dir="ltr"
        />
        <p className="text-xs text-slate-400">القيمة الحالية من السيرفر القديم: <code className="bg-slate-100 px-1 rounded">-1003847048994</code></p>
      </div>

      {/* Thresholds */}
      <div className="card !p-5 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm">⚡ {t('mon.thresholds')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {['cpu','ram','disk'].map(k => (
            <div key={k}>
              <label className="form-label uppercase text-[11px]">{k}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="50" max="99"
                  className="form-input !text-sm text-center"
                  value={config.thresholds?.[k] || 85}
                  onChange={e => setConfig(c => ({ ...c, thresholds: { ...(c.thresholds||{}), [k]: Number(e.target.value) } }))}
                />
                <span className="text-slate-400 text-sm">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert interval */}
      <div className="card !p-5 space-y-2">
        <h3 className="font-semibold text-slate-700 text-sm">🔕 {t('mon.alertInterval')}</h3>
        <div className="flex items-center gap-2">
          <input
            type="number" min="5" max="1440"
            className="form-input !text-sm w-28"
            value={config.alert_interval_minutes || 60}
            onChange={e => setConfig(c => ({ ...c, alert_interval_minutes: Number(e.target.value) }))}
          />
          <span className="text-slate-500 text-sm">دقيقة</span>
        </div>
      </div>

      {/* Schedule */}
      <div className="card !p-5 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm">📅 {t('mon.schedule')}</h3>
        <div className="flex flex-wrap gap-2">
          {SCHEDULE_OPTIONS.map(time => {
            const active = (config.schedule || []).includes(time)
            return (
              <button
                key={time}
                onClick={() => toggleSchedule(time)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border-2 transition-all ${
                  active ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-slate-100 text-slate-400 hover:border-slate-300'
                }`}
              >
                {time}
              </button>
            )
          })}
        </div>
      </div>

      {/* Servers */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700 text-sm">🌐 {t('mon.servers')}</h3>
          <button onClick={addServer} className="btn-secondary !py-1 !text-xs">{t('mon.addServer')}</button>
        </div>
        <div className="divide-y divide-slate-50">
          {(config.servers || []).map((srv, i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="form-label">{t('mon.serverName')}</label>
                  <input className="form-input !text-sm" value={srv.name} onChange={e => updateServer(i, 'name', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">{t('mon.serverIp')}</label>
                  <input className="form-input !text-sm font-mono" value={srv.ip} onChange={e => updateServer(i, 'ip', e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="form-label">{t('mon.serverOs')}</label>
                  <select className="form-select !text-sm" value={srv.os || 'none'} onChange={e => updateServer(i, 'os', e.target.value)}>
                    <option value="none">Ping only</option>
                    <option value="linux">Linux (SSH)</option>
                    <option value="windows">Windows (SSH)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={() => removeServer(i)} className="btn-danger !py-2 !text-xs w-full">{t('mon.remove')}</button>
                </div>
              </div>
              {(srv.os === 'linux' || srv.os === 'windows') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">{t('mon.sshUser')}</label>
                    <input className="form-input !text-sm" value={srv.ssh_user || ''} onChange={e => updateServer(i, 'ssh_user', e.target.value)} dir="ltr" />
                  </div>
                  <div>
                    <label className="form-label">{t('mon.sshPass')}</label>
                    <input type="password" className="form-input !text-sm" value={srv.ssh_pass || ''} placeholder="••••" onChange={e => updateServer(i, 'ssh_pass', e.target.value)} dir="ltr" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary w-full !py-3 disabled:opacity-40">
        {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ ✓' : t('mon.saveSettings')}
      </button>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ServerMonitor() {
  const { t } = useLanguage()
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t('mon.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('mon.subtitle')}</p>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {[
          { key: 'dashboard', label: t('mon.tabDashboard'), icon: '📡' },
          { key: 'settings',  label: t('mon.tabSettings'),  icon: '⚙️' },
        ].map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === tb.key ? 'bg-white shadow text-yellow-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tb.icon}</span>{tb.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab t={t} />}
      {tab === 'settings'  && <SettingsTab  t={t} />}
    </div>
  )
}
