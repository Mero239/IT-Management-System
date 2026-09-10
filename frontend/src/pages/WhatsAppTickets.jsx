import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketsApi, engineersApi, departmentsApi } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import StatCard from '../components/StatCardCompact'

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_STYLE = {
  critical: { badge: 'bg-red-100 text-red-700 border border-red-200',          dot: 'bg-red-500',    label: { ar: 'حرجة',    en: 'Critical' } },
  high:     { badge: 'bg-yellow-100 text-yellow-700 border border-yellow-200', dot: 'bg-yellow-500', label: { ar: 'عالية',   en: 'High'     } },
  medium:   { badge: 'bg-amber-100 text-amber-700 border border-amber-200',    dot: 'bg-amber-400',  label: { ar: 'متوسطة',  en: 'Medium'   } },
  low:      { badge: 'bg-slate-100 text-slate-500 border border-slate-200',    dot: 'bg-slate-300',  label: { ar: 'منخفضة',  en: 'Low'      } },
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

const EMPTY_FORM = {
  title: '', requester_name: '', requester_phone: '',
  description: '', priority: 'medium', department_id: '', assigned_to: '',
}

function timeAgo(dateStr, language) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr + 'Z')) / 1000
  if (diff < 60)    return language === 'ar' ? 'الآن' : 'Just now'
  if (diff < 3600)  return language === 'ar' ? `منذ ${Math.floor(diff/60)} د`    : `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return language === 'ar' ? `منذ ${Math.floor(diff/3600)} س`  : `${Math.floor(diff/3600)}h ago`
  return new Date(dateStr + 'Z').toLocaleDateString(
    language === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

// ── New ticket modal ──────────────────────────────────────────────────────────

function NewTicketModal({ departments, engineers, waConfig, onClose, onCreated, language }) {
  const isAr = language === 'ar'
  const [form, setForm]   = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.title.trim()) { setError(isAr ? 'العنوان مطلوب' : 'Title is required'); return }
    setSaving(true)
    try {
      const payload = {
        title:          form.title,
        requester_name: form.requester_name || (isAr ? 'مستخدم واتساب' : 'WhatsApp User'),
        requester_email: form.requester_phone
          ? `wa:${form.requester_phone.replace(/\D/g,'')}`
          : '',
        description:    form.description,
        priority:       form.priority,
        department_id:  form.department_id ? Number(form.department_id) : null,
        assigned_to:    form.assigned_to || null,
        source:         'whatsapp',
        status:         'open',
      }
      const res = await ticketsApi.create(payload)
      onCreated(res.data)
    } catch (e) {
      setError(isAr ? 'حدث خطأ، حاول مرة أخرى' : 'Error, please try again')
    } finally { setSaving(false) }
  }

  const waPhone   = waConfig?.whatsapp_phone?.replace(/\D/g,'') || ''
  const waMessage = encodeURIComponent((isAr ? waConfig?.whatsapp_message_ar : waConfig?.whatsapp_message_en) || '')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <h3 className="font-bold text-slate-800 text-sm">
              {isAr ? 'تذكرة جديدة من واتساب' : 'New WhatsApp Ticket'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* WhatsApp open link */}
          {waPhone && (
            <a
              href={`https://wa.me/${waPhone}?text=${waMessage}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 hover:bg-green-100 transition-colors"
            >
              <span className="text-2xl">💬</span>
              <div>
                <p className="text-sm font-semibold text-green-800">
                  {isAr ? 'فتح محادثة واتساب' : 'Open WhatsApp chat'}
                </p>
                <p className="text-xs text-green-600 font-mono">+{waPhone}</p>
              </div>
              <span className="mr-auto text-green-500">←</span>
            </a>
          )}

          {/* Title */}
          <div>
            <label className="form-label">{isAr ? 'عنوان المشكلة *' : 'Issue Title *'}</label>
            <input
              className={`form-input ${error && !form.title ? 'border-red-400' : ''}`}
              placeholder={isAr ? 'مثال: مشكلة في الشبكة' : 'e.g. Network issue'}
              value={form.title}
              onChange={e => { set('title', e.target.value); setError('') }}
            />
          </div>

          {/* Requester */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{isAr ? 'اسم المرسل' : 'Requester Name'}</label>
              <input
                className="form-input"
                placeholder={isAr ? 'اسم المستخدم' : 'User name'}
                value={form.requester_name}
                onChange={e => set('requester_name', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">{isAr ? 'رقم واتساب' : 'WhatsApp Number'}</label>
              <input
                className="form-input font-mono"
                placeholder="+966501234567"
                value={form.requester_phone}
                onChange={e => set('requester_phone', e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="form-label">{isAr ? 'الأولوية' : 'Priority'}</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { v: 'low',      ar: '⚪ منخفضة',  en: '⚪ Low' },
                { v: 'medium',   ar: '🟡 متوسطة',   en: '🟡 Medium' },
                { v: 'high',     ar: '🟠 عالية',    en: '🟠 High' },
                { v: 'critical', ar: '🔴 حرجة',     en: '🔴 Critical' },
              ].map(p => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => set('priority', p.v)}
                  className={`py-2 rounded-xl text-xs font-medium border-2 transition-all ${
                    form.priority === p.v
                      ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                      : 'border-slate-100 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {isAr ? p.ar : p.en}
                </button>
              ))}
            </div>
          </div>

          {/* Department + Assign */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">{isAr ? 'القسم' : 'Department'}</label>
              <select className="form-select" value={form.department_id} onChange={e => set('department_id', e.target.value)}>
                <option value="">{isAr ? '— بدون قسم —' : '— None —'}</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">{isAr ? 'تعيين إلى' : 'Assign To'}</label>
              <select className="form-select" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                <option value="">{isAr ? '— بدون تعيين —' : '— Unassigned —'}</option>
                {engineers.filter(e => e.active === 'true').map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="form-label">{isAr ? 'وصف المشكلة' : 'Description'}</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder={isAr ? 'انسخ رسالة المستخدم من واتساب هنا...' : 'Paste the WhatsApp message here...'}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {error && <p className="text-red-500 text-xs">⚠️ {error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 !py-2.5">
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button onClick={submit} disabled={saving} className="btn-primary flex-1 !py-2.5 gap-2 disabled:opacity-40">
              💬 {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'رفع التذكرة' : 'Create Ticket')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Assign popover ────────────────────────────────────────────────────────────

function AssignModal({ ticket, engineers, onClose, onSave }) {
  const [selected, setSelected] = useState(ticket.assigned_to || '')
  const [saving, setSaving]     = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">👷</span>
          <h3 className="font-bold text-slate-800 text-sm">تعيين مهندس</h3>
        </div>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 line-clamp-2">#{ticket.id} · {ticket.title}</p>
        <select className="form-select w-full" value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">— بدون تعيين —</option>
          {engineers.filter(e => e.active === 'true').map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
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

// ── Ticket card ───────────────────────────────────────────────────────────────

function TicketCard({ ticket, engineers, waPhone, onStatusChange, onAssign, language }) {
  const navigate    = useNavigate()
  const isAr        = language === 'ar'
  const pri         = PRIORITY_STYLE[ticket.priority]  || PRIORITY_STYLE.medium
  const stat        = STATUS_STYLE[ticket.status]      || STATUS_STYLE.open
  const nextAction  = STATUS_NEXT[ticket.status]
  const [updating, setUpdating]   = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  // extract phone from requester_email if stored as wa:+966...
  const rawEmail   = ticket.requester_email || ''
  const waNumber   = rawEmail.startsWith('wa:') ? rawEmail.slice(3) : ''
  const chatPhone  = waNumber || waPhone

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
          ticket={ticket} engineers={engineers}
          onClose={() => setAssignOpen(false)} onSave={onAssign}
        />
      )}
      <div className={`card !p-0 overflow-hidden border-r-4 ${
        ticket.priority === 'critical' && !['resolved','closed'].includes(ticket.status)
          ? 'border-red-500'
          : ticket.priority === 'high'   ? 'border-yellow-400'
          : ticket.priority === 'medium' ? 'border-amber-300'
          : 'border-slate-200'
      }`}>
        {/* Main row */}
        <div className="flex items-start gap-3 p-4 pb-2">
          {/* WA avatar */}
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
            💬
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

            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <span>👤</span> {ticket.requester_name || '—'}
              </p>
              {waNumber && (
                <a
                  href={`https://wa.me/${waNumber}`}
                  target="_blank" rel="noreferrer"
                  className="text-xs text-green-600 font-mono hover:underline flex items-center gap-0.5"
                >
                  💬 {waNumber}
                </a>
              )}
              <span className="text-xs text-slate-400">{timeAgo(ticket.created_at, language)}</span>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap px-4 pb-2">
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
          {chatPhone && (
            <a
              href={`https://wa.me/${chatPhone.replace(/\D/g,'')}`}
              target="_blank" rel="noreferrer"
              className="btn-secondary !text-xs !py-1.5 !px-3 bg-green-50 !text-green-700 border-green-200 hover:bg-green-100"
            >
              💬 {isAr ? 'رد' : 'Reply'}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WhatsAppTickets() {
  const navigate    = useNavigate()
  const { language } = useLanguage()
  const isAr        = language === 'ar'

  const [tickets,     setTickets]     = useState([])
  const [engineers,   setEngineers]   = useState([])
  const [departments, setDepartments] = useState([])
  const [waConfig,    setWaConfig]    = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [showNew,     setShowNew]     = useState(false)
  const [stats,       setStats]       = useState({ open: 0, in_progress: 0, resolved: 0, total: 0 })

  // Filters
  const [statusFilter,   setStatusFilter]   = useState('active')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search,         setSearch]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, eRes, dRes] = await Promise.all([
        ticketsApi.adminLog({ source: 'whatsapp', page_size: 1000 }),
        engineersApi.list(),
        departmentsApi.list(),
      ])
      const all = tRes.data.items || []
      setTickets(all)
      setEngineers(eRes.data)
      setDepartments(dRes.data)
      setStats({
        open:        all.filter(t => t.status === 'open').length,
        in_progress: all.filter(t => t.status === 'in_progress').length,
        resolved:    all.filter(t => ['resolved','closed'].includes(t.status)).length,
        total:       all.length,
      })
    } finally { setLoading(false) }
  }, [])

  const loadWaConfig = useCallback(async () => {
    try {
      const r = await fetch('http://localhost:8000/api/channels/public')
      if (r.ok) setWaConfig(await r.json())
    } catch {}
  }, [])

  useEffect(() => { load(); loadWaConfig() }, [load, loadWaConfig])
  useEffect(() => {
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const handleStatusChange = async (id, next) => {
    await ticketsApi.updateStatus(id, next)
    await load()
  }

  const handleAssign = async (id, engineer_name) => {
    await ticketsApi.assign(id, engineer_name)
    await load()
  }

  const handleCreated = async () => {
    setShowNew(false)
    await load()
  }

  // Filter logic
  const filtered = tickets.filter(t => {
    if (statusFilter === 'active') { if (!['open','in_progress'].includes(t.status)) return false }
    else if (statusFilter !== 'all') { if (t.status !== statusFilter) return false }
    if (priorityFilter && t.priority !== priorityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.title?.toLowerCase().includes(q) &&
          !t.requester_name?.toLowerCase().includes(q) &&
          !String(t.id).includes(q)) return false
    }
    return true
  })

  const waPhone = waConfig?.whatsapp_phone || ''

  return (
    <>
      {showNew && (
        <NewTicketModal
          departments={departments}
          engineers={engineers}
          waConfig={waConfig}
          language={language}
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
        />
      )}

      <div className="space-y-6 max-w-4xl">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-2xl">💬</div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                {isAr ? 'تذاكر واتساب' : 'WhatsApp Tickets'}
              </h1>
              {waPhone ? (
                <a
                  href={`https://wa.me/${waPhone.replace(/\D/g,'')}`}
                  target="_blank" rel="noreferrer"
                  className="text-xs text-green-600 font-mono hover:underline"
                >
                  💬 +{waPhone.replace(/\D/g,'')}
                </a>
              ) : (
                <button
                  onClick={() => navigate('/admin/channels')}
                  className="text-xs text-slate-400 hover:text-yellow-600"
                >
                  {isAr ? '— اضبط رقم واتساب من الإعدادات' : '— Set WhatsApp number in settings'}
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate('/admin/channels')}
              className="btn-secondary !py-1.5 !text-xs"
            >
              ⚙️ {isAr ? 'الإعدادات' : 'Settings'}
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="btn-primary !py-1.5 !text-xs gap-1"
            >
              + {isAr ? 'تذكرة واتساب' : 'New WA Ticket'}
            </button>
            <button onClick={load} className="btn-secondary !py-1.5 !px-3 !text-xs">🔄</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon="🔴" label={isAr ? 'مفتوحة'          : 'Open'}        value={stats.open}        color="border-red-400" pulse />
          <StatCard icon="⚡" label={isAr ? 'قيد التنفيذ'     : 'In Progress'} value={stats.in_progress} color="border-blue-400" />
          <StatCard icon="✅" label={isAr ? 'محلولة / مغلقة'  : 'Resolved'}   value={stats.resolved}    color="border-yellow-400" />
          <StatCard icon="💬" label={isAr ? 'إجمالي واتساب'   : 'Total'}      value={stats.total}       color="border-green-300" />
        </div>

        {/* WhatsApp info banner (if no phone set) */}
        {!waPhone && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl">💬</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">
                {isAr ? 'لم يتم ضبط رقم واتساب بعد' : 'WhatsApp number not configured'}
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                {isAr
                  ? 'اضبط الرقم في إعدادات القنوات حتى يظهر رابط واتساب في نموذج الدعم العام'
                  : 'Set the number in Channel Settings so the WA link appears on the public support form'}
              </p>
            </div>
            <button onClick={() => navigate('/admin/channels')} className="btn-secondary !py-1.5 !text-xs flex-shrink-0">
              {isAr ? 'الإعدادات' : 'Settings'}
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="card !p-4 space-y-3">
          <input
            className="form-input !text-sm"
            placeholder={isAr ? 'بحث برقم التذكرة، العنوان، أو اسم المرسل...' : 'Search by ticket #, title, or requester...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {/* Status pills */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: 'active',      ar: 'النشطة',      en: 'Active'      },
              { key: 'all',         ar: 'الكل',         en: 'All'         },
              { key: 'open',        ar: 'مفتوحة',       en: 'Open'        },
              { key: 'in_progress', ar: 'قيد التنفيذ',  en: 'In Progress' },
              { key: 'resolved',    ar: 'محلولة',       en: 'Resolved'    },
              { key: 'closed',      ar: 'مغلقة',        en: 'Closed'      },
            ].map(s => (
              <button key={s.key} onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                  statusFilter === s.key
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-100 text-slate-500 hover:border-slate-300'
                }`}
              >
                {isAr ? s.ar : s.en}
              </button>
            ))}
          </div>

          {/* Priority pills */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: '',         ar: 'كل الأولويات', en: 'All Priorities' },
              { key: 'critical', ar: '🔴 حرجة',       en: '🔴 Critical'   },
              { key: 'high',     ar: '🟠 عالية',       en: '🟠 High'       },
              { key: 'medium',   ar: '🟡 متوسطة',      en: '🟡 Medium'     },
              { key: 'low',      ar: '⚪ منخفضة',      en: '⚪ Low'        },
            ].map(p => (
              <button key={p.key} onClick={() => setPriorityFilter(p.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  priorityFilter === p.key
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-slate-100 text-slate-400 hover:border-slate-300'
                }`}
              >
                {isAr ? p.ar : p.en}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            {isAr
              ? `${filtered.length} تذكرة من أصل ${tickets.length}`
              : `${filtered.length} of ${tickets.length} tickets`}
          </span>
          {(search || priorityFilter || statusFilter !== 'active') && (
            <button
              onClick={() => { setSearch(''); setPriorityFilter(''); setStatusFilter('active') }}
              className="text-green-600 hover:underline"
            >
              {isAr ? '× مسح الفلاتر' : '× Clear filters'}
            </button>
          )}
        </div>

        {/* Tickets */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3 animate-pulse">💬</div>
            <p className="text-slate-400 text-sm">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-5xl">💬</p>
            <p className="text-slate-600 font-semibold text-lg">
              {tickets.length === 0
                ? (isAr ? 'لا توجد تذاكر من واتساب بعد' : 'No WhatsApp tickets yet')
                : (isAr ? 'لا توجد نتائج مطابقة' : 'No matching tickets')}
            </p>
            <p className="text-slate-400 text-sm">
              {tickets.length === 0
                ? (isAr ? 'عندما تستلم رسالة على واتساب، أنشئ تذكرة بزر + تذكرة واتساب' : 'When you receive a WhatsApp message, create a ticket using the button above')
                : (isAr ? 'جرب تغيير الفلاتر' : 'Try changing the filters')}
            </p>
            {tickets.length === 0 && (
              <button onClick={() => setShowNew(true)} className="btn-primary !py-2 !px-6 !text-sm">
                💬 {isAr ? 'إنشاء أول تذكرة' : 'Create first ticket'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                engineers={engineers}
                waPhone={waPhone}
                onStatusChange={handleStatusChange}
                onAssign={handleAssign}
                language={language}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
