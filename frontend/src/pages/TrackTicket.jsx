import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../api/client'
import { BRAND_TAGLINE } from '../constants'

const STATUS_LABELS = { open: 'مفتوحة', in_progress: 'قيد التنفيذ', resolved: 'محلولة', closed: 'مغلقة' }
const STATUS_COLORS = {
  open: 'bg-red-100 text-red-600', in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700', closed: 'bg-slate-100 text-slate-500',
}
const PRIORITY_LABELS = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' }
const CATEGORY_LABELS = {
  network: '🌐 مشكلة شبكة', laptop_maintenance: '💻 صيانة لاب توب', internet: '📶 انترنت بيقطع',
  printing: '🖨️ مشكلة طباعة', other: '❓ أخرى',
}
const SLA_LABELS = { on_time: '🟢 في الموعد', at_risk: '🟠 معرّضة للتأخير', breached: '🔴 متجاوزة الموعد', met: '✅ أُنجزت في الموعد' }

export default function TrackTicket() {
  const navigate = useNavigate()
  const [ticketId, setTicketId] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | found | not_found | error
  const [ticket, setTicket] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!ticketId.trim() || !email.trim()) return
    setStatus('loading')
    try {
      const res = await fetch(`${API_BASE}/tickets/track?ticket_id=${encodeURIComponent(ticketId.trim())}&email=${encodeURIComponent(email.trim())}`)
      if (!res.ok) { setStatus('not_found'); return }
      const data = await res.json()
      setTicket(data)
      setStatus('found')
    } catch {
      setStatus('error')
    }
  }

  const reset = () => { setStatus('idle'); setTicket(null) }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-yellow-800 to-yellow-700 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-white rounded-2xl shadow-lg mx-auto mb-4 px-5 py-3 inline-flex items-center justify-center">
            <img src="/mobica-logo.png" alt="Mobica" className="h-8 w-auto" />
          </div>
          <h1 className="text-white font-bold text-xl">تتبّع حالة طلبك</h1>
          <p className="text-yellow-200 text-sm mt-1">{BRAND_TAGLINE}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {status === 'idle' || status === 'loading' || status === 'not_found' || status === 'error' ? (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">رقم التذكرة</label>
                <input
                  type="number" inputMode="numeric" placeholder="مثال: 128"
                  value={ticketId} onChange={e => setTicketId(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-base focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">البريد الإلكتروني اللي فتحت بيه الطلب</label>
                <input
                  type="email" dir="ltr" placeholder="your.name@mobica.net"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-base focus:outline-none focus:border-yellow-500"
                />
              </div>
              {status === 'not_found' && (
                <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5 text-center">
                  ⚠️ لم يتم العثور على تذكرة بهذا الرقم والبريد الإلكتروني معًا — تأكد من البيانات
                </div>
              )}
              {status === 'error' && (
                <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5 text-center">حدث خطأ، حاول مرة أخرى</div>
              )}
              <button type="submit" disabled={status === 'loading'}
                className="w-full py-3.5 rounded-2xl bg-yellow-600 text-white font-bold disabled:opacity-60 active:bg-yellow-700 transition-all">
                {status === 'loading' ? 'جاري البحث...' : '🔍 عرض الحالة'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">تذكرة رقم</p>
                  <p className="text-2xl font-black text-slate-800">#{ticket.id}</p>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${STATUS_COLORS[ticket.status] || ''}`}>
                  {STATUS_LABELS[ticket.status] || ticket.status}
                </span>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 text-sm">
                <p className="font-bold text-slate-800">{ticket.title}</p>
                {ticket.description && <p className="text-slate-500 whitespace-pre-line">{ticket.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-sm">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5">الأولوية</p>
                  <p className="font-semibold text-slate-700">{PRIORITY_LABELS[ticket.priority] || ticket.priority}</p>
                </div>
                {ticket.category && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-0.5">نوع المشكلة</p>
                    <p className="font-semibold text-slate-700">{CATEGORY_LABELS[ticket.category] || ticket.category}</p>
                  </div>
                )}
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5">تاريخ الفتح</p>
                  <p className="font-semibold text-slate-700">{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('ar-EG') : '—'}</p>
                </div>
                {!['resolved', 'closed'].includes(ticket.status) && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-0.5">حالة الموعد (SLA)</p>
                    <p className="font-semibold text-slate-700 text-xs">{SLA_LABELS[ticket.sla_status] || ticket.sla_status}</p>
                  </div>
                )}
              </div>

              {ticket.resolution && (
                <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
                  <p className="text-xs font-bold text-green-700 mb-1.5">✅ خطوات الحل</p>
                  <p className="text-sm text-green-800 whitespace-pre-line">{ticket.resolution}</p>
                </div>
              )}

              {ticket.status === 'resolved' && !ticket.csat_rating && (
                <button onClick={() => navigate(`/rate-ticket/${ticket.id}`)}
                  className="w-full py-3 rounded-2xl bg-yellow-50 text-yellow-700 font-bold border-2 border-yellow-200 active:bg-yellow-100">
                  ⭐ قيّم تجربتك مع الدعم الفني
                </button>
              )}

              <button onClick={reset} className="w-full py-3 rounded-2xl bg-slate-100 text-slate-600 font-semibold active:bg-slate-200">
                🔍 بحث عن تذكرة تانية
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
