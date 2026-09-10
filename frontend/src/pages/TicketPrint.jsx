import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ticketsApi } from '../api/client'
import { BRAND_TAGLINE } from '../constants'

// ── config ────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  open:        { label: 'مفتوحة',      color: '#dc2626', bg: '#fef2f2' },
  in_progress: { label: 'قيد التنفيذ', color: '#d97706', bg: '#fffbeb' },
  resolved:    { label: 'محلولة',      color: '#059669', bg: '#f0fdf4' },
  closed:      { label: 'مغلقة',       color: '#64748b', bg: '#f8fafc' },
}
const PRIORITY_CFG = {
  critical: { label: 'حرجة',   color: '#dc2626', bg: '#fef2f2' },
  high:     { label: 'عالية',  color: '#ea580c', bg: '#fff7ed' },
  medium:   { label: 'متوسطة', color: '#d97706', bg: '#fffbeb' },
  low:      { label: 'منخفضة', color: '#64748b', bg: '#f8fafc' },
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + (iso.includes('Z') ? '' : 'Z'))
    .toLocaleString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDateShort(iso) {
  if (!iso) return '—'
  return new Date(iso + (iso.includes('Z') ? '' : 'Z'))
    .toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function TicketPrint() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [ticket, setTicket]     = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [includeComments, setIncludeComments] = useState(true)
  const [includeActivity, setIncludeActivity] = useState(false)
  const [autoPrint, setAutoPrint] = useState(false)
  const printedRef = useRef(false)

  useEffect(() => {
    Promise.all([
      ticketsApi.get(id),
      ticketsApi.listComments(id),
    ]).then(([t, c]) => {
      setTicket(t.data)
      setComments(c.data)
    }).finally(() => setLoading(false))
  }, [id])

  // auto-print once loaded if ?print=1 in URL
  useEffect(() => {
    if (!loading && ticket && autoPrint && !printedRef.current) {
      printedRef.current = true
      setTimeout(() => window.print(), 400)
    }
  }, [loading, ticket, autoPrint])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('print') === '1') setAutoPrint(true)
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        <span>جاري تحضير التقرير...</span>
      </div>
    </div>
  )
  if (!ticket) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-red-500">التذكرة غير موجودة</p>
    </div>
  )

  const stat = STATUS_CFG[ticket.status]   || STATUS_CFG.open
  const pri  = PRIORITY_CFG[ticket.priority] || PRIORITY_CFG.medium
  const steps = ticket.resolution
    ? ticket.resolution.split('\n').map(s => s.trim()).filter(Boolean)
    : []
  const userComments = comments.filter(c => c.type === 'comment')
  const activities   = comments.filter(c => c.type === 'activity')
  const isResolved   = ['resolved','closed'].includes(ticket.status)

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">

      {/* ── Toolbar (no-print) ── */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/tickets/${id}`)}
              className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1.5 font-medium">
              ← رجوع للتذكرة
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 text-sm font-medium">معاينة الطباعة — تذكرة #{ticket.id}</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Options */}
            <div className="flex items-center gap-4 text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={includeComments} onChange={e => setIncludeComments(e.target.checked)}
                  className="w-3.5 h-3.5 accent-yellow-600 rounded" />
                التعليقات
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={includeActivity} onChange={e => setIncludeActivity(e.target.checked)}
                  className="w-3.5 h-3.5 accent-yellow-600 rounded" />
                سجل النشاط
              </label>
            </div>

            <button onClick={() => window.print()}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-sm">
              🖨️ طباعة
            </button>
          </div>
        </div>
      </div>

      {/* ── Print page ── */}
      <div className="print-page max-w-4xl mx-auto my-8 print:my-0 bg-white shadow-lg print:shadow-none rounded-2xl print:rounded-none overflow-hidden">

        {/* === HEADER === */}
        <div style={{ background: 'linear-gradient(135deg, #713f12 0%, #ca8a04 100%)' }} className="px-10 py-8 print-section">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">💻</div>
                <div>
                  <h1 className="text-white font-bold text-xl leading-tight">نظام إدارة تكنولوجيا المعلومات</h1>
                  <p className="text-yellow-200 text-sm">{BRAND_TAGLINE}</p>
                </div>
              </div>
              <h2 className="text-white/80 text-sm font-medium">تقرير تذكرة الدعم الفني</h2>
            </div>
            <div className="text-left text-yellow-100 text-sm space-y-1">
              <p className="font-bold text-white text-lg">#{ticket.id}</p>
              <p>{fmtDateShort(new Date().toISOString())}</p>
              <p className="text-yellow-200 text-xs">طُبع بواسطة النظام</p>
            </div>
          </div>

          {/* Status + Priority row */}
          <div className="flex gap-3 mt-6">
            <span style={{ background: stat.bg, color: stat.color }}
              className="text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">
              ● {stat.label}
            </span>
            <span style={{ background: pri.bg, color: pri.color }}
              className="text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">
              ▲ {pri.label}
            </span>
            {ticket.source === 'email' && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 border border-white/20">
                📧 من البريد
              </span>
            )}
            {isResolved && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 text-white">
                ✅ تم الحل
              </span>
            )}
          </div>
        </div>

        {/* === TITLE === */}
        <div className="px-10 py-6 border-b border-slate-100 print-section">
          <h3 className="text-2xl font-bold text-slate-800 leading-relaxed">{ticket.title}</h3>
        </div>

        {/* === INFO TABLE === */}
        <div className="px-10 py-6 print-section">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-5 h-0.5 bg-yellow-500 inline-block" />
            معلومات التذكرة
          </h4>
          <div className="grid grid-cols-2 gap-0 border border-slate-200 rounded-xl overflow-hidden text-sm">
            {[
              { label: 'رقم التذكرة',    value: `#${ticket.id}` },
              { label: 'تاريخ الإنشاء',  value: fmtDate(ticket.created_at) },
              { label: 'اسم مقدم الطلب', value: ticket.requester_name || '—' },
              { label: 'البريد الإلكتروني', value: ticket.requester_email || '—' },
              { label: 'القسم',           value: ticket.department?.name || '—' },
              { label: 'المسؤول عن الحل', value: ticket.assigned_to || 'غير محدد' },
              { label: 'الأولوية',        value: pri.label },
              { label: 'الحالة الحالية',  value: stat.label },
              ...(ticket.updated_at ? [{ label: 'آخر تحديث', value: fmtDate(ticket.updated_at) }] : []),
              ...(ticket.source ? [{ label: 'مصدر التذكرة', value: ticket.source === 'email' ? 'بريد إلكتروني' : 'يدوي' }] : []),
            ].map((row, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                <div className="w-36 flex-shrink-0 px-4 py-3 font-semibold text-slate-500 border-l border-slate-100 bg-slate-50">
                  {row.label}
                </div>
                <div className="flex-1 px-4 py-3 text-slate-800">{row.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* === DESCRIPTION === */}
        {ticket.description && (
          <div className="px-10 py-6 border-t border-slate-100 print-section">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-0.5 bg-slate-300 inline-block" />
              وصف المشكلة
            </h4>
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
              <p className="text-sm text-slate-700 leading-loose whitespace-pre-wrap">{ticket.description}</p>
            </div>
          </div>
        )}

        {/* === RESOLUTION === */}
        {steps.length > 0 && (
          <div className="px-10 py-6 border-t border-slate-100 print-section">
            <h4 className="text-sm font-bold text-yellow-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-0.5 bg-yellow-500 inline-block" />
              ✅ خطوات الحل المُسجَّلة
            </h4>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-7 h-7 rounded-full bg-yellow-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 print:border print:border-yellow-600">
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed pt-1">{step}</p>
                </div>
              ))}
            </div>
            {ticket.assigned_to && (
              <p className="text-xs text-slate-400 mt-3 text-left">
                حُلَّت بواسطة: <strong className="text-slate-600">{ticket.assigned_to}</strong>
                {ticket.updated_at && <span> · {fmtDate(ticket.updated_at)}</span>}
              </p>
            )}
          </div>
        )}

        {/* === NO RESOLUTION YET === */}
        {isResolved && steps.length === 0 && (
          <div className="px-10 py-6 border-t border-slate-100 print-section">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-0.5 bg-slate-300 inline-block" />
              خطوات الحل
            </h4>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-700">⚠️ لم تُسجَّل خطوات الحل لهذه التذكرة</p>
            </div>
          </div>
        )}

        {/* === COMMENTS === */}
        {includeComments && userComments.length > 0 && (
          <div className="px-10 py-6 border-t border-slate-100 print-section">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-0.5 bg-slate-300 inline-block" />
              💬 التعليقات ({userComments.length})
            </h4>
            <div className="space-y-3">
              {userComments.map((c, i) => (
                <div key={c.id} className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {c.author_name.charAt(0)}
                  </div>
                  <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700">{c.author_name}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.created_at + (c.created_at.includes('Z') ? '' : 'Z'))
                          .toLocaleString('ar-EG', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === ACTIVITY LOG === */}
        {includeActivity && activities.length > 0 && (
          <div className="px-10 py-6 border-t border-slate-100 print-section">
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-5 h-0.5 bg-slate-300 inline-block" />
              ⚙️ سجل النشاط ({activities.length})
            </h4>
            <div className="space-y-2">
              {activities.map((c, i) => (
                <div key={c.id} className="flex gap-3 items-start text-xs text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                  <span className="flex-1 leading-relaxed">{c.content}</span>
                  <span className="text-slate-300 flex-shrink-0">
                    {new Date(c.created_at + (c.created_at.includes('Z') ? '' : 'Z'))
                      .toLocaleDateString('ar-EG', { day:'numeric', month:'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === SIGNATURE SECTION === */}
        <div className="px-10 py-8 border-t-2 border-slate-100 print-section">
          <div className="grid grid-cols-3 gap-8 text-sm">
            <div className="text-center">
              <div className="border-b-2 border-slate-300 mb-2 pb-8" />
              <p className="text-slate-500 text-xs">توقيع المهندس المسؤول</p>
              {ticket.assigned_to && <p className="font-semibold text-slate-700 mt-1">{ticket.assigned_to}</p>}
            </div>
            <div className="text-center">
              <div className="border-b-2 border-slate-300 mb-2 pb-8" />
              <p className="text-slate-500 text-xs">توقيع المستخدم</p>
              {ticket.requester_name && <p className="font-semibold text-slate-700 mt-1">{ticket.requester_name}</p>}
            </div>
            <div className="text-center">
              <div className="border-b-2 border-slate-300 mb-2 pb-8" />
              <p className="text-slate-500 text-xs">توقيع مدير IT</p>
            </div>
          </div>
        </div>

        {/* === FOOTER === */}
        <div className="px-10 py-4 bg-slate-50 border-t border-slate-200 print-section">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{BRAND_TAGLINE}</span>
            <span>تذكرة #{ticket.id} · {fmtDateShort(new Date().toISOString())}</span>
            <span>تقرير آلي من النظام</span>
          </div>
        </div>
      </div>

      {/* ── Print options bar (no-print) ── */}
      <div className="no-print max-w-4xl mx-auto mb-10 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between flex-wrap gap-3 shadow-sm">
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <span className="text-slate-400">💡</span>
            تأكد من اختيار <strong>"A4 عمودي"</strong> وتفعيل <strong>"طباعة خلفيات الصفحات"</strong> للحصول على أفضل نتيجة
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(`/tickets/${id}`)} className="btn-secondary !py-2 !px-4 text-sm">
              ← رجوع
            </button>
            <button onClick={() => window.print()}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
              🖨️ طباعة الآن
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
