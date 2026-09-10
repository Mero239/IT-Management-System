import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketsApi, engineersApi } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import api from '../api/client'

// ── Channel definitions ───────────────────────────────────────────────────────

const CHANNELS = [
  { key: 'all',       icon: '📥', color: 'yellow', ar: 'الكل',       en: 'All'       },
  { key: 'telegram',  icon: '✈️', color: 'sky',     ar: 'تيليجرام',   en: 'Telegram'  },
  { key: 'whatsapp',  icon: '💬', color: 'green',   ar: 'واتساب',     en: 'WhatsApp'  },
  { key: 'email',     icon: '✉️', color: 'violet',  ar: 'إيميل',      en: 'Email'     },
  { key: 'manual',    icon: '🖊️', color: 'slate',   ar: 'يدوي',       en: 'Manual'    },
]

const SOURCE_META = {
  telegram: { icon: '✈️', bg: 'bg-sky-100',    text: 'text-sky-700',    border: 'border-sky-200',    label: { ar: 'تيليجرام', en: 'Telegram' } },
  whatsapp: { icon: '💬', bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200',  label: { ar: 'واتساب',   en: 'WhatsApp' } },
  email:    { icon: '✉️', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', label: { ar: 'إيميل',    en: 'Email'    } },
  manual:   { icon: '🖊️', bg: 'bg-slate-100',  text: 'text-slate-600',  border: 'border-slate-200',  label: { ar: 'يدوي',     en: 'Manual'   } },
}

const PRIORITY_STYLE = {
  critical: { badge: 'bg-red-100 text-red-700 border border-red-200',          border: 'border-r-red-500',    label: { ar: 'حرجة',   en: 'Critical' } },
  high:     { badge: 'bg-yellow-100 text-yellow-700 border border-yellow-200', border: 'border-r-yellow-400', label: { ar: 'عالية',  en: 'High'     } },
  medium:   { badge: 'bg-amber-100 text-amber-700 border border-amber-200',    border: 'border-r-amber-300',  label: { ar: 'متوسطة', en: 'Medium'   } },
  low:      { badge: 'bg-slate-100 text-slate-500 border border-slate-200',    border: 'border-r-slate-200',  label: { ar: 'منخفضة', en: 'Low'      } },
}

const STATUS_STYLE = {
  open:        { badge: 'bg-red-50 text-red-600 border border-red-200',             label: { ar: 'مفتوحة',      en: 'Open'        } },
  in_progress: { badge: 'bg-blue-50 text-blue-700 border border-blue-200',          label: { ar: 'قيد التنفيذ', en: 'In Progress' } },
  resolved:    { badge: 'bg-yellow-50 text-yellow-700 border border-yellow-200', label: { ar: 'محلولة',      en: 'Resolved'    } },
  closed:      { badge: 'bg-slate-50 text-slate-500 border border-slate-200',       label: { ar: 'مغلقة',       en: 'Closed'      } },
}

const STATUS_NEXT = {
  open:        { next: 'in_progress', label: { ar: 'بدء التنفيذ', en: 'Start'   } },
  in_progress: { next: 'resolved',    label: { ar: 'تم الحل',     en: 'Resolve' } },
}

function timeAgo(dateStr, language) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr + 'Z')) / 1000
  if (diff < 60)    return language === 'ar' ? 'الآن'                          : 'Just now'
  if (diff < 3600)  return language === 'ar' ? `منذ ${Math.floor(diff/60)} د`  : `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return language === 'ar' ? `منذ ${Math.floor(diff/3600)} س`: `${Math.floor(diff/3600)}h ago`
  return new Date(dateStr + 'Z').toLocaleDateString(
    language === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }
  )
}

// ── Assign modal ──────────────────────────────────────────────────────────────

function AssignModal({ ticket, engineers, onClose, onSave }) {
  const [selected, setSelected] = useState(ticket.assigned_to || '')
  const [saving,   setSaving]   = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">👷</span>
          <h3 className="font-bold text-slate-800 text-sm">تعيين مهندس</h3>
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 line-clamp-2">
          #{ticket.id} · {ticket.title}
        </p>
        <select className="form-select w-full" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">— بدون تعيين —</option>
          {engineers.filter(e => e.active === 'true').map(e => (
            <option key={e.id} value={e.name}>{e.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 !py-2 !text-sm">إلغاء</button>
          <button
            disabled={saving}
            onClick={async () => { setSaving(true); await onSave(ticket.id, selected); setSaving(false); onClose() }}
            className="btn-primary flex-1 !py-2 !text-sm"
          >
            {saving ? '...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Unified ticket card ───────────────────────────────────────────────────────

function TicketCard({ ticket, engineers, onStatusChange, onAssign, language }) {
  const navigate    = useNavigate()
  const isAr        = language === 'ar'
  const src         = SOURCE_META[ticket.source] || SOURCE_META.manual
  const pri         = PRIORITY_STYLE[ticket.priority]  || PRIORITY_STYLE.medium
  const stat        = STATUS_STYLE[ticket.status]      || STATUS_STYLE.open
  const nextAction  = STATUS_NEXT[ticket.status]
  const [updating,   setUpdating]   = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [expanded,   setExpanded]   = useState(false)

  const handleStatus = async () => {
    setUpdating(true)
    await onStatusChange(ticket.id, nextAction.next)
    setUpdating(false)
  }

  // reply link per channel
  const replyLink = (() => {
    if (ticket.source === 'email' && ticket.requester_email)
      return { href: `mailto:${ticket.requester_email}?subject=Re: ${encodeURIComponent(ticket.title)}`, label: isAr ? 'رد' : 'Reply' }
    if (ticket.source === 'whatsapp') {
      const raw = ticket.requester_email?.startsWith('wa:')
        ? ticket.requester_email.slice(3)
        : ''
      if (raw) return { href: `https://wa.me/${raw.replace(/\D/g,'')}`, label: isAr ? 'رد' : 'Reply' }
    }
    return null
  })()

  const preview = ticket.description
    ? ticket.description.replace(/\n+/g,' ').slice(0, 100) + (ticket.description.length > 100 ? '…' : '')
    : ''

  const isActive = ['open','in_progress'].includes(ticket.status)

  return (
    <>
      {assignOpen && (
        <AssignModal ticket={ticket} engineers={engineers}
          onClose={() => setAssignOpen(false)} onSave={onAssign} />
      )}

      <div className={`card !p-0 overflow-hidden border-r-4 ${
        ticket.priority === 'critical' && isActive ? 'border-r-red-500'
        : ticket.priority === 'high'   && isActive ? 'border-r-yellow-400'
        : ticket.priority === 'medium'             ? 'border-r-amber-300'
        : 'border-r-slate-200'
      }`}>

        {/* Main row */}
        <div className="flex items-start gap-3 p-4 pb-2">
          {/* Source icon */}
          <div className={`w-9 h-9 rounded-xl ${src.bg} flex items-center justify-center text-base flex-shrink-0 mt-0.5`}>
            {src.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <button
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className="font-semibold text-slate-800 hover:text-yellow-600 text-sm text-start leading-snug flex-1"
              >
                {ticket.title}
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-slate-400">{timeAgo(ticket.created_at, language)}</span>
                <span className="text-xs text-slate-300 font-mono">#{ticket.id}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {ticket.requester_name && (
                <span className="text-xs text-slate-500">👤 {ticket.requester_name}</span>
              )}
              {ticket.requester_email && !ticket.requester_email.startsWith('wa:') && (
                <span className="text-xs text-slate-400 font-mono truncate max-w-[180px]">
                  {ticket.requester_email}
                </span>
              )}
            </div>

            {/* Preview (email/description) */}
            {!expanded && preview && ticket.source === 'email' && (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-slate-400 mt-1 line-clamp-1 text-start hover:text-slate-600 w-full"
              >
                {preview}
              </button>
            )}
          </div>
        </div>

        {/* Expanded email body */}
        {expanded && ticket.description && (
          <div className="mx-4 mb-2">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                {ticket.description}
              </p>
            </div>
            <button onClick={() => setExpanded(false)} className="text-[10px] text-slate-400 mt-1 hover:text-slate-600">
              {isAr ? '▲ إخفاء' : '▲ Collapse'}
            </button>
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap px-4 pb-2">
          {/* Source badge */}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${src.bg} ${src.text} border ${src.border}`}>
            {src.icon} {src.label[language] || src.label.ar}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${stat.badge}`}>
            {stat.label[language] || stat.label.ar}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pri.badge}`}>
            {pri.label[language] || pri.label.ar}
          </span>
          {ticket.department?.name && (
            <span className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
              🏢 {ticket.department.name}
            </span>
          )}
          {ticket.assigned_to ? (
            <button onClick={() => setAssignOpen(true)}
              className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-100 px-2 py-0.5 rounded-full hover:bg-yellow-100 transition-colors">
              👷 {ticket.assigned_to}
            </button>
          ) : (
            <button onClick={() => setAssignOpen(true)}
              className="text-[11px] text-slate-400 bg-slate-50 border border-dashed border-slate-300 px-2 py-0.5 rounded-full hover:border-yellow-400 hover:text-yellow-600 transition-colors">
              + {isAr ? 'تعيين' : 'Assign'}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 px-4 pb-4 flex-wrap">
          {nextAction && (
            <button onClick={handleStatus} disabled={updating}
              className="btn-success !text-xs !py-1.5 !px-3 disabled:opacity-50">
              {updating ? '...' : nextAction.label[language] || nextAction.label.ar}
            </button>
          )}
          <button onClick={() => navigate(`/tickets/${ticket.id}`)}
            className="btn-secondary !text-xs !py-1.5 !px-3">
            {isAr ? 'التفاصيل' : 'Details'}
          </button>
          {replyLink && (
            <a href={replyLink.href} target="_blank" rel="noreferrer"
              className="btn-secondary !text-xs !py-1.5 !px-3">
              ↩️ {replyLink.label}
            </a>
          )}
          <button onClick={() => navigate(`/tickets/${ticket.id}/print`)}
            className="btn-secondary !text-xs !py-1.5 !px-3">
            🖨️
          </button>
        </div>
      </div>
    </>
  )
}

// ── Channel tab button ────────────────────────────────────────────────────────

function ChannelTab({ ch, active, count, unread, onClick, language }) {
  const isAr = language === 'ar'
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 px-4 py-3 rounded-2xl text-xs font-medium transition-all border-2 ${
        active
          ? 'border-yellow-500 bg-yellow-50 text-yellow-700 shadow-sm'
          : 'border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span className="text-xl">{ch.icon}</span>
      <span>{isAr ? ch.ar : ch.en}</span>
      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
        active ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'
      }`}>{count}</span>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}

// ── Sort option ───────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { key: 'newest',   ar: 'الأحدث',   en: 'Newest'   },
  { key: 'oldest',   ar: 'الأقدم',   en: 'Oldest'   },
  { key: 'priority', ar: 'الأولوية', en: 'Priority'  },
]
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChannelsInbox() {
  const navigate     = useNavigate()
  const { language } = useLanguage()
  const isAr         = language === 'ar'

  const [tickets,   setTickets]   = useState([])
  const [engineers, setEngineers] = useState([])
  const [botStatus, setBotStatus] = useState(null)
  const [agentStatus, setAgentStatus] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Filters
  const [channel,        setChannel]        = useState('all')
  const [statusFilter,   setStatusFilter]   = useState('active')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search,         setSearch]         = useState('')
  const [sortBy,         setSortBy]         = useState('newest')

  const prevCountRef = useRef({})

  const load = useCallback(async () => {
    try {
      const [tRes, eRes] = await Promise.all([
        ticketsApi.adminLog({ page_size: 1000 }),
        engineersApi.list(),
      ])
      const all = tRes.data.items || []
      setTickets(all)
      setEngineers(eRes.data)
      setLastUpdate(new Date())
    } finally { setLoading(false) }
  }, [])

  const loadStatuses = useCallback(async () => {
    try {
      const [botRes, agentRes] = await Promise.all([
        fetch('http://localhost:8000/api/channels/telegram/status', {
          headers: { Authorization: `Bearer ${localStorage.getItem('it_token') || ''}` }
        }).then(r => r.ok ? r.json() : null),
        api.get('/email-agent/status').then(r => r.data).catch(() => null),
      ])
      setBotStatus(botRes)
      setAgentStatus(agentRes)
    } catch {}
  }, [])

  useEffect(() => { load(); loadStatuses() }, [load, loadStatuses])
  useEffect(() => {
    const id = setInterval(() => { load(); loadStatuses() }, 30000)
    return () => clearInterval(id)
  }, [load, loadStatuses])

  const handleStatusChange = async (id, next) => {
    await ticketsApi.updateStatus(id, next)
    await load()
  }
  const handleAssign = async (id, name) => {
    await ticketsApi.assign(id, name)
    await load()
  }

  // ── Counts per channel ───────────────────────────────────────────────────
  const countBySource = (src) => {
    if (src === 'all') return tickets.length
    if (src === 'manual') return tickets.filter(t => !t.source || t.source === 'manual').length
    return tickets.filter(t => t.source === src).length
  }

  const unreadBySource = (src) => {
    const base = src === 'all' ? tickets
      : src === 'manual' ? tickets.filter(t => !t.source || t.source === 'manual')
      : tickets.filter(t => t.source === src)
    return base.filter(t => t.status === 'open').length
  }

  // ── Global stats ─────────────────────────────────────────────────────────
  const stats = {
    open:        tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved:    tickets.filter(t => ['resolved','closed'].includes(t.status)).length,
    total:       tickets.length,
  }

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = tickets
    .filter(t => {
      // channel
      if (channel !== 'all') {
        if (channel === 'manual') { if (t.source && t.source !== 'manual') return false }
        else { if (t.source !== channel) return false }
      }
      // status
      if (statusFilter === 'active') { if (!['open','in_progress'].includes(t.status)) return false }
      else if (statusFilter !== 'all') { if (t.status !== statusFilter) return false }
      // priority
      if (priorityFilter && t.priority !== priorityFilter) return false
      // search
      if (search) {
        const q = search.toLowerCase()
        if (!t.title?.toLowerCase().includes(q) &&
            !t.requester_name?.toLowerCase().includes(q) &&
            !t.requester_email?.toLowerCase().includes(q) &&
            !String(t.id).includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'newest')   return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'oldest')   return new Date(a.created_at) - new Date(b.created_at)
      if (sortBy === 'priority') {
        const pa = PRIORITY_ORDER[a.priority] ?? 9
        const pb = PRIORITY_ORDER[b.priority] ?? 9
        return pa !== pb ? pa - pb : new Date(b.created_at) - new Date(a.created_at)
      }
      return 0
    })

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isAr ? '📥 صندوق التذاكر الموحد' : '📥 Unified Channels Inbox'}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {isAr ? 'جميع التذاكر من كل القنوات في مكان واحد' : 'All tickets from every channel in one place'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Channel live indicators */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
            <span title="Telegram" className={`w-2 h-2 rounded-full ${botStatus?.running ? 'bg-yellow-400 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-[11px] text-slate-500">TG</span>
            <span className="text-slate-200">|</span>
            <span title="Email" className={`w-2 h-2 rounded-full ${agentStatus?.running ? 'bg-yellow-400 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-[11px] text-slate-500">Email</span>
          </div>
          {lastUpdate && (
            <span className="text-[11px] text-slate-400">
              {isAr ? `آخر تحديث: ${lastUpdate.toLocaleTimeString('ar-EG', {hour:'2-digit',minute:'2-digit'})}` : `Updated ${lastUpdate.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}`}
            </span>
          )}
          <button onClick={() => { load(); loadStatuses() }} className="btn-secondary !py-1.5 !px-3 !text-xs">🔄</button>
        </div>
      </div>

      {/* ── Global stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: '🔴', label: isAr ? 'مفتوحة'         : 'Open',        value: stats.open,        color: 'border-red-400',     pulse: true },
          { icon: '⚡', label: isAr ? 'قيد التنفيذ'    : 'In Progress', value: stats.in_progress, color: 'border-blue-400' },
          { icon: '✅', label: isAr ? 'محلولة / مغلقة' : 'Resolved',   value: stats.resolved,    color: 'border-yellow-400' },
          { icon: '📥', label: isAr ? 'إجمالي الكل'    : 'Total',      value: stats.total,       color: 'border-slate-300' },
        ].map(s => (
          <div key={s.label} className={`card !p-4 flex items-center gap-3 border-r-4 ${s.color}`}>
            <div className="text-2xl relative">
              {s.icon}
              {s.pulse && s.value > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Channel tabs ── */}
      <div className="grid grid-cols-5 gap-2">
        {CHANNELS.map(ch => (
          <ChannelTab
            key={ch.key}
            ch={ch}
            active={channel === ch.key}
            count={countBySource(ch.key)}
            unread={unreadBySource(ch.key)}
            onClick={() => setChannel(ch.key)}
            language={language}
          />
        ))}
      </div>

      {/* ── Filters bar ── */}
      <div className="card !p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {/* Search */}
          <input
            className="form-input !text-sm flex-1 min-w-48"
            placeholder={isAr ? 'بحث في العنوان، الاسم، البريد...' : 'Search title, name, email...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {/* Sort */}
          <select
            className="form-select !text-sm w-auto"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map(s => (
              <option key={s.key} value={s.key}>{isAr ? s.ar : s.en}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* Status pills */}
          <div className="flex gap-1 flex-wrap">
            {[
              { key: 'active',      ar: '🔥 النشطة',      en: '🔥 Active'      },
              { key: 'all',         ar: 'الكل',            en: 'All'            },
              { key: 'open',        ar: 'مفتوحة',          en: 'Open'           },
              { key: 'in_progress', ar: 'قيد التنفيذ',     en: 'In Progress'    },
              { key: 'resolved',    ar: 'محلولة',          en: 'Resolved'       },
              { key: 'closed',      ar: 'مغلقة',           en: 'Closed'         },
            ].map(s => (
              <button key={s.key} onClick={() => setStatusFilter(s.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  statusFilter === s.key
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                    : 'border-slate-100 text-slate-500 hover:border-slate-300'
                }`}
              >{isAr ? s.ar : s.en}</button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden md:block" />

          {/* Priority pills */}
          <div className="flex gap-1 flex-wrap">
            {[
              { key: '',         ar: 'كل الأولويات', en: 'All'      },
              { key: 'critical', ar: '🔴',            en: '🔴 Crit'  },
              { key: 'high',     ar: '🟠',            en: '🟠 High'  },
              { key: 'medium',   ar: '🟡',            en: '🟡 Med'   },
              { key: 'low',      ar: '⚪',            en: '⚪ Low'   },
            ].map(p => (
              <button key={p.key} onClick={() => setPriorityFilter(p.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  priorityFilter === p.key
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                    : 'border-slate-100 text-slate-400 hover:border-slate-300'
                }`}
              >{isAr ? p.ar : p.en}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Results count ── */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          {isAr
            ? `${filtered.length} تذكرة من أصل ${tickets.length}`
            : `${filtered.length} of ${tickets.length} tickets`}
        </span>
        {(search || priorityFilter || statusFilter !== 'active' || channel !== 'all') && (
          <button
            onClick={() => { setSearch(''); setPriorityFilter(''); setStatusFilter('active'); setChannel('all') }}
            className="text-yellow-600 hover:underline font-medium"
          >
            {isAr ? '× مسح الكل' : '× Clear all'}
          </button>
        )}
      </div>

      {/* ── Ticket list ── */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="text-5xl mb-3 animate-pulse">📥</div>
          <p className="text-slate-400 text-sm">{isAr ? 'جاري تحميل جميع القنوات...' : 'Loading all channels...'}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <p className="text-5xl">📭</p>
          <p className="text-slate-600 font-semibold">
            {isAr ? 'لا توجد تذاكر مطابقة' : 'No matching tickets'}
          </p>
          <p className="text-slate-400 text-sm">
            {isAr ? 'جرب تغيير الفلاتر أو القناة' : 'Try changing the filters or channel'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              engineers={engineers}
              onStatusChange={handleStatusChange}
              onAssign={handleAssign}
              language={language}
            />
          ))}
        </div>
      )}
    </div>
  )
}
