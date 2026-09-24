import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ticketsApi, engineersApi, departmentsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

// ── config ────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  open:        { badge: 'bg-red-100 text-red-600',      dot: 'bg-red-500' },
  in_progress: { badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  resolved:    { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  closed:      { badge: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400' },
}
const PRIORITY_CFG = {
  critical: { badge: 'bg-red-100 text-red-700 font-semibold', dot: 'bg-red-500' },
  high:     { badge: 'bg-yellow-100 text-yellow-700',          dot: 'bg-yellow-400' },
  medium:   { badge: 'bg-amber-100 text-amber-700',            dot: 'bg-amber-400' },
  low:      { badge: 'bg-slate-100 text-slate-500',            dot: 'bg-slate-300' },
}
const STATUSES   = ['open','in_progress','resolved','closed']
const PRIORITIES = ['critical','high','medium','low']
const PAGE_SIZES = [10, 25, 50, 100]

const QUICK = [
  { key: 'all',        params: {} },
  { key: 'open',       params: { status: 'open' } },
  { key: 'in_progress',params: { status: 'in_progress' } },
  { key: 'critical',   params: { priority: 'critical' } },
  { key: 'unassigned', params: { unassigned: true } },
  { key: 'fromEmail',  params: { source: 'email' } },
  { key: 'resolved',   params: { status: 'resolved' } },
]

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso, language) {
  if (!iso) return '—'
  return new Date(iso + (iso.includes('Z') ? '' : 'Z'))
    .toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: '2-digit' })
}
function fmtDatetime(iso, language) {
  if (!iso) return '—'
  const locale = language === 'ar' ? 'ar-EG' : 'en-US'
  const d = new Date(iso + (iso.includes('Z') ? '' : 'Z'))
  return d.toLocaleDateString(locale, { day:'2-digit', month:'2-digit', year:'2-digit' })
    + ' ' + d.toLocaleTimeString(locale, { hour:'2-digit', minute:'2-digit' })
}
function exportCSV(rows, filename, headers) {
  const keys = ['id','title','requester_name','requester_email','department','priority','status','assigned_to','source','created_at']
  const csv = [headers.join(','), ...rows.map(r => keys.map(k => {
    const v = k === 'department' ? (r.department?.name || '') : (r[k] ?? '')
    return `"${String(v).replace(/"/g,'""')}"`
  }).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2">
      {toasts.map(ts => (
        <div key={ts.id} className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white transition-all animate-fadeIn
          ${ts.type === 'success' ? 'bg-yellow-600' : ts.type === 'error' ? 'bg-red-500' : 'bg-slate-700'}`}>
          {ts.msg}
        </div>
      ))}
    </div>
  )
}

// ── SortTh ────────────────────────────────────────────────────────────────────
function SortTh({ label, col, sort, onSort, className = '' }) {
  const active = sort.by === col
  return (
    <th onClick={() => onSort(col)}
      className={`table-th cursor-pointer select-none hover:bg-slate-100 transition-colors ${className}`}>
      <span className="flex items-center gap-1">
        {label}
        <span className={`text-[10px] ${active ? 'text-yellow-600' : 'text-slate-300'}`}>
          {active ? (sort.dir === 'desc' ? '▼' : '▲') : '⇅'}
        </span>
      </span>
    </th>
  )
}

// ── Assign Modal ──────────────────────────────────────────────────────────────
function AssignModal({ tickets, engineers, onAssign, onClose }) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const isBulk = Array.isArray(tickets)
  const label = isBulk ? t('ticketLog.assignModal.ticketsCount').replace('{n}', tickets.length) : `#${tickets?.id} ${tickets?.title}`

  const handle = async () => {
    if (!selected) return
    setSaving(true)
    try { await onAssign(selected); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 z-10">
        <div className="flex items-center gap-2 mb-1">
          <img src="/mobica-logo.png" alt="Mobica" className="h-4 w-auto shrink-0" />
          <h3 className="font-bold text-slate-800">{t('ticketLog.assignModal.title')}</h3>
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mb-4 truncate">{label}</p>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {engineers.filter(e => e.active === 'true').map(eng => (
            <button key={eng.id} onClick={() => setSelected(eng.name)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start
                ${selected === eng.name ? 'border-yellow-500 bg-yellow-50' : 'border-slate-100 hover:border-yellow-200'}`}>
              <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                {eng.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{eng.name}</p>
                <p className="text-xs text-slate-400">{eng.role}</p>
              </div>
              {selected === eng.name && <span className="text-yellow-500">✓</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
          <button onClick={handle} disabled={!selected || saving}
            className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? '...' : '✅ ' + t('ticketLog.assign')}
          </button>
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  )
}

// ── BulkStatus Modal ──────────────────────────────────────────────────────────
function BulkStatusModal({ count, onApply, onClose }) {
  const { t } = useLanguage()
  const [status, setStatus] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 z-10">
        <div className="flex items-center gap-2 mb-1">
          <img src="/mobica-logo.png" alt="Mobica" className="h-4 w-auto shrink-0" />
          <h3 className="font-bold text-slate-800">{t('ticketLog.bulkStatusModal.title')}</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">{t('ticketLog.selectedCount').replace('{n}', count)}</p>
        <div className="space-y-2">
          {STATUSES.map(s => {
            const cfg = STATUS_CFG[s]
            return (
              <button key={s} onClick={() => setStatus(s)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start
                  ${status === s ? 'border-yellow-500 bg-yellow-50' : 'border-slate-100 hover:border-slate-200'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className="text-sm font-medium text-slate-700">{t(`status.${s}`)}</span>
                {status === s && <span className="text-yellow-500 mr-auto">✓</span>}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
          <button onClick={() => { if (status) onApply(status) }} disabled={!status}
            className="btn-primary flex-1 justify-center disabled:opacity-50">{t('common.confirm')}</button>
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminTicketLog() {
  const { engineer: me } = useAuth()
  const { t, language, setLanguage } = useLanguage()
  const canDelete = ['amr.eisa@mobica.net', 'abo.hagar309@gmail.com'].includes(me?.email?.toLowerCase())
  const navigate = useNavigate()
  const [urlParams, setUrlParams] = useSearchParams()

  // ── state ──
  const [data, setData]         = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [engineers, setEngineers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [quickIdx, setQuickIdx] = useState(0)
  const [toasts, setToasts]     = useState([])
  const [assignTarget, setAssignTarget] = useState(null)  // ticket | 'bulk'
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)

  // ── filter state ──
  const [filters, setFilters] = useState({
    search: '', status: [], priority: [],
    department_id: '', assigned_to: '',
    source: '', unassigned: false,
    date_from: '', date_to: '',
  })
  const [sort, setSort]       = useState({ by: 'id', dir: 'desc' })
  const [page, setPage]       = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const searchTimer = useRef(null)

  // ── toast helper ──
  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(ts => [...ts, { id, msg, type }])
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 3000)
  }, [])

  // ── load data ──
  const load = useCallback(async (overrides = {}) => {
    setLoading(true)
    try {
      const f = { ...filters, ...overrides }
      const params = {
        page, page_size: pageSize,
        sort_by: sort.by, sort_dir: sort.dir,
      }
      if (f.search.trim())    params.search = f.search.trim()
      if (f.status.length)    params.status = f.status.join(',')
      if (f.priority.length)  params.priority = f.priority.join(',')
      if (f.department_id)    params.department_id = f.department_id
      if (f.assigned_to)      params.assigned_to = f.assigned_to
      if (f.source)           params.source = f.source
      if (f.unassigned)       params.unassigned = true
      if (f.date_from)        params.date_from = f.date_from
      if (f.date_to)          params.date_to = f.date_to

      const res = await ticketsApi.adminLog(params)
      setData(res.data)
      setSelected(new Set())
    } finally {
      setLoading(false)
    }
  }, [filters, sort, page, pageSize])

  useEffect(() => { load() }, [sort, page, pageSize])

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); load() }, 350)
    return () => clearTimeout(searchTimer.current)
  }, [filters])

  useEffect(() => {
    Promise.all([engineersApi.list(), departmentsApi.list()])
      .then(([e, d]) => { setEngineers(e.data); setDepartments(d.data) })
  }, [])

  // ── apply quick filter ──
  const applyQuick = (idx) => {
    setQuickIdx(idx)
    const q = QUICK[idx].params
    setFilters(f => ({
      ...f,
      status: q.status ? [q.status] : [],
      priority: q.priority ? [q.priority] : [],
      source: q.source || '',
      unassigned: q.unassigned || false,
    }))
    setPage(1)
  }

  // ── sort ──
  const handleSort = (col) => {
    setSort(s => ({ by: col, dir: s.by === col && s.dir === 'desc' ? 'asc' : 'desc' }))
    setPage(1)
  }

  // ── selection ──
  const toggleAll = () => {
    if (selected.size === data.items.length) setSelected(new Set())
    else setSelected(new Set(data.items.map(tk => tk.id)))
  }
  const toggleOne = (id) => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  // ── bulk assign ──
  const handleBulkAssign = async (engineerName) => {
    const ids = [...selected]
    let ok = 0
    for (const id of ids) {
      try { await ticketsApi.assign(id, engineerName); ok++ } catch {}
    }
    toast(t('ticketLog.toast.assigned').replace('{n}', ok).replace('{name}', engineerName))
    load()
  }

  // ── bulk status ──
  const handleBulkStatus = async (status) => {
    setBulkStatusOpen(false)
    const ids = [...selected]
    let ok = 0
    for (const id of ids) {
      try { await ticketsApi.updateStatus(id, status); ok++ } catch {}
    }
    toast(t('ticketLog.toast.statusUpdated').replace('{n}', ok).replace('{status}', t(`status.${status}`)))
    load()
  }

  // ── single assign ──
  const handleSingleAssign = async (engineerName) => {
    await ticketsApi.assign(assignTarget.id, engineerName)
    toast(t('ticketLog.toast.singleAssigned').replace('{title}', assignTarget.title).replace('{name}', engineerName))
    load()
  }

  // ── single status ──
  const handleStatus = async (id, status) => {
    await ticketsApi.updateStatus(id, status)
    toast(t('ticketLog.toast.statusUpdatedSingle'))
    load()
  }

  // ── delete ──
  const handleDelete = async (id) => {
    if (!confirm(t('ticketLog.confirmDelete'))) return
    await ticketsApi.delete(id)
    toast(t('ticketLog.toast.deleted'))
    load()
  }

  const handleBulkDelete = async () => {
    if (!confirm(t('ticketLog.confirmBulkDelete').replace('{n}', selected.size))) return
    const ids = [...selected]
    let ok = 0
    for (const id of ids) { try { await ticketsApi.delete(id); ok++ } catch {} }
    toast(t('ticketLog.toast.bulkDeleted').replace('{n}', ok))
    load()
  }

  // ── filter helpers ──
  const toggleArr = (key, val) => setFilters(f => {
    const arr = f[key]
    return { ...f, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }
  })
  const resetFilters = () => {
    setFilters({ search:'', status:[], priority:[], department_id:'', assigned_to:'', source:'', unassigned:false, date_from:'', date_to:'' })
    setQuickIdx(0); setPage(1)
  }

  const activeFilterCount = [
    filters.search.trim(), ...filters.status, ...filters.priority,
    filters.department_id, filters.assigned_to, filters.source,
    filters.unassigned ? 'u' : '', filters.date_from, filters.date_to,
  ].filter(Boolean).length

  // ── export ──
  const handleExport = async () => {
    toast(t('ticketLog.toast.preparingExport'), 'info')
    try {
      const res = await ticketsApi.adminLog({
        ...(filters.search.trim() && { search: filters.search.trim() }),
        ...(filters.status.length && { status: filters.status.join(',') }),
        ...(filters.priority.length && { priority: filters.priority.join(',') }),
        ...(filters.department_id && { department_id: filters.department_id }),
        ...(filters.assigned_to && { assigned_to: filters.assigned_to }),
        ...(filters.source && { source: filters.source }),
        ...(filters.unassigned && { unassigned: true }),
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
        page: 1, page_size: 2000, sort_by: sort.by, sort_dir: sort.dir,
      })
      exportCSV(res.data.items, `${t('ticketLog.csvFilenamePrefix')}${new Date().toISOString().slice(0,10)}.csv`, t('ticketLog.csvHeaders'))
      toast(t('ticketLog.toast.exported'))
    } catch { toast(t('ticketLog.toast.exportFailed'), 'error') }
  }

  const selectedTickets = data.items.filter(tk => selected.has(tk.id))
  const locale = language === 'ar' ? 'ar-EG' : 'en-US'

  return (
    <div className="space-y-4">
      <Toast toasts={toasts} />

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t('ticketLog.title')}</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {loading ? t('common.loading') : t('ticketLog.ticketCount').replace('{n}', data.total.toLocaleString(locale))}
            {activeFilterCount > 0 && <span className="text-yellow-600 mr-1">· {t('ticketLog.activeFilters').replace('{n}', activeFilterCount)}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center bg-slate-100 rounded-full p-0.5 text-xs font-semibold">
            <button onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-full transition-all ${language === 'en' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
              EN
            </button>
            <button onClick={() => setLanguage('ar')}
              className={`px-2.5 py-1 rounded-full transition-all ${language === 'ar' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
              🇪🇬 AR
            </button>
          </div>
          <button onClick={handleExport} className="btn-secondary !py-2 !px-3 gap-1.5 text-sm">
            {t('ticketLog.exportCsv')}
          </button>
          <button onClick={() => { setPage(1); load() }}
            className="btn-secondary !py-2 !px-3 text-sm">🔄</button>
          <button onClick={() => navigate('/tickets/new')}
            className="btn-primary !py-2 !px-4 gap-1.5 text-sm">{t('ticketLog.newTicket')}</button>
        </div>
      </div>

      {/* ── Quick filter chips ── */}
      <div className="flex gap-1.5 flex-wrap">
        {QUICK.map((q, i) => (
          <button key={i} onClick={() => applyQuick(i)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border
              ${quickIdx === i
                ? 'bg-yellow-600 text-white border-yellow-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-yellow-400 hover:text-yellow-700'}`}>
            {t(`ticketLog.quick.${q.key}`)}
          </button>
        ))}
      </div>

      {/* ── Search + filter toggle ── */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            value={filters.search}
            onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1) }}
            placeholder={t('ticketLog.searchPlh')}
            className="input w-full pr-9 !py-2 text-sm"
          />
          {filters.search && (
            <button onClick={() => { setFilters(f => ({ ...f, search: '' })); setPage(1) }}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">✕</button>
          )}
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className={`btn-secondary !py-2 !px-4 gap-2 text-sm relative ${showFilters ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : ''}`}>
          {t('ticketLog.advancedFilters')}
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={resetFilters}
            className="text-xs text-red-500 hover:text-red-700 font-medium px-2">
            {t('ticketLog.clearAll')}
          </button>
        )}
      </div>

      {/* ── Advanced filter panel ── */}
      {showFilters && (
        <div className="card !p-4 border-2 border-yellow-100 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('ticketLog.filter.status')}</p>
              <div className="space-y-1.5">
                {STATUSES.map(s => {
                  const cfg = STATUS_CFG[s]
                  return (
                    <label key={s} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={filters.status.includes(s)}
                        onChange={() => { toggleArr('status', s); setPage(1) }}
                        className="w-3.5 h-3.5 accent-yellow-600 rounded" />
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-sm text-slate-700 group-hover:text-yellow-700">{t(`status.${s}`)}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Priority */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('ticketLog.filter.priority')}</p>
              <div className="space-y-1.5">
                {PRIORITIES.map(p => {
                  const cfg = PRIORITY_CFG[p]
                  return (
                    <label key={p} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={filters.priority.includes(p)}
                        onChange={() => { toggleArr('priority', p); setPage(1) }}
                        className="w-3.5 h-3.5 accent-yellow-600 rounded" />
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-sm text-slate-700 group-hover:text-yellow-700">{t(`priority.${p}`)}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Engineer + Dept + Source */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('ticketLog.filter.engineer')}</p>
                <select value={filters.assigned_to}
                  onChange={e => { setFilters(f => ({ ...f, assigned_to: e.target.value })); setPage(1) }}
                  className="input w-full !py-1.5 text-sm">
                  <option value="">{t('ticketLog.filter.all')}</option>
                  {engineers.filter(e => e.active === 'true').map(e => (
                    <option key={e.id} value={e.name}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('ticketLog.filter.department')}</p>
                <select value={filters.department_id}
                  onChange={e => { setFilters(f => ({ ...f, department_id: e.target.value })); setPage(1) }}
                  className="input w-full !py-1.5 text-sm">
                  <option value="">{t('ticketLog.filter.all')}</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('ticketLog.filter.source')}</p>
                <div className="flex gap-2">
                  {[{ val: '', label: t('ticketLog.filter.all') }, { val: 'email', label: t('ticketLog.source.email') }, { val: 'manual', label: t('ticketLog.source.manual') }].map(o => (
                    <button key={o.val} onClick={() => { setFilters(f => ({ ...f, source: o.val })); setPage(1) }}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-all font-medium
                        ${filters.source === o.val ? 'bg-yellow-600 text-white border-yellow-600' : 'border-slate-200 text-slate-600 hover:border-yellow-300'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Date range + unassigned */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('ticketLog.filter.dateFrom')}</p>
                <input type="date" value={filters.date_from}
                  onChange={e => { setFilters(f => ({ ...f, date_from: e.target.value })); setPage(1) }}
                  className="input w-full !py-1.5 text-sm" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('ticketLog.filter.dateTo')}</p>
                <input type="date" value={filters.date_to}
                  onChange={e => { setFilters(f => ({ ...f, date_to: e.target.value })); setPage(1) }}
                  className="input w-full !py-1.5 text-sm" />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer mt-1">
                <input type="checkbox" checked={filters.unassigned}
                  onChange={e => { setFilters(f => ({ ...f, unassigned: e.target.checked })); setPage(1) }}
                  className="w-4 h-4 accent-yellow-600 rounded" />
                <span className="text-sm font-medium text-slate-700">{t('ticketLog.filter.unassignedOnly')}</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── Active filter tags ── */}
      {activeFilterCount > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {filters.status.map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-medium">
              {t(`status.${s}`)}
              <button onClick={() => { toggleArr('status', s); setPage(1) }} className="hover:text-red-900">✕</button>
            </span>
          ))}
          {filters.priority.map(p => (
            <span key={p} className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full text-xs font-medium">
              {t(`priority.${p}`)}
              <button onClick={() => { toggleArr('priority', p); setPage(1) }} className="hover:text-yellow-900">✕</button>
            </span>
          ))}
          {filters.assigned_to && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full text-xs font-medium">
              👤 {filters.assigned_to}
              <button onClick={() => { setFilters(f => ({ ...f, assigned_to: '' })); setPage(1) }} className="hover:text-yellow-900">✕</button>
            </span>
          )}
          {filters.source && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-medium">
              {filters.source === 'email' ? t('ticketLog.source.email') : t('ticketLog.source.manual')}
              <button onClick={() => { setFilters(f => ({ ...f, source: '' })); setPage(1) }} className="hover:text-purple-900">✕</button>
            </span>
          )}
          {filters.unassigned && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
              ⚠️ {t('ticketLog.quick.unassigned')}
              <button onClick={() => { setFilters(f => ({ ...f, unassigned: false })); setPage(1) }} className="hover:text-amber-900">✕</button>
            </span>
          )}
          {(filters.date_from || filters.date_to) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-medium">
              📅 {filters.date_from || '…'} → {filters.date_to || '…'}
              <button onClick={() => { setFilters(f => ({ ...f, date_from: '', date_to: '' })); setPage(1) }} className="hover:text-slate-900">✕</button>
            </span>
          )}
        </div>
      )}

      {/* ── Bulk action toolbar ── */}
      {selected.size > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap animate-fadeIn">
          <span className="text-sm font-semibold text-yellow-800">
            {t('ticketLog.selectedCount').replace('{n}', selected.size)}
          </span>
          <div className="flex gap-2 flex-wrap mr-2">
            <button onClick={() => setAssignTarget('bulk')}
              className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
              {t('ticketLog.assignEngineer')}
            </button>
            <button onClick={() => setBulkStatusOpen(true)}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
              {t('ticketLog.changeStatus')}
            </button>
            {canDelete && (
              <button onClick={handleBulkDelete}
                className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
                🗑 {t('common.delete')}
              </button>
            )}
          </div>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-slate-500 hover:text-slate-700 mr-auto">{t('ticketLog.clearSelection')}</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="table-th w-10">
                  <input type="checkbox"
                    checked={data.items.length > 0 && selected.size === data.items.length}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 accent-yellow-600 rounded" />
                </th>
                <SortTh label="#"                          col="id"          sort={sort} onSort={handleSort} className="w-14" />
                <SortTh label={t('ticketLog.col.title')}      col="title"       sort={sort} onSort={handleSort} />
                <SortTh label={t('ticketLog.col.requester')}  col="requester"   sort={sort} onSort={handleSort} />
                <th className="table-th">{t('ticketLog.col.department')}</th>
                <SortTh label={t('ticketLog.col.priority')}   col="priority"    sort={sort} onSort={handleSort} className="w-24" />
                <SortTh label={t('ticketLog.col.status')}     col="status"      sort={sort} onSort={handleSort} className="w-28" />
                <SortTh label={t('ticketLog.col.engineer')}   col="assigned_to" sort={sort} onSort={handleSort} />
                <th className="table-th w-16">{t('ticketLog.col.source')}</th>
                <SortTh label={t('ticketLog.col.date')}       col="created_at"  sort={sort} onSort={handleSort} className="w-28" />
                <th className="table-th w-36">{t('ticketLog.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={11} className="py-16 text-center">
                  <div className="flex items-center justify-center gap-3 text-slate-400">
                    <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    {t('common.loading')}
                  </div>
                </td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={11} className="py-16 text-center text-slate-400">
                  <p className="text-3xl mb-2">🔍</p>
                  <p>{t('ticketLog.noResults')}</p>
                  {activeFilterCount > 0 && (
                    <button onClick={resetFilters} className="text-yellow-600 hover:underline text-sm mt-2">{t('ticketLog.clearFilters')}</button>
                  )}
                </td></tr>
              ) : data.items.map(ticket => {
                const pri  = PRIORITY_CFG[ticket.priority] || PRIORITY_CFG.medium
                const stat = STATUS_CFG[ticket.status]     || STATUS_CFG.open
                const isSel = selected.has(ticket.id)

                return (
                  <tr key={ticket.id}
                    className={`hover:bg-slate-50/50 transition-colors group ${isSel ? 'bg-yellow-50/30' : ''}`}>

                    {/* checkbox */}
                    <td className="table-td">
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(ticket.id)}
                        className="w-3.5 h-3.5 accent-yellow-600 rounded" />
                    </td>

                    {/* ID */}
                    <td className="table-td">
                      <span className="text-slate-400 text-xs font-mono">#{ticket.id}</span>
                    </td>

                    {/* Title */}
                    <td className="table-td max-w-[220px]">
                      <button onClick={() => navigate(`/tickets/${ticket.id}`)}
                        className="font-medium text-slate-800 hover:text-yellow-600 transition-colors text-start leading-snug line-clamp-2">
                        {ticket.title}
                      </button>
                    </td>

                    {/* Requester */}
                    <td className="table-td">
                      <p className="text-slate-700 text-xs font-medium truncate max-w-[120px]">{ticket.requester_name || '—'}</p>
                      {ticket.requester_email && (
                        <p className="text-slate-400 text-[10px] truncate max-w-[120px]">{ticket.requester_email}</p>
                      )}
                    </td>

                    {/* Dept */}
                    <td className="table-td">
                      <span className="text-xs text-slate-500 truncate max-w-[100px] block">
                        {ticket.department?.name || '—'}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="table-td">
                      <span className={`badge ${pri.badge} whitespace-nowrap`}>{t(`priority.${ticket.priority}`)}</span>
                    </td>

                    {/* Status */}
                    <td className="table-td">
                      <select value={ticket.status}
                        onChange={e => handleStatus(ticket.id, e.target.value)}
                        className={`text-xs rounded-lg px-2 py-1 border-0 font-medium cursor-pointer ${stat.badge}`}>
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{t(`status.${s}`)}</option>
                        ))}
                      </select>
                    </td>

                    {/* Assigned */}
                    <td className="table-td">
                      {ticket.assigned_to ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {ticket.assigned_to.charAt(0)}
                          </div>
                          <span className="text-xs text-slate-700 truncate max-w-[90px]">{ticket.assigned_to}</span>
                        </div>
                      ) : (
                        <button onClick={() => setAssignTarget(ticket)}
                          className="text-[11px] text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                          <span>⚠️</span> {t('ticketLog.assign')}
                        </button>
                      )}
                    </td>

                    {/* Source */}
                    <td className="table-td text-center">
                      <span title={ticket.source === 'email' ? t('ticketLog.source.email') : t('ticketLog.source.manual')}
                        className={`text-xs px-1.5 py-0.5 rounded-md ${ticket.source === 'email' ? 'bg-purple-50 text-purple-600' : 'bg-slate-50 text-slate-400'}`}>
                        {ticket.source === 'email' ? '📧' : '✋'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="table-td">
                      <span className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(ticket.created_at, language)}</span>
                    </td>

                    {/* Actions */}
                    <td className="table-td">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/tickets/${ticket.id}`)}
                          title={t('ticketLog.viewDetails')} className="p-1.5 rounded-lg hover:bg-yellow-100 text-yellow-600 text-sm transition-colors">👁</button>
                        <button onClick={() => setAssignTarget(ticket)}
                          title={t('ticketLog.assign')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 text-sm transition-colors">👤</button>
                        {canDelete && (
                          <button onClick={() => handleDelete(ticket.id)}
                            title={t('common.delete')} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 text-sm transition-colors">🗑</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {data.total > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3 bg-slate-50/50">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span>
                {t('ticketLog.paginationRange')
                  .replace('{from}', ((page - 1) * pageSize + 1).toLocaleString(locale))
                  .replace('{to}', Math.min(page * pageSize, data.total).toLocaleString(locale))
                  .replace('{total}', data.total.toLocaleString(locale))}
              </span>
              <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1) }}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
                {PAGE_SIZES.map(s => <option key={s} value={s}>{t('ticketLog.perPage').replace('{n}', s)}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs">
                «
              </button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs">
                ‹
              </button>

              {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
                let p
                if (data.pages <= 5) p = i + 1
                else if (page <= 3) p = i + 1
                else if (page >= data.pages - 2) p = data.pages - 4 + i
                else p = page - 2 + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-medium transition-all
                      ${page === p ? 'bg-yellow-600 border-yellow-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {p}
                  </button>
                )
              })}

              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs">
                ›
              </button>
              <button onClick={() => setPage(data.pages)} disabled={page === data.pages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs">
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {assignTarget && assignTarget !== 'bulk' && (
        <AssignModal ticket={assignTarget} engineers={engineers}
          onAssign={handleSingleAssign} onClose={() => setAssignTarget(null)} />
      )}
      {assignTarget === 'bulk' && (
        <AssignModal tickets={selectedTickets} engineers={engineers}
          onAssign={handleBulkAssign} onClose={() => setAssignTarget(null)} />
      )}
      {bulkStatusOpen && (
        <BulkStatusModal count={selected.size}
          onApply={handleBulkStatus} onClose={() => setBulkStatusOpen(false)} />
      )}
    </div>
  )
}
