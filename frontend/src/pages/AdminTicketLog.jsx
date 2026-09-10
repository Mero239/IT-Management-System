import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ticketsApi, engineersApi, departmentsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

// ── config ────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  open:        { label: 'مفتوحة',      badge: 'bg-red-100 text-red-600',      dot: 'bg-red-500' },
  in_progress: { label: 'قيد التنفيذ', badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  resolved:    { label: 'محلولة',      badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  closed:      { label: 'مغلقة',       badge: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400' },
}
const PRIORITY_CFG = {
  critical: { label: 'حرجة',   badge: 'bg-red-100 text-red-700 font-semibold', dot: 'bg-red-500' },
  high:     { label: 'عالية',  badge: 'bg-yellow-100 text-yellow-700',          dot: 'bg-yellow-400' },
  medium:   { label: 'متوسطة', badge: 'bg-amber-100 text-amber-700',            dot: 'bg-amber-400' },
  low:      { label: 'منخفضة', badge: 'bg-slate-100 text-slate-500',            dot: 'bg-slate-300' },
}
const STATUSES   = ['open','in_progress','resolved','closed']
const PRIORITIES = ['critical','high','medium','low']
const PAGE_SIZES = [10, 25, 50, 100]

const QUICK = [
  { label: 'الكل',        params: {} },
  { label: 'مفتوحة',     params: { status: 'open' } },
  { label: 'قيد التنفيذ',params: { status: 'in_progress' } },
  { label: 'حرجة',       params: { priority: 'critical' } },
  { label: 'غير معيّنة', params: { unassigned: true } },
  { label: 'من البريد',  params: { source: 'email' } },
  { label: 'محلولة',     params: { status: 'resolved' } },
]

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + (iso.includes('Z') ? '' : 'Z'))
    .toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: '2-digit' })
}
function fmtDatetime(iso) {
  if (!iso) return '—'
  const d = new Date(iso + (iso.includes('Z') ? '' : 'Z'))
  return d.toLocaleDateString('ar-EG', { day:'2-digit', month:'2-digit', year:'2-digit' })
    + ' ' + d.toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' })
}
function exportCSV(rows, filename) {
  const keys = ['id','title','requester_name','requester_email','department','priority','status','assigned_to','source','created_at']
  const labels = ['#','العنوان','الطالب','البريد','القسم','الأولوية','الحالة','المهندس','المصدر','التاريخ']
  const csv = [labels.join(','), ...rows.map(r => keys.map(k => {
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
      {toasts.map(t => (
        <div key={t.id} className={`px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white transition-all animate-fadeIn
          ${t.type === 'success' ? 'bg-yellow-600' : t.type === 'error' ? 'bg-red-500' : 'bg-slate-700'}`}>
          {t.msg}
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
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const isBulk = Array.isArray(tickets)
  const label = isBulk ? `${tickets.length} تذاكر` : `#${tickets?.id} ${tickets?.title}`

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
        <h3 className="font-bold text-slate-800 mb-1">تعيين مهندس</h3>
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
            {saving ? '...' : '✅ تأكيد'}
          </button>
          <button onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </div>
    </div>
  )
}

// ── BulkStatus Modal ──────────────────────────────────────────────────────────
function BulkStatusModal({ count, onApply, onClose }) {
  const [status, setStatus] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 z-10">
        <h3 className="font-bold text-slate-800 mb-1">تغيير الحالة</h3>
        <p className="text-xs text-slate-500 mb-4">{count} تذكرة محددة</p>
        <div className="space-y-2">
          {STATUSES.map(s => {
            const cfg = STATUS_CFG[s]
            return (
              <button key={s} onClick={() => setStatus(s)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start
                  ${status === s ? 'border-yellow-500 bg-yellow-50' : 'border-slate-100 hover:border-slate-200'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className="text-sm font-medium text-slate-700">{cfg.label}</span>
                {status === s && <span className="text-yellow-500 mr-auto">✓</span>}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
          <button onClick={() => { if (status) onApply(status) }} disabled={!status}
            className="btn-primary flex-1 justify-center disabled:opacity-50">تأكيد</button>
          <button onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminTicketLog() {
  const { engineer: me } = useAuth()
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
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
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
    else setSelected(new Set(data.items.map(t => t.id)))
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
    toast(`تم تعيين ${ok} تذكرة لـ ${engineerName}`)
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
    toast(`تم تحديث ${ok} تذكرة إلى "${STATUS_CFG[status]?.label}"`)
    load()
  }

  // ── single assign ──
  const handleSingleAssign = async (engineerName) => {
    await ticketsApi.assign(assignTarget.id, engineerName)
    toast(`تم تعيين "${assignTarget.title}" لـ ${engineerName}`)
    load()
  }

  // ── single status ──
  const handleStatus = async (id, status) => {
    await ticketsApi.updateStatus(id, status)
    toast('تم تحديث الحالة')
    load()
  }

  // ── delete ──
  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه التذكرة؟')) return
    await ticketsApi.delete(id)
    toast('تم الحذف')
    load()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`حذف ${selected.size} تذاكر؟`)) return
    const ids = [...selected]
    let ok = 0
    for (const id of ids) { try { await ticketsApi.delete(id); ok++ } catch {} }
    toast(`تم حذف ${ok} تذكرة`)
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
    toast('جاري تحضير الملف...', 'info')
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
      exportCSV(res.data.items, `سجل_التذاكر_${new Date().toISOString().slice(0,10)}.csv`)
      toast('تم تصدير الملف')
    } catch { toast('فشل التصدير', 'error') }
  }

  const selectedTickets = data.items.filter(t => selected.has(t.id))

  return (
    <div className="space-y-4">
      <Toast toasts={toasts} />

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">📋 سجل التذاكر</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {loading ? 'جاري التحميل...' : `${data.total.toLocaleString('ar-EG')} تذكرة`}
            {activeFilterCount > 0 && <span className="text-yellow-600 mr-1">· {activeFilterCount} فلاتر نشطة</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleExport} className="btn-secondary !py-2 !px-3 gap-1.5 text-sm">
            📥 تصدير CSV
          </button>
          <button onClick={() => { setPage(1); load() }}
            className="btn-secondary !py-2 !px-3 text-sm">🔄</button>
          <button onClick={() => navigate('/tickets/new')}
            className="btn-primary !py-2 !px-4 gap-1.5 text-sm">+ تذكرة جديدة</button>
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
            {q.label}
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
            placeholder="بحث بالعنوان، الطالب، البريد، المهندس..."
            className="input w-full pr-9 !py-2 text-sm"
          />
          {filters.search && (
            <button onClick={() => { setFilters(f => ({ ...f, search: '' })); setPage(1) }}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">✕</button>
          )}
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className={`btn-secondary !py-2 !px-4 gap-2 text-sm relative ${showFilters ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : ''}`}>
          ⚙️ فلاتر متقدمة
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={resetFilters}
            className="text-xs text-red-500 hover:text-red-700 font-medium px-2">
            × مسح الكل
          </button>
        )}
      </div>

      {/* ── Advanced filter panel ── */}
      {showFilters && (
        <div className="card !p-4 border-2 border-yellow-100 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">الحالة</p>
              <div className="space-y-1.5">
                {STATUSES.map(s => {
                  const cfg = STATUS_CFG[s]
                  return (
                    <label key={s} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={filters.status.includes(s)}
                        onChange={() => { toggleArr('status', s); setPage(1) }}
                        className="w-3.5 h-3.5 accent-yellow-600 rounded" />
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-sm text-slate-700 group-hover:text-yellow-700">{cfg.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Priority */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">الأولوية</p>
              <div className="space-y-1.5">
                {PRIORITIES.map(p => {
                  const cfg = PRIORITY_CFG[p]
                  return (
                    <label key={p} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={filters.priority.includes(p)}
                        onChange={() => { toggleArr('priority', p); setPage(1) }}
                        className="w-3.5 h-3.5 accent-yellow-600 rounded" />
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-sm text-slate-700 group-hover:text-yellow-700">{cfg.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Engineer + Dept + Source */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">المهندس</p>
                <select value={filters.assigned_to}
                  onChange={e => { setFilters(f => ({ ...f, assigned_to: e.target.value })); setPage(1) }}
                  className="input w-full !py-1.5 text-sm">
                  <option value="">الكل</option>
                  {engineers.filter(e => e.active === 'true').map(e => (
                    <option key={e.id} value={e.name}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">القسم</p>
                <select value={filters.department_id}
                  onChange={e => { setFilters(f => ({ ...f, department_id: e.target.value })); setPage(1) }}
                  className="input w-full !py-1.5 text-sm">
                  <option value="">الكل</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">المصدر</p>
                <div className="flex gap-2">
                  {[{ val: '', label: 'الكل' }, { val: 'email', label: '📧 بريد' }, { val: 'manual', label: '✋ يدوي' }].map(o => (
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
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">من تاريخ</p>
                <input type="date" value={filters.date_from}
                  onChange={e => { setFilters(f => ({ ...f, date_from: e.target.value })); setPage(1) }}
                  className="input w-full !py-1.5 text-sm" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">إلى تاريخ</p>
                <input type="date" value={filters.date_to}
                  onChange={e => { setFilters(f => ({ ...f, date_to: e.target.value })); setPage(1) }}
                  className="input w-full !py-1.5 text-sm" />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer mt-1">
                <input type="checkbox" checked={filters.unassigned}
                  onChange={e => { setFilters(f => ({ ...f, unassigned: e.target.checked })); setPage(1) }}
                  className="w-4 h-4 accent-yellow-600 rounded" />
                <span className="text-sm font-medium text-slate-700">غير معيّنة فقط</span>
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
              {STATUS_CFG[s]?.label}
              <button onClick={() => { toggleArr('status', s); setPage(1) }} className="hover:text-red-900">✕</button>
            </span>
          ))}
          {filters.priority.map(p => (
            <span key={p} className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full text-xs font-medium">
              {PRIORITY_CFG[p]?.label}
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
              {filters.source === 'email' ? '📧 بريد' : '✋ يدوي'}
              <button onClick={() => { setFilters(f => ({ ...f, source: '' })); setPage(1) }} className="hover:text-purple-900">✕</button>
            </span>
          )}
          {filters.unassigned && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
              ⚠️ غير معيّنة
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
            {selected.size} تذكرة محددة
          </span>
          <div className="flex gap-2 flex-wrap mr-2">
            <button onClick={() => setAssignTarget('bulk')}
              className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
              👤 تعيين مهندس
            </button>
            <button onClick={() => setBulkStatusOpen(true)}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
              🔄 تغيير الحالة
            </button>
            <button onClick={handleBulkDelete}
              className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
              🗑 حذف
            </button>
          </div>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-slate-500 hover:text-slate-700 mr-auto">إلغاء التحديد</button>
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
                <SortTh label="#"          col="id"          sort={sort} onSort={handleSort} className="w-14" />
                <SortTh label="العنوان"    col="title"       sort={sort} onSort={handleSort} />
                <SortTh label="الطالب"     col="requester"   sort={sort} onSort={handleSort} />
                <th className="table-th">القسم</th>
                <SortTh label="الأولوية"   col="priority"    sort={sort} onSort={handleSort} className="w-24" />
                <SortTh label="الحالة"     col="status"      sort={sort} onSort={handleSort} className="w-28" />
                <SortTh label="المهندس"    col="assigned_to" sort={sort} onSort={handleSort} />
                <th className="table-th w-16">المصدر</th>
                <SortTh label="التاريخ"    col="created_at"  sort={sort} onSort={handleSort} className="w-28" />
                <th className="table-th w-36">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={11} className="py-16 text-center">
                  <div className="flex items-center justify-center gap-3 text-slate-400">
                    <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    جاري التحميل...
                  </div>
                </td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={11} className="py-16 text-center text-slate-400">
                  <p className="text-3xl mb-2">🔍</p>
                  <p>لا توجد تذاكر تطابق الفلاتر المحددة</p>
                  {activeFilterCount > 0 && (
                    <button onClick={resetFilters} className="text-yellow-600 hover:underline text-sm mt-2">مسح الفلاتر</button>
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
                      <span className={`badge ${pri.badge} whitespace-nowrap`}>{pri.label}</span>
                    </td>

                    {/* Status */}
                    <td className="table-td">
                      <select value={ticket.status}
                        onChange={e => handleStatus(ticket.id, e.target.value)}
                        className={`text-xs rounded-lg px-2 py-1 border-0 font-medium cursor-pointer ${stat.badge}`}>
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_CFG[s].label}</option>
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
                          <span>⚠️</span> تعيين
                        </button>
                      )}
                    </td>

                    {/* Source */}
                    <td className="table-td text-center">
                      <span title={ticket.source === 'email' ? 'بريد إلكتروني' : 'يدوي'}
                        className={`text-xs px-1.5 py-0.5 rounded-md ${ticket.source === 'email' ? 'bg-purple-50 text-purple-600' : 'bg-slate-50 text-slate-400'}`}>
                        {ticket.source === 'email' ? '📧' : '✋'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="table-td">
                      <span className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(ticket.created_at)}</span>
                    </td>

                    {/* Actions */}
                    <td className="table-td">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/tickets/${ticket.id}`)}
                          title="تفاصيل" className="p-1.5 rounded-lg hover:bg-yellow-100 text-yellow-600 text-sm transition-colors">👁</button>
                        <button onClick={() => setAssignTarget(ticket)}
                          title="تعيين" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 text-sm transition-colors">👤</button>
                        <button onClick={() => handleDelete(ticket.id)}
                          title="حذف" className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 text-sm transition-colors">🗑</button>
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
                {((page - 1) * pageSize + 1).toLocaleString('ar-EG')}–
                {Math.min(page * pageSize, data.total).toLocaleString('ar-EG')} من {data.total.toLocaleString('ar-EG')}
              </span>
              <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1) }}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s} لكل صفحة</option>)}
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
