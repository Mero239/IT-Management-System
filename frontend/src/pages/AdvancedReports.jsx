import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'

// ── config ────────────────────────────────────────────────────────────────────
const PERIODS = [
  { label: 'آخر 7 أيام',   days: 7 },
  { label: 'آخر 30 يوماً', days: 30 },
  { label: 'آخر 90 يوماً', days: 90 },
  { label: 'آخر سنة',      days: 365 },
  { label: 'كل الوقت',     days: 0 },
]

const TABS = [
  { id: 'summary',     label: 'ملخص تنفيذي',        icon: '📊' },
  { id: 'tickets',     label: 'تذاكر الدعم',          icon: '🎫' },
  { id: 'engineers',   label: 'أداء المهندسين',       icon: '👷' },
  { id: 'assets',      label: 'الأصول والطلبات',      icon: '🖥️' },
]

const PRI_CFG = {
  critical: { label: 'حرجة',   color: '#ef4444', bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700' },
  high:     { label: 'عالية',  color: '#f97316', bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
  medium:   { label: 'متوسطة', color: '#f59e0b', bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700' },
  low:      { label: 'منخفضة', color: '#94a3b8', bar: 'bg-slate-300',  badge: 'bg-slate-100 text-slate-500' },
}

const STAT_COLORS = {
  open:        { color: '#ef4444', label: 'مفتوحة' },
  in_progress: { color: '#f59e0b', label: 'جارية' },
  resolved:    { color: '#10b981', label: 'محلولة' },
  closed:      { color: '#94a3b8', label: 'مغلقة' },
  active:      { color: '#10b981', label: 'نشط' },
  inactive:    { color: '#94a3b8', label: 'غير نشط' },
  maintenance: { color: '#f59e0b', label: 'صيانة' },
  retired:     { color: '#ef4444', label: 'متقاعد' },
  pending:     { color: '#f59e0b', label: 'قيد الانتظار' },
  approved:    { color: '#10b981', label: 'موافق' },
  rejected:    { color: '#ef4444', label: 'مرفوض' },
  fulfilled:   { color: '#6366f1', label: 'منجز' },
}

const ASSET_COLORS = ['#ca8a04','#eab308','#facc15','#fde047','#a16207','#fef08a']
const CHART_COLORS = ['#ca8a04','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#06b6d4']

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtHours(h) {
  if (h === null || h === undefined) return '—'
  if (h < 1)   return `${Math.round(h * 60)} د`
  if (h < 24)  return `${h.toFixed(1)} س`
  return `${(h / 24).toFixed(1)} ي`
}

function exportCSV(rows, filename) {
  const keys = Object.keys(rows[0] || {})
  const csv  = [keys.join(','), ...rows.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── sub-components ────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, sub, color = '' }) {
  return (
    <div className={`card !p-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── TAB: Summary ──────────────────────────────────────────────────────────────
function TabSummary({ data }) {
  const { kpi, trend, source, top_requesters, priority_stats } = data
  const totalPri = priority_stats.reduce((s, p) => s + p.total, 0)

  const trendSlice = trend.length > 30 ? trend.filter((_, i) => i % 2 === 0) : trend

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon="🎫" label="إجمالي التذاكر"   value={kpi.total} />
        <KPICard icon="🔴" label="نشطة (مفتوحة+جارية)"
          value={kpi.open + kpi.in_progress}
          sub={`${kpi.open} مفتوحة · ${kpi.in_progress} جارية`}
          color={kpi.open > 0 ? 'border-l-4 border-l-red-400' : ''} />
        <KPICard icon="✅" label="محلولة ومغلقة"
          value={kpi.resolved + kpi.closed}
          sub={`معدل الإنجاز ${kpi.resolution_rate}%`}
          color="border-l-4 border-l-yellow-400" />
        <KPICard icon="⚠️" label="غير معيّنة"        value={kpi.unassigned}
          color={kpi.unassigned > 0 ? 'border-l-4 border-l-amber-400' : ''} />
      </div>

      {/* Trend + Source */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card lg:col-span-2">
          <h3 className="font-bold text-slate-700 mb-4">📈 منحنى إنشاء وحل التذاكر</h3>
          {trendSlice.every(t => t.created === 0 && t.resolved === 0) ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">لا توجد بيانات في هذه الفترة</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendSlice} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="created"  name="مُنشأة"  stroke="#ef4444" fill="url(#gCreated)"  strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="resolved" name="محلولة"  stroke="#10b981" fill="url(#gResolved)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Source + resolution rate */}
        <div className="space-y-4">
          <div className="card !p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-3">📨 مصدر التذاكر</h3>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden flex">
                {kpi.total > 0 && <>
                  <div className="h-full bg-purple-500 rounded-r-full transition-all" style={{ width: `${source.email / kpi.total * 100}%` }} />
                  <div className="h-full bg-yellow-400 rounded-l-full transition-all" style={{ width: `${source.manual / kpi.total * 100}%` }} />
                </>}
              </div>
            </div>
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-purple-500 rounded-full" />📧 بريد: <strong>{source.email}</strong></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-yellow-400 rounded-full" />✋ يدوي: <strong>{source.manual}</strong></span>
            </div>
          </div>

          <div className="card !p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-3">📊 معدل الإنجاز</h3>
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3"
                    strokeDasharray={`${kpi.resolution_rate} ${100 - kpi.resolution_rate}`}
                    strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">{kpi.resolution_rate}%</span>
              </div>
              <div className="text-xs space-y-1">
                <p className="text-slate-600"><span className="font-semibold text-yellow-600">{kpi.resolved + kpi.closed}</span> محلول</p>
                <p className="text-slate-500">{kpi.open + kpi.in_progress} لا يزال نشطاً</p>
              </div>
            </div>
          </div>

          <div className="card !p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-2">🚨 حرجة / غير معيّنة</h3>
            <div className="flex gap-2">
              <div className="flex-1 bg-red-50 rounded-xl p-2.5 text-center border border-red-100">
                <p className="font-bold text-red-600 text-xl">{kpi.critical_open}</p>
                <p className="text-[10px] text-red-400">حرجة</p>
              </div>
              <div className="flex-1 bg-amber-50 rounded-xl p-2.5 text-center border border-amber-100">
                <p className="font-bold text-amber-600 text-xl">{kpi.unassigned}</p>
                <p className="text-[10px] text-amber-400">غير معيّنة</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Priority + Top requesters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="font-bold text-slate-700 mb-4">🎯 التذاكر حسب الأولوية</h3>
          <div className="space-y-3">
            {priority_stats.map(p => {
              const cfg = PRI_CFG[p.priority]
              const pct = totalPri > 0 ? Math.round(p.total / totalPri * 100) : 0
              return (
                <div key={p.priority}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="text-yellow-600 font-medium">{p.resolved} محلول</span>
                      <span>·</span>
                      <span>⏱ {fmtHours(p.avg_resolution_hours)}</span>
                      <span className="font-bold text-slate-800 text-sm w-6 text-left">{p.total}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${cfg.bar} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700">🏆 أكثر المُبلِّغين طلباً</h3>
            {top_requesters.length > 0 && (
              <button onClick={() => exportCSV(top_requesters, 'top_requesters.csv')}
                className="text-xs text-yellow-600 hover:underline">تصدير ↓</button>
            )}
          </div>
          {top_requesters.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">لا توجد بيانات</p>
          ) : (
            <div className="space-y-2">
              {top_requesters.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-50 text-slate-400'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm text-slate-700 font-medium truncate">{r.name}</span>
                      <span className="font-bold text-slate-800 flex-shrink-0">{r.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full"
                        style={{ width: `${top_requesters[0] ? (r.count / top_requesters[0].count) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── TAB: Tickets ──────────────────────────────────────────────────────────────
function TabTickets({ data }) {
  const { dept_breakdown, priority_stats, source } = data
  const maxDept = Math.max(...dept_breakdown.map(d => d.total), 1)

  const deptBarData = dept_breakdown.slice(0, 8).map(d => ({
    name: d.dept,
    مفتوحة:  d.open,
    جارية:   d.in_progress,
    محلولة:  d.resolved,
  }))

  const priorityPieData = priority_stats
    .filter(p => p.total > 0)
    .map(p => ({ name: PRI_CFG[p.priority].label, value: p.total, color: PRI_CFG[p.priority].color }))

  const sourcePie = [
    { name: 'بريد إلكتروني', value: source.email,  color: '#8b5cf6' },
    { name: 'يدوي',           value: source.manual, color: '#10b981' },
  ].filter(s => s.value > 0)

  return (
    <div className="space-y-5">
      {/* Dept stacked bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700">🏢 التذاكر حسب القسم</h3>
          {dept_breakdown.length > 0 && (
            <button onClick={() => exportCSV(dept_breakdown, 'dept_breakdown.csv')}
              className="text-xs text-yellow-600 hover:underline">تصدير CSV ↓</button>
          )}
        </div>
        {deptBarData.length === 0 ? (
          <p className="text-slate-400 text-center py-8 text-sm">لا توجد بيانات</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={deptBarData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="مفتوحة"  stackId="a" fill="#ef4444" radius={[0,0,0,0]} />
              <Bar dataKey="جارية"   stackId="a" fill="#f59e0b" />
              <Bar dataKey="محلولة"  stackId="a" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Priority pie + Source pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card">
          <h3 className="font-bold text-slate-700 mb-4">🎯 توزيع الأولوية</h3>
          {priorityPieData.length === 0 ? (
            <p className="text-slate-400 text-center py-8 text-sm">لا توجد بيانات</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={priorityPieData} dataKey="value" cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {priorityPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {priorityPieData.map(p => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                      {p.name}
                    </span>
                    <strong>{p.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-bold text-slate-700 mb-4">📨 مصدر التذاكر</h3>
          {sourcePie.length === 0 ? (
            <p className="text-slate-400 text-center py-8 text-sm">لا توجد بيانات</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={sourcePie} dataKey="value" cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {sourcePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {sourcePie.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <strong>{s.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dept detail table */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700">📋 تفصيل الأقسام</h3>
        </div>
        {dept_breakdown.length === 0 ? (
          <p className="text-slate-400 text-center py-6 text-sm">لا توجد بيانات</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-right py-2 pr-0 pl-4 text-slate-500 font-medium">القسم</th>
                <th className="text-center py-2 px-3 text-slate-500 font-medium">مفتوحة</th>
                <th className="text-center py-2 px-3 text-slate-500 font-medium">جارية</th>
                <th className="text-center py-2 px-3 text-slate-500 font-medium">محلولة</th>
                <th className="text-center py-2 px-3 text-slate-500 font-medium">المجموع</th>
                <th className="text-right py-2 px-3 text-slate-500 font-medium w-32">التوزيع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dept_breakdown.map(d => (
                <tr key={d.dept} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 pr-0 pl-4 font-medium text-slate-700">{d.dept}</td>
                  <td className="text-center py-2.5 px-3"><span className="text-red-600 font-medium">{d.open}</span></td>
                  <td className="text-center py-2.5 px-3"><span className="text-amber-600 font-medium">{d.in_progress}</span></td>
                  <td className="text-center py-2.5 px-3"><span className="text-yellow-600 font-medium">{d.resolved}</span></td>
                  <td className="text-center py-2.5 px-3 font-bold text-slate-800">{d.total}</td>
                  <td className="py-2.5 px-3">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-red-400" style={{ width: `${d.total > 0 ? d.open/d.total*100 : 0}%` }} />
                      <div className="h-full bg-amber-400" style={{ width: `${d.total > 0 ? d.in_progress/d.total*100 : 0}%` }} />
                      <div className="h-full bg-yellow-400" style={{ width: `${d.total > 0 ? d.resolved/d.total*100 : 0}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── TAB: Engineers ────────────────────────────────────────────────────────────
function TabEngineers({ data }) {
  const { engineer_performance } = data
  const [sort, setSort] = useState({ key: 'resolved', dir: -1 })
  const toggle = (key) => setSort(s => ({ key, dir: s.key === key ? -s.dir : -1 }))

  const sorted = [...engineer_performance].sort((a, b) => {
    const av = a[sort.key] ?? -1, bv = b[sort.key] ?? -1
    return (av - bv) * sort.dir
  })

  const chartData = engineer_performance
    .filter(e => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map(e => ({ name: e.name.split(' ')[0], مفتوحة: e.open, جارية: e.in_progress, محلولة: e.resolved }))

  const SortBtn = ({ k, children }) => (
    <button onClick={() => toggle(k)}
      className="flex items-center gap-1 hover:text-yellow-600 transition-colors whitespace-nowrap">
      {children}
      <span className="text-[10px]">{sort.key === k ? (sort.dir === -1 ? '▼' : '▲') : '⇅'}</span>
    </button>
  )

  return (
    <div className="space-y-5">
      {/* Workload chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700">📊 مقارنة عبء العمل (أول 8 مهندسين)</h3>
          <button onClick={() => exportCSV(engineer_performance.map(e => ({
            الاسم: e.name, الدور: e.role,
            مفتوحة: e.open, جارية: e.in_progress, محلولة: e.resolved, المجموع: e.total,
            'متوسط الحل (ساعة)': e.avg_resolution_hours ?? '—'
          })), 'engineer_performance.csv')}
            className="text-xs text-yellow-600 hover:underline">تصدير CSV ↓</button>
        </div>
        {chartData.length === 0 ? (
          <p className="text-slate-400 text-center py-8 text-sm">لا توجد بيانات</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="مفتوحة"  stackId="a" fill="#ef4444" />
              <Bar dataKey="جارية"   stackId="a" fill="#f59e0b" />
              <Bar dataKey="محلولة"  stackId="a" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Performance table */}
      <div className="card overflow-x-auto">
        <h3 className="font-bold text-slate-700 mb-4">🏆 جدول أداء المهندسين</h3>
        {engineer_performance.length === 0 ? (
          <p className="text-slate-400 text-center py-6 text-sm">لا توجد مهندسون</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-medium">
                <th className="text-right py-2 pr-0 pl-3">#</th>
                <th className="text-right py-2 px-3">المهندس</th>
                <th className="text-center py-2 px-3"><SortBtn k="open">مفتوحة</SortBtn></th>
                <th className="text-center py-2 px-3"><SortBtn k="in_progress">جارية</SortBtn></th>
                <th className="text-center py-2 px-3"><SortBtn k="resolved">محلولة</SortBtn></th>
                <th className="text-center py-2 px-3"><SortBtn k="total">المجموع</SortBtn></th>
                <th className="text-center py-2 px-3"><SortBtn k="avg_resolution_hours">متوسط الحل</SortBtn></th>
                <th className="text-right py-2 px-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.map((e, i) => {
                const rate = e.total > 0 ? Math.round(e.resolved / e.total * 100) : 0
                return (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-0 pl-3 text-slate-400 text-xs">{i+1}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-yellow-100 text-yellow-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {e.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{e.name}</p>
                          <p className="text-[11px] text-slate-400">{e.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-3 px-3 font-medium text-red-600">{e.open}</td>
                    <td className="text-center py-3 px-3 font-medium text-amber-600">{e.in_progress}</td>
                    <td className="text-center py-3 px-3 font-medium text-yellow-600">{e.resolved}</td>
                    <td className="text-center py-3 px-3 font-bold text-slate-800">{e.total}</td>
                    <td className="text-center py-3 px-3 text-slate-600">{fmtHours(e.avg_resolution_hours)}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${rate >= 70 ? 'bg-yellow-400' : rate >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-[11px] text-slate-500">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── TAB: Assets & Requests ────────────────────────────────────────────────────
function TabAssets({ data }) {
  const { assets, requests } = data

  const assetTypePie = assets.by_type.map((a, i) => ({
    name: a.type, value: a.count, color: ASSET_COLORS[i % ASSET_COLORS.length]
  }))
  const assetStatusBar = assets.by_status.map(a => ({
    name: STAT_COLORS[a.status]?.label || a.status,
    count: a.count,
    fill: STAT_COLORS[a.status]?.color || '#94a3b8',
  }))
  const reqStatusBar = requests.by_status.map(r => ({
    name: STAT_COLORS[r.status]?.label || r.status,
    count: r.count,
    fill: STAT_COLORS[r.status]?.color || '#94a3b8',
  }))

  return (
    <div className="space-y-5">
      {/* Asset KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon="🖥️" label="إجمالي الأصول"       value={assets.total} />
        <KPICard icon="✅" label="نشط"
          value={assets.by_status.find(s => s.status === 'active')?.count ?? 0}
          color="border-l-4 border-l-yellow-400" />
        <KPICard icon="🔧" label="صيانة"
          value={assets.by_status.find(s => s.status === 'maintenance')?.count ?? 0}
          color="border-l-4 border-l-amber-400" />
        <KPICard icon="📋" label="إجمالي الطلبات"      value={requests.total} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Asset by type */}
        <div className="card">
          <h3 className="font-bold text-slate-700 mb-4">🖥️ الأصول حسب النوع</h3>
          {assetTypePie.length === 0 ? (
            <p className="text-slate-400 text-center py-8 text-sm">لا توجد أصول</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={assetTypePie} dataKey="value" cx="50%" cy="50%"
                    innerRadius={40} outerRadius={70} paddingAngle={3}>
                    {assetTypePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {assetTypePie.map(a => (
                  <div key={a.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: a.color }} />
                      <span className="text-slate-600">{a.name}</span>
                    </span>
                    <strong className="text-slate-800">{a.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Asset by status */}
        <div className="card">
          <h3 className="font-bold text-slate-700 mb-4">📊 حالة الأصول</h3>
          {assetStatusBar.length === 0 ? (
            <p className="text-slate-400 text-center py-8 text-sm">لا توجد أصول</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={assetStatusBar} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="عدد" radius={[6, 6, 0, 0]}>
                  {assetStatusBar.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Requests by status */}
      <div className="card">
        <h3 className="font-bold text-slate-700 mb-4">📋 طلبات الاحتياجات حسب الحالة</h3>
        {reqStatusBar.length === 0 ? (
          <p className="text-slate-400 text-center py-6 text-sm">لا توجد طلبات</p>
        ) : (
          <div className="flex items-start gap-6">
            <ResponsiveContainer width="60%" height={180}>
              <BarChart data={reqStatusBar} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="عدد" radius={[6, 6, 0, 0]}>
                  {reqStatusBar.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-3 flex-1">
              {reqStatusBar.map(r => (
                <div key={r.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: r.fill }} />
                    {r.name}
                  </span>
                  <span className="font-bold text-slate-800">{r.count}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between text-sm font-bold">
                  <span>المجموع</span>
                  <span>{requests.total}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdvancedReports() {
  const { engineer: me } = useAuth()
  const navigate   = useNavigate()
  const [tab, setTab]     = useState('summary')
  const [days, setDays]   = useState(30)
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  const load = useCallback(async (d, silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await reportsApi.advanced(d)
      setData(res.data)
      setLastUpdate(new Date())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(days) }, [days])

  const handleExportAll = () => {
    if (!data) return
    exportCSV(data.engineer_performance.map(e => ({
      الاسم: e.name, الدور: e.role,
      مفتوحة: e.open, جارية: e.in_progress, محلولة: e.resolved, المجموع: e.total,
      'متوسط_الحل_ساعة': e.avg_resolution_hours ?? '',
    })), `تقرير_المهندسين_${new Date().toLocaleDateString('ar-EG').replace(/\//g,'-')}.csv`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-3 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">جاري تحميل التقارير...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            📊 التقارير المتقدمة
            {refreshing && <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full animate-pulse">تحديث...</span>}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {PERIODS.find(p => p.days === days)?.label}
            {lastUpdate && <span className="text-slate-400 mr-2">· {lastUpdate.toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
            {PERIODS.map(p => (
              <button key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${days === p.days ? 'bg-white text-yellow-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => load(days, true)} className="btn-secondary !py-1.5 !px-3 text-sm gap-1.5">🔄</button>
          <button onClick={handleExportAll} className="btn-secondary !py-1.5 !px-3 text-sm gap-1.5">📥 تصدير</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-yellow-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>
            <span className="hidden sm:inline">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === 'summary'   && <TabSummary   data={data} />}
      {tab === 'tickets'   && <TabTickets   data={data} />}
      {tab === 'engineers' && <TabEngineers data={data} />}
      {tab === 'assets'    && <TabAssets    data={data} />}
    </div>
  )
}
