import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketReportsApi, ticketCategoriesApi } from '../api/client'
import StatCard from '../components/StatCard'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

function MiniBreakdown({ title, data, total, labelFor, noDataLabel }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]).slice(0, 6)
  return (
    <div className="card !p-4 space-y-2.5">
      <h3 className="font-bold text-slate-700 text-sm">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">{noDataLabel}</p>
      ) : entries.map(([key, count]) => (
        <div key={key} className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 w-28 shrink-0 truncate">{labelFor ? labelFor(key) : key}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
          </div>
          <span className="text-slate-700 font-bold w-8 text-left shrink-0">{count}</span>
        </div>
      ))}
    </div>
  )
}

export default function TicketDashboard() {
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    ticketReportsApi.data({}).then(r => setData(r.data)).finally(() => setLoading(false))
    ticketCategoriesApi.list().then(r => setCategories(r.data)).catch(() => {})
  }, [])

  if (loading || !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-lg">{t('common.loading')}</div>
    </div>
  )

  const priorityLabel = { low: t('priority.low'), medium: t('priority.medium'), high: t('priority.high'), critical: t('priority.critical') }
  const statusLabel = { open: t('status.open'), in_progress: t('status.in_progress'), resolved: t('status.resolved'), closed: t('status.closed') }
  const categoryLabel = {
    ...Object.fromEntries(categories.map(c => [c.value, language === 'en' ? (c.label_en || c.label) : c.label])),
    uncategorized: t('ticketReports.category.uncategorized'),
  }
  const slaLabel = {
    on_time: t('ticketReports.sla.onTime'), at_risk: t('ticketReports.sla.atRisk'),
    breached: t('ticketReports.sla.breached'), met: t('ticketReports.sla.met'),
  }

  const tickets = data.tickets || []
  const attention = tickets
    .filter(tk => ['open', 'in_progress'].includes(tk.status) && ['at_risk', 'breached'].includes(tk.sla_status))
    .slice(0, 8)
  const recent = tickets.slice(0, 8)
  const leaderboard = Object.entries(data.engineer_stats || {})
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6">
      <Header title={t('ticketDashboard.title')} subtitle={t('ticketDashboard.subtitle')} />

      <div className="flex items-center gap-2 px-1">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
        </span>
        <span className="text-sm text-yellow-600 font-semibold">{t('ticketDashboard.live')}</span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title={t('ticketReports.stat.total')} value={data.total} icon="🎫" color="blue" />
        <StatCard title={t('status.open')} value={data.by_status?.open || 0} icon="🔴" color="red" />
        <StatCard title={t('status.in_progress')} value={data.by_status?.in_progress || 0} icon="🟡" color="yellow" />
        <StatCard title={t('ticketReports.stat.slaBreached')} value={data.by_sla_status?.breached || 0} icon="⚠️" color="red" />
        <StatCard title={t('status.resolved')} value={data.by_status?.resolved || 0} icon="✅" color="green" />
        <StatCard title={t('status.closed')} value={data.by_status?.closed || 0} icon="🔒" color="slate" />
        <StatCard title={t('ticketReports.stat.avgResolution')} value={data.avg_resolution_hours ?? '—'} icon="⏱️" color="slate" />
        <StatCard title={t('ticketReports.csat.avgRating')} value={data.avg_csat_rating ?? '—'} icon="⭐" color="purple" subtitle={data.csat_count ? `${data.csat_count}` : ''} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MiniBreakdown title={t('ticketReports.breakdown.byPriority')} data={data.by_priority} total={data.total} labelFor={k => priorityLabel[k] || k} noDataLabel={t('ticketReports.breakdown.noData')} />
        <MiniBreakdown title={t('ticketReports.breakdown.byCategory')} data={data.by_category} total={data.total} labelFor={k => categoryLabel[k] || k} noDataLabel={t('ticketReports.breakdown.noData')} />
        <MiniBreakdown title={t('ticketReports.breakdown.bySla')} data={data.by_sla_status} total={data.total} labelFor={k => slaLabel[k] || k} noDataLabel={t('ticketReports.breakdown.noData')} />
      </div>

      {/* Engineer leaderboard */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h3 className="font-bold text-slate-700 text-sm">{t('ticketDashboard.leaderboard')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                {[
                  t('ticketDashboard.leaderboard.engineer'), t('ticketDashboard.leaderboard.tickets'),
                  t('ticketDashboard.leaderboard.avgResolution'), t('ticketDashboard.leaderboard.avgRating'),
                ].map(h => <th key={h} className="table-th">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leaderboard.map((e, i) => (
                <tr key={e.name} className="hover:bg-slate-50/50">
                  <td className="table-td font-medium text-slate-800">
                    {i === 0 && '🥇 '}{i === 1 && '🥈 '}{i === 2 && '🥉 '}{e.name}
                  </td>
                  <td className="table-td text-slate-600">{e.count}</td>
                  <td className="table-td text-slate-500">{e.avg_resolution_hours ?? '—'}</td>
                  <td className="table-td text-slate-500">{e.avg_csat_rating ? `⭐ ${e.avg_csat_rating}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Needs attention */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100">
            <h3 className="font-bold text-red-700 text-sm">{t('ticketDashboard.needsAttention')}</h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {attention.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">{t('ticketDashboard.noAttention')}</p>
            ) : attention.map(tk => (
              <button key={tk.id} onClick={() => navigate(`/tickets/${tk.id}`)}
                className="w-full flex items-center justify-between gap-3 px-5 py-3 text-start hover:bg-slate-50/70 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">#{tk.id} · {tk.title}</p>
                  <p className="text-xs text-slate-400">{tk.assigned_to || '—'} · {priorityLabel[tk.priority] || tk.priority}</p>
                </div>
                <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${tk.sla_status === 'breached' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  {slaLabel[tk.sla_status]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent tickets */}
        <div className="card !p-0 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-700 text-sm">{t('ticketDashboard.recentTickets')}</h3>
            <button onClick={() => navigate('/tickets')} className="text-xs text-yellow-600 font-medium hover:underline">{t('ticketDashboard.viewAllTickets')}</button>
          </div>
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">{t('ticketReports.noMatchingTickets')}</p>
            ) : recent.map(tk => (
              <button key={tk.id} onClick={() => navigate(`/tickets/${tk.id}`)}
                className="w-full flex items-center justify-between gap-3 px-5 py-3 text-start hover:bg-slate-50/70 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">#{tk.id} · {tk.title}</p>
                  <p className="text-xs text-slate-400">{tk.assigned_to || '—'} · {tk.created_at ? new Date(tk.created_at).toLocaleDateString() : ''}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">{statusLabel[tk.status] || tk.status}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center">
        <button onClick={() => navigate('/ticket-reports')} className="text-sm text-yellow-600 font-semibold hover:underline">
          {t('ticketDashboard.viewAllReports')}
        </button>
      </div>
    </div>
  )
}
