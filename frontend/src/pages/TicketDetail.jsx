import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { departmentsApi, engineersApi, ticketsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

// ── config ────────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  open:        { label: 'مفتوحة',      color: 'bg-red-100 text-red-600',           dot: 'bg-red-500' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-amber-100 text-amber-700',        dot: 'bg-amber-500' },
  resolved:    { label: 'محلولة',      color: 'bg-yellow-100 text-yellow-700',    dot: 'bg-yellow-500' },
  closed:      { label: 'مغلقة',       color: 'bg-slate-100 text-slate-500',        dot: 'bg-slate-400' },
}
const PRIORITY_MAP = {
  low:      { label: 'منخفضة', color: 'bg-slate-100 text-slate-600' },
  medium:   { label: 'متوسطة', color: 'bg-yellow-100 text-yellow-700' },
  high:     { label: 'عالية',  color: 'bg-yellow-100 text-yellow-700' },
  critical: { label: 'حرجة',   color: 'bg-red-100 text-red-700 font-bold' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'))) / 1000
  if (diff < 60)    return 'الآن'
  if (diff < 3600)  return `منذ ${Math.floor(diff / 60)} دقيقة`
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`
  return new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Resolution display (KB card) ──────────────────────────────────────────────
function ResolutionCard({ resolution, resolvedAt, onEdit }) {
  const [copied, setCopied] = useState(false)
  const steps = resolution
    ? resolution.split('\n').map(s => s.trim()).filter(Boolean)
    : []

  const copyAll = () => {
    navigator.clipboard.writeText(resolution)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!resolution) return null

  return (
    <div className="rounded-2xl border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white overflow-hidden">
      {/* Header */}
      <div className="bg-yellow-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white text-lg">✅</span>
          <div>
            <p className="text-white font-bold text-sm">خطوات حل المشكلة</p>
            {resolvedAt && (
              <p className="text-yellow-200 text-[11px]">تم الحل {timeAgo(resolvedAt)}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={copyAll}
            className="text-xs bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
            {copied ? '✓ نُسخ' : '📋 نسخ'}
          </button>
          {onEdit && (
            <button onClick={onEdit}
              className="text-xs bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg transition-colors">
              ✏️ تعديل
            </button>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="p-4 space-y-2.5">
        {steps.length === 1 ? (
          <p className="text-sm text-slate-700 leading-relaxed">{steps[0]}</p>
        ) : (
          steps.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-yellow-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-slate-700 leading-relaxed flex-1">{step}</p>
            </div>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 pb-3">
        <p className="text-[11px] text-yellow-600 bg-yellow-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
          <span>💡</span>
          احتفظ بهذه الخطوات للرجوع إليها عند تكرار نفس المشكلة
        </p>
      </div>
    </div>
  )
}

// ── Resolve Modal ──────────────────────────────────────────────────────────────
function ResolveModal({ ticket, onConfirm, onClose }) {
  const [steps, setSteps]       = useState(ticket.resolution || '')
  const [rootCause, setRootCause] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const textRef = useRef(null)

  useEffect(() => { textRef.current?.focus() }, [])

  const parsedSteps = steps.split('\n').map(s => s.trim()).filter(Boolean)

  const addStep = () => {
    setSteps(s => s + (s.endsWith('\n') || s === '' ? '' : '\n'))
    setTimeout(() => {
      const ta = textRef.current
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
    }, 10)
  }

  const handleSubmit = async () => {
    if (!steps.trim()) { setError('يرجى كتابة خطوات الحل قبل المتابعة'); return }
    setSaving(true)
    setError('')
    const fullResolution = rootCause.trim()
      ? `سبب المشكلة: ${rootCause.trim()}\n\nخطوات الحل:\n${steps.trim()}`
      : steps.trim()
    try {
      await onConfirm(fullResolution)
      onClose()
    } catch {
      setError('حدث خطأ — يرجى المحاولة مرة أخرى')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden animate-fadeIn">

        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">✅</div>
            <div>
              <h3 className="text-white font-bold">تسجيل حل المشكلة</h3>
              <p className="text-yellow-200 text-xs mt-0.5 truncate max-w-xs">{ticket.title}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
              <span>⚠️</span>{error}
            </div>
          )}

          {/* Root cause (optional) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              سبب المشكلة <span className="text-slate-400 font-normal">(اختياري)</span>
            </label>
            <input
              value={rootCause}
              onChange={e => setRootCause(e.target.value)}
              placeholder="مثال: انقطاع الاتصال بالشبكة، تعارض في البرامج..."
              className="input w-full text-sm"
            />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-slate-700">
                خطوات الحل <span className="text-red-400">*</span>
              </label>
              <span className="text-xs text-slate-400">
                {parsedSteps.length} {parsedSteps.length === 1 ? 'خطوة' : 'خطوات'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2">اكتب كل خطوة في سطر منفصل — ستُرقَّم تلقائياً</p>
            <textarea
              ref={textRef}
              value={steps}
              onChange={e => setSteps(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
              }}
              rows={5}
              placeholder={"أعد تشغيل الخدمة من لوحة التحكم\nتحقق من إعدادات الشبكة\nأبلغ المستخدم بالحل"}
              className="input w-full text-sm resize-none font-mono leading-relaxed"
            />

            {/* Live preview */}
            {parsedSteps.length > 0 && (
              <div className="mt-3 bg-slate-50 rounded-xl p-3 space-y-1.5">
                <p className="text-[11px] text-slate-400 mb-2 font-medium">معاينة:</p>
                {parsedSteps.map((s, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{s}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2.5">
          <button onClick={handleSubmit} disabled={saving || !steps.trim()}
            className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري الحفظ...
              </span>
            ) : '✅ حفظ الحل وإغلاق التذكرة'}
          </button>
          <button onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
        <p className="text-center text-[11px] text-slate-400 pb-4">Ctrl+Enter للإرسال السريع</p>
      </div>
    </div>
  )
}

// ── Edit Resolution Modal ──────────────────────────────────────────────────────
function EditResolutionModal({ currentResolution, onSave, onClose }) {
  const [text, setText] = useState(currentResolution || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(text.trim()); onClose() }
    finally { setSaving(false) }
  }

  const steps = text.split('\n').map(s => s.trim()).filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden">
        <div className="bg-yellow-600 px-5 py-4">
          <h3 className="text-white font-bold flex items-center gap-2">✏️ تعديل خطوات الحل</h3>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">كل سطر = خطوة واحدة</p>
          <textarea value={text} onChange={e => setText(e.target.value)}
            rows={6} className="input w-full text-sm resize-none font-mono" autoFocus />
          {steps.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                  <p className="text-xs text-slate-600">{s}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={handleSave} disabled={saving || !text.trim()}
            className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
          <button onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </div>
    </div>
  )
}

// ── InfoRow ───────────────────────────────────────────────────────────────────
function InfoRow({ label, value, icon, highlight }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</p>
        <p className={`text-sm mt-0.5 break-words ${highlight ? 'font-semibold text-yellow-700' : 'text-slate-700'}`}>{value}</p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { engineer: me } = useAuth()

  const [ticket, setTicket]       = useState(null)
  const [comments, setComments]   = useState([])
  const [engineers, setEngineers] = useState([])
  const [loading, setLoading]     = useState(true)

  // modals
  const [assignOpen, setAssignOpen]           = useState(false)
  const [assignEngineer, setAssignEngineer]   = useState('')
  const [assigning, setAssigning]             = useState(false)
  const [resolveOpen, setResolveOpen]         = useState(false)
  const [editResOpen, setEditResOpen]         = useState(false)

  // comment
  const [commentText, setCommentText]       = useState('')
  const [authorName, setAuthorName]         = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [toast, setToast]                   = useState('')

  const commentsEndRef = useRef(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadTicket   = () => ticketsApi.get(id).then(r => setTicket(r.data))
  const loadComments = () => ticketsApi.listComments(id).then(r => setComments(r.data))

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadTicket(),
      loadComments(),
      engineersApi.list().then(r => setEngineers(r.data)),
    ]).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (me?.name) setAuthorName(me.name)
  }, [me])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  // ── status change ──
  const handleStatusChange = async (newStatus, resolution) => {
    await ticketsApi.updateStatus(id, newStatus, undefined, resolution)
    await loadTicket()
    await loadComments()
  }

  // ── when "حل التذكرة" clicked ──
  const handleResolveClick = () => {
    setResolveOpen(true)
  }

  const handleResolveConfirm = async (resolution) => {
    await handleStatusChange('resolved', resolution)
    showToast('✅ تم حفظ الحل وتحديث الحالة')
  }

  // ── edit resolution from KB card ──
  const handleSaveEditedResolution = async (newRes) => {
    const data = { ...ticket, resolution: newRes, department_id: ticket.department_id || null }
    await ticketsApi.update(id, data)
    await loadTicket()
    showToast('تم تحديث خطوات الحل')
  }

  // ── assign ──
  const handleAssign = async () => {
    if (!assignEngineer) return
    setAssigning(true)
    try {
      await ticketsApi.assign(id, assignEngineer)
      setAssignOpen(false)
      await loadTicket()
      await loadComments()
    } finally { setAssigning(false) }
  }

  // ── comment ──
  const handleAddComment = async () => {
    if (!commentText.trim()) return
    setSendingComment(true)
    try {
      await ticketsApi.addComment(id, { author_name: authorName || 'مجهول', content: commentText.trim() })
      setCommentText('')
      await loadComments()
    } finally { setSendingComment(false) }
  }

  const handleDeleteComment = async (cid) => {
    if (!confirm('حذف هذا التعليق؟')) return
    await ticketsApi.deleteComment(id, cid)
    await loadComments()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">جاري التحميل...</span>
      </div>
    </div>
  )
  if (!ticket) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-red-400 text-sm">التذكرة غير موجودة</p>
    </div>
  )

  const statusInfo   = STATUS_MAP[ticket.status]   || STATUS_MAP.open
  const priorityInfo = PRIORITY_MAP[ticket.priority] || PRIORITY_MAP.medium
  const isResolved   = ticket.status === 'resolved' || ticket.status === 'closed'

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-6 z-50 bg-yellow-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-fadeIn">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => navigate('/tickets')} className="text-slate-400 hover:text-yellow-600 transition-colors">
          ← التذاكر
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">تذكرة #{ticket.id}</span>
      </div>

      {/* Title card */}
      <div className="card">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`badge ${statusInfo.color} gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                {statusInfo.label}
              </span>
              <span className={`badge ${priorityInfo.color}`}>{priorityInfo.label}</span>
              {ticket.source === 'email' && (
                <span className="badge bg-purple-100 text-purple-600">📧 من إيميل</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-800">{ticket.title}</h1>
            <p className="text-xs text-slate-400 mt-1">
              أُنشئت {new Date(ticket.created_at).toLocaleString('ar-EG')}
              {ticket.updated_at && ` · آخر تحديث ${timeAgo(ticket.updated_at)}`}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {ticket.status === 'open' && (
              <button onClick={() => handleStatusChange('in_progress')} className="btn-primary !py-2 gap-1.5">
                ▶ بدء التنفيذ
              </button>
            )}
            {ticket.status === 'in_progress' && (
              <button onClick={handleResolveClick}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl font-medium text-sm transition-colors flex items-center gap-1.5 shadow-sm">
                ✓ حل التذكرة
              </button>
            )}
            {ticket.status === 'resolved' && (
              <button onClick={() => handleStatusChange('closed')} className="btn-secondary !py-2 gap-1.5">
                ✕ إغلاق
              </button>
            )}
            <button onClick={() => { setAssignEngineer(ticket.assigned_to || ''); setAssignOpen(true) }}
              className="btn-secondary !py-2 gap-1.5">
              👤 تحويل
            </button>
            <button onClick={() => navigate(`/tickets/${ticket.id}/print`)}
              className="btn-secondary !py-2 gap-1.5">
              🖨️ طباعة
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* LEFT col */}
        <div className="md:col-span-1 space-y-4">

          {/* Info card */}
          <div className="card space-y-4">
            <h3 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-2">معلومات التذكرة</h3>
            <InfoRow label="مقدم الطلب"  value={ticket.requester_name  || '—'} icon="👤" />
            <InfoRow label="البريد"       value={ticket.requester_email || '—'} icon="📧" />
            <InfoRow label="القسم"        value={ticket.department?.name || '—'} icon="🏢" />
            <InfoRow label="المسؤول"      value={ticket.assigned_to || 'غير محدد'} icon="🔧" highlight={!!ticket.assigned_to} />
          </div>

          {/* Resolution KB card (when resolved/closed) */}
          {isResolved && ticket.resolution && (
            <ResolutionCard
              resolution={ticket.resolution}
              resolvedAt={ticket.updated_at}
              onEdit={() => setEditResOpen(true)}
            />
          )}

          {/* Resolution add/edit (when not resolved yet OR no resolution text) */}
          {!isResolved && (
            <div className="card border-2 border-dashed border-slate-200">
              <div className="text-center py-4">
                <p className="text-3xl mb-2">📝</p>
                <p className="text-sm font-medium text-slate-600 mb-1">لم يتم تسجيل الحل بعد</p>
                <p className="text-xs text-slate-400 mb-4">سيُطلب منك تسجيل خطوات الحل عند إغلاق التذكرة</p>
                {ticket.status === 'in_progress' && (
                  <button onClick={handleResolveClick}
                    className="text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl font-medium transition-colors">
                    ✓ حل التذكرة الآن
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Resolved but no resolution text yet */}
          {isResolved && !ticket.resolution && (
            <div className="card border-2 border-dashed border-amber-200 bg-amber-50/50">
              <div className="text-center py-4">
                <p className="text-2xl mb-2">⚠️</p>
                <p className="text-sm font-medium text-amber-700 mb-1">لم تُسجَّل خطوات الحل</p>
                <button onClick={() => setEditResOpen(true)}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors mt-2">
                  + إضافة خطوات الحل
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT col */}
        <div className="md:col-span-2 space-y-4">

          {/* Description */}
          {ticket.description && (
            <div className="card">
              <h3 className="font-bold text-slate-700 text-sm mb-3">وصف المشكلة</h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {/* Resolution inline for resolved (also in right col for visibility) */}
          {isResolved && ticket.resolution && (
            <div className="card !p-0 overflow-hidden">
              <div className="bg-yellow-600 px-4 py-2.5 flex items-center justify-between">
                <p className="text-white font-semibold text-sm flex items-center gap-2">
                  <span>✅</span> خطوات الحل المُسجَّلة
                </p>
                <button onClick={() => setEditResOpen(true)}
                  className="text-xs text-yellow-100 hover:text-white">تعديل ←</button>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  {ticket.resolution.split('\n').map(s => s.trim()).filter(Boolean).map((step, i, arr) => (
                    <div key={i} className={`flex gap-3 items-start ${arr.length === 1 ? '' : ''}`}>
                      {arr.length > 1 && (
                        <span className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                      )}
                      <p className="text-sm text-slate-700 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Comments / Activity */}
          <div className="card">
            <h3 className="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2">
              💬 التعليقات والنشاط
              <span className="text-xs text-slate-400 font-normal">({comments.length})</span>
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {comments.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">لا توجد تعليقات بعد</p>
              )}
              {comments.map(c => (
                <div key={c.id} className={`flex gap-3 group ${c.type === 'activity' ? 'opacity-70' : ''}`}>
                  {c.type === 'activity' ? (
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs flex-shrink-0 mt-0.5">⚙</div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-xs flex-shrink-0 mt-0.5">
                      {c.author_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${c.type === 'activity' ? 'text-slate-400' : 'text-slate-700'}`}>
                        {c.author_name}
                      </span>
                      <span className="text-[11px] text-slate-400">{timeAgo(c.created_at)}</span>
                      {c.type === 'comment' && (
                        <button onClick={() => handleDeleteComment(c.id)}
                          className="text-[11px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity mr-auto">
                          حذف
                        </button>
                      )}
                    </div>
                    <div className={`mt-1 text-sm rounded-xl px-3 py-2 ${
                      c.type === 'activity'
                        ? 'bg-slate-50 text-slate-500 text-xs border border-dashed border-slate-200'
                        : 'bg-white border border-slate-100 text-slate-700 shadow-sm'
                    }`}>
                      {c.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>

            {/* Add comment */}
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <input
                className="input !py-2 !text-sm"
                style={{ maxWidth: '200px' }}
                placeholder="اسمك"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
              />
              <div className="flex gap-2">
                <textarea
                  className="input !py-2 !text-sm flex-1 resize-none"
                  rows={2}
                  placeholder="اكتب تعليقاً أو ملاحظة... (Ctrl+Enter للإرسال)"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment() }}
                />
                <button onClick={handleAddComment} disabled={!commentText.trim() || sendingComment}
                  className="btn-primary !px-4 self-end disabled:opacity-40">
                  {sendingComment ? '...' : 'إرسال'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Resolve modal ── */}
      {resolveOpen && (
        <ResolveModal
          ticket={ticket}
          onConfirm={handleResolveConfirm}
          onClose={() => setResolveOpen(false)}
        />
      )}

      {/* ── Edit resolution modal ── */}
      {editResOpen && (
        <EditResolutionModal
          currentResolution={ticket.resolution || ''}
          onSave={handleSaveEditedResolution}
          onClose={() => setEditResOpen(false)}
        />
      )}

      {/* ── Assign modal ── */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setAssignOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAssignOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 z-10">
            <h3 className="font-bold text-slate-800 mb-4">تحويل التذكرة #{ticket.id}</h3>
            <p className="text-xs text-slate-500 mb-3 bg-slate-50 rounded-lg p-2">{ticket.title}</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {engineers.filter(e => e.active === 'true').map(eng => (
                <button key={eng.id} onClick={() => setAssignEngineer(eng.name)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start ${
                    assignEngineer === eng.name
                      ? 'border-yellow-500 bg-yellow-50'
                      : 'border-slate-100 hover:border-yellow-200'
                  }`}>
                  <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {eng.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{eng.name}</p>
                    <p className="text-xs text-slate-400">{eng.role}</p>
                  </div>
                  {assignEngineer === eng.name && <span className="text-yellow-500">✓</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
              <button onClick={handleAssign} disabled={!assignEngineer || assigning}
                className="btn-primary flex-1 justify-center disabled:opacity-50">
                {assigning ? 'جاري التحويل...' : '✅ تأكيد'}
              </button>
              <button onClick={() => setAssignOpen(false)} className="btn-secondary">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
