import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketsApi } from '../api/client'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

const SLA_COLORS = {
  on_time:  'bg-yellow-100 text-yellow-700',
  at_risk:  'bg-amber-100 text-amber-700',
  breached: 'bg-red-100 text-red-700 font-semibold',
  met:      'bg-slate-100 text-slate-600',
}
const SLA_ICONS = { on_time: '🟢', at_risk: '🟠', breached: '🔴', met: '✅' }

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700 font-semibold',
}

function formatRemaining(dueAt, t) {
  const diffMs = new Date(dueAt) - new Date()
  const abs = Math.abs(diffMs)
  const hours = Math.floor(abs / 3600000)
  const days = Math.floor(hours / 24)
  const label = days >= 1 ? `${days}${t('sla.dayShort')}` : `${hours}${t('sla.hourShort')}`
  return diffMs >= 0 ? `${label} ${t('sla.remaining')}` : `${label} ${t('sla.overdue')}`
}

export default function SLA() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const load = () => {
    setLoading(true)
    ticketsApi.list({}).then((r) => setItems(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  const openTickets = items.filter((i) => !['resolved', 'closed'].includes(i.status))
  const closedTickets = items.filter((i) => ['resolved', 'closed'].includes(i.status))

  const counts = {
    breached: openTickets.filter((i) => i.sla_status === 'breached').length,
    at_risk: openTickets.filter((i) => i.sla_status === 'at_risk').length,
    on_time: openTickets.filter((i) => i.sla_status === 'on_time').length,
    met: closedTickets.filter((i) => i.sla_status === 'met').length,
  }

  const displayed = items
    .filter((i) => !filter || i.sla_status === filter)
    .sort((a, b) => new Date(a.sla_due_at) - new Date(b.sla_due_at))

  return (
    <div className="space-y-4">
      <Header title={t('sla.title')} subtitle={t('sla.subtitle')} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'breached', label: t('sla.stat.breached'), value: counts.breached, bg: 'bg-red-50 border-red-200', text: 'text-red-600' },
          { key: 'at_risk',  label: t('sla.stat.atRisk'),    value: counts.at_risk,  bg: 'bg-amber-50 border-amber-200', text: 'text-amber-600' },
          { key: 'on_time',  label: t('sla.stat.onTime'),    value: counts.on_time,  bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
          { key: 'met',      label: t('sla.stat.met'),       value: counts.met,      bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(filter === s.key ? '' : s.key)}
            className={`rounded-2xl border-2 p-4 text-start transition-all ${s.bg} ${filter === s.key ? 'ring-2 ring-offset-1 ring-yellow-400' : ''}`}
          >
            <p className={`text-3xl font-bold ${s.text}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="card !p-4 flex items-center gap-3 flex-wrap">
        <p className="text-sm text-slate-500">{t('sla.policyLabel')}</p>
        <span className="badge bg-red-100 text-red-700">{t('priority.critical')}: 4{t('sla.hourShort')}</span>
        <span className="badge bg-yellow-100 text-yellow-700">{t('priority.high')}: 24{t('sla.hourShort')}</span>
        <span className="badge bg-yellow-100 text-yellow-700">{t('priority.medium')}: 3{t('sla.dayShort')}</span>
        <span className="badge bg-slate-100 text-slate-600">{t('priority.low')}: 7{t('sla.dayShort')}</span>
        {filter && (
          <button onClick={() => setFilter('')} className="text-slate-400 hover:text-slate-600 text-sm ms-auto">
            ✕ {t('sla.clearFilter')}
          </button>
        )}
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['col.id', 'col.title', 'col.priority', 'col.status', 'col.dueAt', 'col.sla'].map((k) => (
                <th key={k} className="table-th">{t(`sla.${k}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={6} className="table-td text-center py-12 text-slate-400">{t('common.loading')}</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={6} className="table-td text-center py-12 text-slate-400">{t('sla.empty')}</td></tr>
            ) : displayed.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="table-td text-slate-400 text-xs">#{item.id}</td>
                <td className="table-td">
                  <button onClick={() => navigate(`/tickets/${item.id}`)} className="font-medium text-yellow-600 hover:underline text-start">
                    {item.title}
                  </button>
                </td>
                <td className="table-td">
                  <span className={`badge ${PRIORITY_COLORS[item.priority]}`}>{t(`priority.${item.priority}`)}</span>
                </td>
                <td className="table-td text-slate-500">{t(`status.${item.status}`)}</td>
                <td className="table-td text-slate-500 text-xs">
                  {item.sla_due_at ? (
                    <>
                      {new Date(item.sla_due_at).toLocaleString()}
                      <br />
                      <span className={['resolved', 'closed'].includes(item.status) ? 'text-slate-400' : item.sla_status === 'breached' ? 'text-red-500' : 'text-slate-400'}>
                        {['resolved', 'closed'].includes(item.status) ? '' : formatRemaining(item.sla_due_at, t)}
                      </span>
                    </>
                  ) : '—'}
                </td>
                <td className="table-td">
                  <span className={`badge ${SLA_COLORS[item.sla_status]}`}>
                    {SLA_ICONS[item.sla_status]} {t(`sla.status.${item.sla_status}`)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
