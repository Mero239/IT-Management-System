import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportsApi, ticketsApi, engineersApi } from '../api/client'
import { useAuth } from '../context/AuthContext'

// ── helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_CFG = {
  critical: { label: 'حرجة',   color: 'bg-red-500',    light: 'bg-red-50 text-red-700 border-red-200',    dot: 'bg-red-500' },
  high:     { label: 'عالية',  color: 'bg-yellow-500', light: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400' },
  medium:   { label: 'متوسطة', color: 'bg-amber-400',  light: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-400' },
  low:      { label: 'منخفضة', color: 'bg-slate-300',  light: 'bg-slate-50 text-slate-600 border-slate-200',  dot: 'bg-slate-300' },
}
const STATUS_CFG = {
  open:        { label: 'مفتوحة',      badge: 'bg-red-100 text-red-600' },
  in_progress: { label: 'قيد التنفيذ', badge: 'bg-amber-100 text-amber-700' },
  resolved:    { label: 'محلولة',      badge: 'bg-yellow-100 text-yellow-700' },
  closed:      { label: 'مغلقة',       badge: 'bg-slate-100 text-slate-500' },
}
const PERM_CFG = {
  admin:    { label: 'مسؤول', color: 'bg-purple-100 text-purple-700' },
  engineer: { label: 'مهندس', color: 'bg-yellow-100 text-yellow-700' },
  viewer:   { label: 'مشاهد', color: 'bg-slate-100 text-slate-500' },
}

function timeAgo(iso) {
  if (!iso) return ''
  const d = (Date.now() - new Date(iso + (iso.includes('Z') ? '' : 'Z'))) / 1000
  if (d < 60)     return 'الآن'
  if (d < 3600)   return `منذ ${Math.floor(d/60)} د`
  if (d < 86400)  return `منذ ${Math.floor(d/3600)} س`
  if (d < 604800) return `منذ ${Math.floor(d/86400)} ي`
  return new Date(iso).toLocaleDateString('ar-EG', { day:'numeric', month:'short' })
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPI({ icon, label, value, sub, color = 'border-slate-200', pulse, onClick }) {
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl border-2 p-4 ${color} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-bold text-slate-800 relative">
            {value}
            {pulse && value > 0 && <span className="absolute -top-1 -right-3 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}

// ── Horizontal bar ────────────────────────────────────────────────────────────
function HBar({ label, value, max, color, sub }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="font-bold text-slate-800">{value} <span className="text-slate-400 font-normal text-xs">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Assign modal ──────────────────────────────────────────────────────────────
function AssignModal({ ticket, engineers, onAssign, onClose }) {
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const handleAssign = async () => {
    if (!selected) return
    setSaving(true)
    try { await onAssign(ticket.id, selected); onClose() }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 z-10 animate-fadeIn">
        <h3 className="font-bold text-slate-800 mb-1">تعيين مهندس</h3>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mb-4 truncate">#{ticket.id} {ticket.title}</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {engineers.filter(e => e.active === 'true').map(eng => (
            <button key={eng.id} onClick={() => setSelected(eng.name)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-start ${selected === eng.name ? 'border-yellow-500 bg-yellow-50' : 'border-slate-100 hover:border-yellow-200'}`}>
              <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-bold text-sm flex items-center justify-center">{eng.name.charAt(0)}</div>
              <div><p className="text-sm font-medium text-slate-800">{eng.name}</p><p className="text-xs text-slate-400">{eng.role}</p></div>
              {selected === eng.name && <span className="text-yellow-500 mr-auto">✓</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
          <button onClick={handleAssign} disabled={!selected || saving} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? '...' : '✅ تأكيد'}
          </button>
          <button onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { engineer: me } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [engineers, setEngineers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [assignTarget, setAssignTarget] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [dash, engs] = await Promise.all([
        reportsApi.adminDashboard(),
        engineersApi.list(),
      ])
      setData(dash.data)
      setEngineers(engs.data)
      setLastUpdate(new Date())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(() => load(true), 60000)
    return () => clearInterval(id)
  }, [load])

  const handleAssign = async (ticketId, engineerName) => {
    await ticketsApi.assign(ticketId, engineerName)
    load(true)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-3 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">جاري تحميل البيانات...</p>
      </div>
    </div>
  )

  const { kpi, by_priority, workload, by_dept, recent_tickets, critical_list, unassigned_list } = data
  const totalActive = kpi.open + kpi.in_progress
  const maxPriority = Math.max(...by_priority.map(p => p.total), 1)
  const maxWork = Math.max(...workload.map(w => w.open + w.in_progress), 1)

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-slate-800">لوحة التحكم الشاملة</h2>
            {refreshing && <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full animate-pulse">تحديث...</span>}
          </div>
          <p className="text-slate-500 text-sm">
            {new Date().toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            {lastUpdate && <span className="text-slate-400 mr-2">· آخر تحديث {lastUpdate.toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' })}</span>}
          </p>
        </div>
        <button onClick={() => load(true)} className="btn-secondary !py-2 !px-4 gap-2">
          🔄 تحديث
        </button>
      </div>

      {/* ── Critical alert ── */}
      {kpi.critical_open > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-3xl animate-bounce flex-shrink-0">🚨</span>
          <div className="flex-1">
            <p className="font-bold text-red-800">تنبيه: {kpi.critical_open} تذكرة حرجة تحتاج تدخلاً فورياً</p>
            <p className="text-red-600 text-sm mt-0.5">
              {critical_list.map(t => `#${t.id} ${t.title}`).slice(0, 2).join(' · ')}
              {critical_list.length > 2 && ` +${critical_list.length - 2}`}
            </p>
          </div>
          <button onClick={() => navigate('/tickets?priority=critical')} className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors flex-shrink-0">
            عرض الكل
          </button>
        </div>
      )}

      {/* ── KPIs row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <div className="col-span-2">
          <KPI icon="🎫" label="إجمالي التذاكر"   value={kpi.total_tickets} color="border-slate-200" />
        </div>
        <div className="col-span-2">
          <KPI icon="🔴" label="مفتوحة / جارية"   value={totalActive}
            sub={`${kpi.open} مفتوحة · ${kpi.in_progress} جارية`}
            color="border-red-200" pulse={kpi.open > 0}
            onClick={() => navigate('/tickets?status=open')} />
        </div>
        <div className="col-span-2">
          <KPI icon="🚨" label="حرجة غير محلولة"  value={kpi.critical_open}
            color={kpi.critical_open > 0 ? 'border-red-400 bg-red-50' : 'border-slate-200'}
            pulse={kpi.critical_open > 0} />
        </div>
        <div className="col-span-2">
          <KPI icon="⚠️" label="غير معيّنة"        value={kpi.unassigned}
            color={kpi.unassigned > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}
            onClick={() => setAssignTarget('list')} />
        </div>
        <div className="col-span-2">
          <KPI icon="✅" label="محلولة ومغلقة"    value={kpi.resolved + kpi.closed}
            sub={`${kpi.resolved} محلولة · ${kpi.closed} مغلقة`}
            color="border-yellow-200" />
        </div>
        <div className="col-span-2">
          <KPI icon="📧" label="من البريد الإلكتروني" value={kpi.email_tickets} color="border-purple-200" />
        </div>
        <div className="col-span-2">
          <KPI icon="👷" label="المهندسون النشطون" value={kpi.active_engineers}
            sub={`من ${kpi.total_engineers} إجمالاً`} color="border-yellow-200" />
        </div>
        <div className="col-span-2">
          <KPI icon="✅" label="معدل الإنجاز"
            value={kpi.total_tickets > 0 ? `${Math.round((kpi.resolved + kpi.closed) / kpi.total_tickets * 100)}%` : '—'}
            color="border-yellow-200" />
        </div>
      </div>

      {/* ── Middle row: Priority + Dept + Engineer workload ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Priority breakdown */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-700">التذاكر حسب الأولوية</h3>
            <span className="text-xs text-slate-400">النشطة فقط</span>
          </div>
          <div className="space-y-3">
            {by_priority.map(p => {
              const cfg = PRIORITY_CFG[p.priority]
              return (
                <div key={p.priority}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                      <span className="text-slate-700 font-medium">{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-500 font-medium">{p.open} نشطة</span>
                      <span className="font-bold text-slate-800">{p.total}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${cfg.color} rounded-full transition-all duration-700`}
                      style={{ width: `${maxPriority > 0 ? (p.total / maxPriority) * 100 : 0}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Status mini summary */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
            {[
              { label: 'مفتوحة',      v: kpi.open,        c: 'bg-red-100 text-red-700' },
              { label: 'قيد التنفيذ', v: kpi.in_progress, c: 'bg-amber-100 text-amber-700' },
              { label: 'محلولة',      v: kpi.resolved,    c: 'bg-yellow-100 text-yellow-700' },
              { label: 'مغلقة',       v: kpi.closed,      c: 'bg-slate-100 text-slate-500' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl px-3 py-2 text-center ${s.c}`}>
                <p className="font-bold text-lg">{s.v}</p>
                <p className="text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Department tickets */}
        <div className="card space-y-3">
          <h3 className="font-bold text-slate-700">التذاكر النشطة حسب القسم</h3>
          {by_dept.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">لا توجد تذاكر نشطة</p>
          ) : (
            <>
              {by_dept.map((d, i) => (
                <HBar key={d.dept} label={d.dept || 'غير محدد'} value={d.count}
                  max={by_dept[0]?.count || 1}
                  color={i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-yellow-400' : 'bg-yellow-200'} />
              ))}
            </>
          )}

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 justify-between">
              <span className="text-xs text-slate-500">مصدر التذاكر</span>
            </div>
            <div className="flex gap-3 mt-2">
              <div className="flex-1 bg-purple-50 rounded-xl p-3 text-center">
                <p className="font-bold text-purple-700 text-xl">{kpi.email_tickets}</p>
                <p className="text-xs text-purple-500 mt-0.5">📧 من البريد</p>
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
                <p className="font-bold text-slate-700 text-xl">{kpi.total_tickets - kpi.email_tickets}</p>
                <p className="text-xs text-slate-400 mt-0.5">✋ يدوي</p>
              </div>
            </div>
          </div>
        </div>

        {/* Engineer workload */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700">عبء العمل على المهندسين</h3>
            <button onClick={() => navigate('/admin/engineers')} className="text-xs text-yellow-600 hover:underline">إدارة ←</button>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {workload.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">لا يوجد مهندسون نشطون</p>
            ) : workload.map(eng => {
              const active = eng.open + eng.in_progress
              const perm = PERM_CFG[eng.permission_level] || PERM_CFG.engineer
              return (
                <div key={eng.id} className="flex items-center gap-3 group">
                  <button onClick={() => navigate('/engineer-dashboard')}
                    className="w-9 h-9 rounded-xl bg-yellow-100 text-yellow-700 font-bold text-sm flex items-center justify-center flex-shrink-0 hover:bg-yellow-600 hover:text-white transition-colors">
                    {eng.name.charAt(0)}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm font-semibold text-slate-800 truncate">{eng.name}</span>
                      <span className={`badge text-[10px] ${perm.color}`}>{perm.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${active === 0 ? 'bg-slate-200' : active <= 2 ? 'bg-yellow-400' : active <= 5 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${(active / maxWork) * 100}%` }} />
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 ${active === 0 ? 'text-slate-400' : active <= 2 ? 'text-yellow-600' : active <= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                        {active} نشطة
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">{eng.total} إجمالي</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom row: Unassigned + Recent + Critical ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">

        {/* Unassigned tickets */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              ⚠️ تذاكر بدون مهندس
              {unassigned_list.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{unassigned_list.length}</span>
              )}
            </h3>
          </div>
          {unassigned_list.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-slate-500 text-sm">كل التذاكر معيّنة لمهندسين</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {unassigned_list.map(t => {
                const pri = PRIORITY_CFG[t.priority] || PRIORITY_CFG.medium
                return (
                  <div key={t.id} className="flex items-start gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100 hover:border-amber-300 transition-colors group">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${pri.dot}`} />
                    <div className="flex-1 min-w-0">
                      <button onClick={() => navigate(`/tickets/${t.id}`)}
                        className="text-sm font-medium text-slate-800 hover:text-yellow-600 text-start leading-snug truncate block w-full">
                        #{t.id} {t.title}
                      </button>
                      <p className="text-xs text-slate-400 mt-0.5">{t.requester_name || '—'} · {timeAgo(t.created_at)}</p>
                    </div>
                    <button
                      onClick={() => setAssignTarget(t)}
                      className="flex-shrink-0 text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-2.5 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      تعيين
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent tickets */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700">🕒 أحدث التذاكر</h3>
            <button onClick={() => navigate('/tickets')} className="text-xs text-yellow-600 hover:underline">الكل ←</button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {recent_tickets.map(t => {
              const stat = STATUS_CFG[t.status] || STATUS_CFG.open
              const pri  = PRIORITY_CFG[t.priority] || PRIORITY_CFG.medium
              return (
                <button key={t.id} onClick={() => navigate(`/tickets/${t.id}`)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-start group">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${pri.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-yellow-600">
                      #{t.id} {t.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`badge text-[10px] ${stat.badge}`}>{stat.label}</span>
                      {t.source === 'email' && <span className="text-[10px] text-purple-500">📧</span>}
                      {t.assigned_to
                        ? <span className="text-[11px] text-slate-400">👤 {t.assigned_to}</span>
                        : <span className="text-[11px] text-amber-500">⚠️ غير معيّن</span>}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-300 flex-shrink-0 mt-0.5">{timeAgo(t.created_at)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Critical tickets */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              🚨 التذاكر الحرجة
              {critical_list.length > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">{critical_list.length}</span>
              )}
            </h3>
          </div>
          {critical_list.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-slate-500 text-sm">لا توجد تذاكر حرجة</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {critical_list.map(t => {
                const stat = STATUS_CFG[t.status] || STATUS_CFG.open
                return (
                  <div key={t.id} className="p-3 bg-red-50 rounded-xl border border-red-200 hover:border-red-400 transition-colors">
                    <button onClick={() => navigate(`/tickets/${t.id}`)}
                      className="text-sm font-semibold text-red-900 hover:text-red-700 text-start leading-snug block w-full truncate">
                      #{t.id} {t.title}
                    </button>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`badge text-[10px] ${stat.badge}`}>{stat.label}</span>
                      {t.assigned_to
                        ? <span className="text-[11px] text-slate-500">👤 {t.assigned_to}</span>
                        : (
                          <button onClick={() => setAssignTarget(t)}
                            className="text-[11px] bg-red-600 text-white px-2 py-0.5 rounded-lg hover:bg-red-700 transition-colors">
                            ⚡ تعيين الآن
                          </button>
                        )}
                      <span className="text-[11px] text-red-400 mr-auto">{timeAgo(t.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Assign modal ── */}
      {assignTarget && assignTarget !== 'list' && (
        <AssignModal
          ticket={assignTarget}
          engineers={engineers}
          onAssign={handleAssign}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  )
}
