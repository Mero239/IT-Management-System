import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketsApi, engineersApi } from '../api/client'
import { useLanguage } from '../context/LanguageContext'

const PRIORITY_STYLE = {
  critical: { badge: 'bg-red-100 text-red-700 border border-red-200',    dot: 'bg-red-500',    label: { ar: 'حرجة',    en: 'Critical' } },
  high:     { badge: 'bg-yellow-100 text-yellow-700 border border-yellow-200', dot: 'bg-yellow-500', label: { ar: 'عالية',   en: 'High' } },
  medium:   { badge: 'bg-amber-100 text-amber-700 border border-amber-200',   dot: 'bg-amber-400',  label: { ar: 'متوسطة',  en: 'Medium' } },
  low:      { badge: 'bg-slate-100 text-slate-500 border border-slate-200',   dot: 'bg-slate-300',  label: { ar: 'منخفضة',  en: 'Low' } },
}

const STATUS_STYLE = {
  open:        { badge: 'bg-red-50 text-red-600 border border-red-200',           label: { ar: 'مفتوحة',         en: 'Open' } },
  in_progress: { badge: 'bg-blue-50 text-blue-700 border border-blue-200',        label: { ar: 'قيد التنفيذ',    en: 'In Progress' } },
  resolved:    { badge: 'bg-yellow-50 text-yellow-700 border border-yellow-200', label: { ar: 'محلولة',        en: 'Resolved' } },
  closed:      { badge: 'bg-slate-50 text-slate-500 border border-slate-200',     label: { ar: 'مغلقة',          en: 'Closed' } },
}

const STATUS_NEXT = {
  open:        { next: 'in_progress', label: { ar: 'بدء التنفيذ',  en: 'Start' } },
  in_progress: { next: 'resolved',    label: { ar: 'تم الحل',      en: 'Resolve' } },
}

function timeAgo(dateStr, language) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr + 'Z')) / 1000
  if (diff < 60)    return language === 'ar' ? 'الآن' : 'Just now'
  if (diff < 3600)  return language === 'ar' ? `منذ ${Math.floor(diff / 60)} د` : `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return language === 'ar' ? `منذ ${Math.floor(diff / 3600)} س` : `${Math.floor(diff / 3600)}h ago`
  return new Date(dateStr + 'Z').toLocaleDateString(
    language === 'ar' ? 'ar-EG' : 'en-GB',
    { day: 'numeric', month: 'short' }
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, pulse }) {
  return (
    <div className={`card !p-4 flex items-center gap-4 border-r-4 ${color}`}>
      <div className="text-3xl relative">
        {icon}
        {pulse && value > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

// ── Assign modal ──────────────────────────────────────────────────────────────
function AssignModal({ ticket, engineers, onClose, onSave }) {
  const [selected, setSelected] = useState(ticket.assigned_to || '')
  const [saving, setSaving] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👷</span>
          <h3 className="font-bold text-slate-800">تعيين مهندس</h3>
        </div>
        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3 line-clamp-2">#{ticket.id} · {ticket.title}</p>
        <select
          className="form-select w-full"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          <option value="">— بدون تعيين —</option>
          {engineers.filter(e => e.active === 'true').map(e => (
            <option key={e.id} value={e.name}>{e.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 !py-2">إلغاء</button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              await onSave(ticket.id, selected)
              setSaving(false)
              onClose()
            }}
            className="btn-primary flex-1 !py-2"
          >
            {saving ? '...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ticket row card ───────────────────────────────────────────────────────────
function TicketCard({ ticket, engineers, onStatusChange, onAssign, language }) {
  const navigate   = useNavigate()
  const pri        = PRIORITY_STYLE[ticket.priority]  || PRIORITY_STYLE.medium
  const stat       = STATUS_STYLE[ticket.status]      || STATUS_STYLE.open
  const nextAction = STATUS_NEXT[ticket.status]
  const [updating, setUpdating] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  const handleStatus = async () => {
    if (!nextAction) return
    setUpdating(true)
    await onStatusChange(ticket.id, nextAction.next)
    setUpdating(false)
  }

  return (
    <>
      {assignOpen && (
        <AssignModal
          ticket={ticket}
          engineers={engineers}
          onClose={() => setAssignOpen(false)}
          onSave={onAssign}
        />
      )}
      <div className={`card !p-0 overflow-hidden border-r-4 ${
        ticket.priority === 'critical' && !['resolved','closed'].includes(ticket.status)
          ? 'border-red-500'
          : ticket.priority === 'high' ? 'border-yellow-400'
          : ticket.priority === 'medium' ? 'border-amber-300'
          : 'border-slate-200'
      }`}>
        {/* Header row */}
        <div className="flex items-start gap-3 p-4 pb-3">
          {/* Telegram avatar */}
          <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
            ✈️
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <button
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className="font-semibold text-slate-800 hover:text-yellow-600 text-sm text-start leading-snug"
              >
                {ticket.title}
              </button>
              <span className="text-xs text-slate-400 font-mono flex-shrink-0">#{ticket.id}</span>
            </div>

            {/* Requester */}
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <span>👤</span> {ticket.requester_name || '—'}
              <span className="text-slate-300 mx-1">·</span>
              <span>{timeAgo(ticket.created_at, language)}</span>
            </p>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap px-4 pb-3">
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
            <button
              onClick={() => setAssignOpen(true)}
              className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-100 px-2 py-0.5 rounded-full hover:bg-yellow-100 transition-colors"
            >
              👷 {ticket.assigned_to}
            </button>
          ) : (
            <button
              onClick={() => setAssignOpen(true)}
              className="text-[11px] text-slate-400 bg-slate-50 border border-dashed border-slate-300 px-2 py-0.5 rounded-full hover:border-yellow-400 hover:text-yellow-600 transition-colors"
            >
              + تعيين
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 px-4 pb-4">
          {nextAction && (
            <button
              onClick={handleStatus}
              disabled={updating}
              className="btn-success !text-xs !py-1.5 !px-3 disabled:opacity-50 flex-shrink-0"
            >
              {updating ? '...' : nextAction.label[language] || nextAction.label.ar}
            </button>
          )}
          <button
            onClick={() => navigate(`/tickets/${ticket.id}`)}
            className="btn-secondary !text-xs !py-1.5 !px-3 flex-shrink-0"
          >
            {language === 'ar' ? 'التفاصيل' : 'Details'}
          </button>
          <button
            onClick={() => navigate(`/tickets/${ticket.id}/print`)}
            className="btn-secondary !text-xs !py-1.5 !px-3 flex-shrink-0"
          >
            🖨️
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TelegramTickets() {
  const navigate = useNavigate()
  const { language } = useLanguage()

  const [tickets,   setTickets]   = useState([])
  const [engineers, setEngineers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [stats,     setStats]     = useState({ open: 0, in_progress: 0, resolved: 0, total: 0 })
  const [botStatus, setBotStatus] = useState(null)

  // Filters
  const [statusFilter,   setStatusFilter]   = useState('active')  // active | all | open | in_progress | resolved | closed
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search,         setSearch]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, eRes] = await Promise.all([
        ticketsApi.adminLog({ source: 'telegram', page_size: 1000 }),
        engineersApi.list(),
      ])
      const all = tRes.data.items || []
      setTickets(all)
      setEngineers(eRes.data)
      setStats({
        open:        all.filter(t => t.status === 'open').length,
        in_progress: all.filter(t => t.status === 'in_progress').length,
        resolved:    all.filter(t => ['resolved','closed'].includes(t.status)).length,
        total:       all.length,
      })
    } finally { setLoading(false) }
  }, [])

  const loadBotStatus = useCallback(async () => {
    try {
      const r = await fetch('http://localhost:8000/api/channels/telegram/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('it_token') || ''}` }
      })
      if (r.ok) setBotStatus(await r.json())
    } catch {}
  }, [])

  useEffect(() => { load(); loadBotStatus() }, [load, loadBotStatus])

  // auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => { load(); loadBotStatus() }, 30000)
    return () => clearInterval(id)
  }, [load, loadBotStatus])

  const handleStatusChange = async (id, nextStatus) => {
    await ticketsApi.updateStatus(id, nextStatus)
    await load()
  }

  const handleAssign = async (id, engineer_name) => {
    await ticketsApi.assign(id, engineer_name)
    await load()
  }

  // Filter logic
  const filtered = tickets.filter(t => {
    if (statusFilter === 'active')   { if (!['open','in_progress'].includes(t.status)) return false }
    else if (statusFilter !== 'all') { if (t.status !== statusFilter) return false }
    if (priorityFilter && t.priority !== priorityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.title?.toLowerCase().includes(q) && !t.requester_name?.toLowerCase().includes(q) && !String(t.id).includes(q)) return false
    }
    return true
  })

  const isAr = language === 'ar'

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center text-2xl">✈️</div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {isAr ? 'تذاكر تيليجرام' : 'Telegram Tickets'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {botStatus?.running ? (
                <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                  <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                  @{botStatus.bot_username} · {isAr ? 'يعمل' : 'Active'}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                  {isAr ? 'البوت متوقف' : 'Bot offline'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/admin/channels')}
            className="btn-secondary !py-1.5 !text-xs"
          >
            ⚙️ {isAr ? 'إعدادات البوت' : 'Bot Settings'}
          </button>
          <button onClick={load} className="btn-secondary !py-1.5 !px-3 !text-xs">🔄</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🔴" label={isAr ? 'مفتوحة'         : 'Open'}       value={stats.open}        color="border-red-400"     pulse />
        <StatCard icon="⚡" label={isAr ? 'قيد التنفيذ'    : 'In Progress'} value={stats.in_progress} color="border-blue-400" />
        <StatCard icon="✅" label={isAr ? 'محلولة / مغلقة' : 'Resolved'}   value={stats.resolved}    color="border-yellow-400" />
        <StatCard icon="✈️" label={isAr ? 'إجمالي تيليجرام' : 'Total'}     value={stats.total}       color="border-sky-300" />
      </div>

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        {/* Search */}
        <input
          className="form-input !text-sm"
          placeholder={isAr ? 'بحث برقم التذكرة، العنوان، أو اسم المرسل...' : 'Search by ticket #, title, or requester...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Status filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'active',      ar: 'النشطة',         en: 'Active' },
            { key: 'all',         ar: 'الكل',            en: 'All' },
            { key: 'open',        ar: 'مفتوحة',          en: 'Open' },
            { key: 'in_progress', ar: 'قيد التنفيذ',     en: 'In Progress' },
            { key: 'resolved',    ar: 'محلولة',          en: 'Resolved' },
            { key: 'closed',      ar: 'مغلقة',           en: 'Closed' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                statusFilter === s.key
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                  : 'border-slate-100 text-slate-500 hover:border-slate-300'
              }`}
            >
              {isAr ? s.ar : s.en}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: '', ar: 'كل الأولويات', en: 'All Priorities' },
            { key: 'critical', ar: '🔴 حرجة',    en: '🔴 Critical' },
            { key: 'high',     ar: '🟠 عالية',    en: '🟠 High' },
            { key: 'medium',   ar: '🟡 متوسطة',   en: '🟡 Medium' },
            { key: 'low',      ar: '⚪ منخفضة',   en: '⚪ Low' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPriorityFilter(p.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                priorityFilter === p.key
                  ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                  : 'border-slate-100 text-slate-400 hover:border-slate-300'
              }`}
            >
              {isAr ? p.ar : p.en}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          {isAr
            ? `${filtered.length} تذكرة من أصل ${tickets.length}`
            : `${filtered.length} of ${tickets.length} tickets`}
        </span>
        {(search || priorityFilter || statusFilter !== 'active') && (
          <button
            onClick={() => { setSearch(''); setPriorityFilter(''); setStatusFilter('active') }}
            className="text-yellow-600 hover:underline"
          >
            {isAr ? '× مسح الفلاتر' : '× Clear filters'}
          </button>
        )}
      </div>

      {/* Tickets */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3 animate-pulse">✈️</div>
          <p className="text-slate-400 text-sm">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-5xl mb-4">✈️</p>
          <p className="text-slate-600 font-semibold text-lg">
            {tickets.length === 0
              ? (isAr ? 'لا توجد تذاكر من تيليجرام بعد' : 'No Telegram tickets yet')
              : (isAr ? 'لا توجد نتائج مطابقة' : 'No matching tickets')}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {tickets.length === 0
              ? (isAr ? 'عندما يرسل مستخدم رسالة للبوت، ستظهر التذكرة هنا' : 'When a user messages the bot, their ticket will appear here')
              : (isAr ? 'جرب تغيير الفلاتر' : 'Try changing the filters')}
          </p>
          {tickets.length === 0 && botStatus?.bot_username && (
            <a
              href={`https://t.me/${botStatus.bot_username}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 mt-4 btn-primary !py-2 !px-5 !text-sm"
            >
              ✈️ {isAr ? 'فتح البوت وتجربته' : 'Open bot & test it'}
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
