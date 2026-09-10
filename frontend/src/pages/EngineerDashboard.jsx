import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { engineersApi, ticketsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

const PRIORITY_STYLE = {
  critical: { badge: 'bg-red-100 text-red-700 font-bold',    dot: 'bg-red-500',    key: 'priority.critical' },
  high:     { badge: 'bg-yellow-100 text-yellow-700',        dot: 'bg-yellow-500', key: 'priority.high' },
  medium:   { badge: 'bg-amber-100 text-amber-700',          dot: 'bg-amber-400',  key: 'priority.medium' },
  low:      { badge: 'bg-slate-100 text-slate-500',          dot: 'bg-slate-300',  key: 'priority.low' },
}
const STATUS_STYLE = {
  open:        { badge: 'bg-red-100 text-red-600',           key: 'status.open' },
  in_progress: { badge: 'bg-yellow-100 text-yellow-700',   key: 'status.in_progress' },
  resolved:    { badge: 'bg-yellow-100 text-yellow-700',   key: 'status.resolved' },
  closed:      { badge: 'bg-slate-100 text-slate-500',       key: 'status.closed' },
}
const STATUS_NEXT = {
  open:        { actionKey: 'eng.startWork',    next: 'in_progress' },
  in_progress: { actionKey: 'eng.markResolved', next: 'resolved' },
}

// ── Engineer selector ───────────────────────────────────────────────────────
function EngineerSelector({ engineers, onSelect, t }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">👷</div>
          <h2 className="text-2xl font-bold text-slate-800">{t('eng.whoAreYou')}</h2>
          <p className="text-slate-500 text-sm mt-1">{t('eng.selectPrompt')}</p>
        </div>
        <div className="space-y-2">
          {engineers.filter(e => e.active === 'true').map(eng => (
            <button
              key={eng.id}
              onClick={() => onSelect(eng)}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border-2 border-slate-100 hover:border-yellow-400 hover:shadow-md transition-all text-start group"
            >
              <div className="w-12 h-12 rounded-xl bg-yellow-100 group-hover:bg-yellow-500 transition-colors flex items-center justify-center text-yellow-700 group-hover:text-white font-bold text-lg">
                {eng.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{eng.name}</p>
                <p className="text-sm text-slate-400">{eng.role}</p>
              </div>
              <span className="mr-auto text-slate-300 group-hover:text-yellow-500 text-xl">←</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Stat card ───────────────────────────────────────────────────────────────
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

// ── Main ────────────────────────────────────────────────────────────────────
export default function EngineerDashboard() {
  const navigate = useNavigate()
  const { engineer: authEngineer } = useAuth()
  const { t, language } = useLanguage()

  const [engineers, setEngineers] = useState([])
  const [engineer, setEngineer]   = useState(authEngineer)
  const [stats, setStats]         = useState(null)
  const [tickets, setTickets]     = useState([])
  const [activeTab, setActiveTab] = useState('active')
  const [loading, setLoading]     = useState(false)
  const [updatingId, setUpdatingId] = useState(null)

  const timeAgo = (dateStr) => {
    if (!dateStr) return ''
    const diff = (Date.now() - new Date(dateStr + 'Z')) / 1000
    if (diff < 60)     return t('time.now')
    if (diff < 3600)   return t('time.minutes').replace('{n}', Math.floor(diff / 60))
    if (diff < 86400)  return t('time.hours').replace('{n}', Math.floor(diff / 3600))
    if (diff < 604800) return t('time.days').replace('{n}', Math.floor(diff / 86400))
    return new Date(dateStr + 'Z').toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })
  }

  useEffect(() => {
    if (authEngineer?.permission_level === 'admin') {
      engineersApi.list().then(r => setEngineers(r.data))
    }
    setEngineer(authEngineer)
  }, [authEngineer])

  const loadData = useCallback(() => {
    if (!engineer) return
    setLoading(true)
    Promise.all([
      ticketsApi.engineerStats(engineer.name),
      ticketsApi.list({ assigned_to: engineer.name }),
    ]).then(([sRes, tRes]) => {
      setStats(sRes.data)
      setTickets(tRes.data)
    }).finally(() => setLoading(false))
  }, [engineer])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!engineer) return
    const id = setInterval(loadData, 60000)
    return () => clearInterval(id)
  }, [engineer, loadData])

  const selectEngineer = (eng) => {
    localStorage.setItem('selectedEngineer', JSON.stringify(eng))
    setEngineer(eng)
  }

  const handleStatus = async (ticketId, nextStatus) => {
    setUpdatingId(ticketId)
    try {
      await ticketsApi.updateStatus(ticketId, nextStatus)
      await loadData()
    } finally { setUpdatingId(null) }
  }

  if (!engineer) return null

  const sorted = [...tickets].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 9
    const pb = PRIORITY_ORDER[b.priority] ?? 9
    if (pa !== pb) return pa - pb
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const activeTickets   = sorted.filter(t => t.status === 'open' || t.status === 'in_progress')
  const resolvedTickets = sorted.filter(t => t.status === 'resolved' || t.status === 'closed')
  const displayed = activeTab === 'active' ? activeTickets
    : activeTab === 'resolved' ? resolvedTickets
    : sorted

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-600 flex items-center justify-center text-white font-bold text-xl">
            {engineer.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {t('eng.greeting').replace('{name}', engineer.name)}
            </h2>
            <p className="text-slate-500 text-sm">{engineer.role} · {t('eng.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {authEngineer?.permission_level === 'admin' && engineers.length > 0 && (
            <select
              className="form-select !py-1.5 !text-xs w-auto"
              value={engineer?.name || ''}
              onChange={e => {
                const eng = engineers.find(x => x.name === e.target.value)
                if (eng) setEngineer(eng)
              }}
            >
              {engineers.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          )}
          <button onClick={loadData} className="btn-secondary !py-2 !px-3 !text-xs">
            {t('eng.refresh')}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon="🔴" label={t('eng.statOpen')}       value={stats.open}                       color="border-red-400"     pulse />
          <StatCard icon="⚡" label={t('eng.statInProgress')} value={stats.in_progress}                color="border-amber-400" />
          <StatCard icon="✅" label={t('eng.statDone')}       value={stats.resolved + stats.closed}    color="border-yellow-400" />
          <StatCard icon="🎫" label={t('eng.statTotal')}      value={stats.total}                      color="border-slate-300" />
        </div>
      )}

      {/* Critical alert */}
      {stats?.critical > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl animate-bounce">🚨</span>
          <div>
            <p className="font-bold text-red-700 text-sm">
              {t('eng.criticalAlert').replace('{n}', stats.critical)}
            </p>
            <p className="text-red-500 text-xs mt-0.5">{t('eng.criticalSub')}</p>
          </div>
        </div>
      )}

      {/* Tabs + tickets */}
      <div className="card !p-0 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-100 bg-slate-50">
          {[
            { key: 'active',   labelKey: 'eng.tabActive',   count: activeTickets.length },
            { key: 'resolved', labelKey: 'eng.tabResolved', count: resolvedTickets.length },
            { key: 'all',      labelKey: 'eng.tabAll',      count: sorted.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.key
                  ? 'border-yellow-500 text-yellow-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t(tab.labelKey)}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab.key ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-500'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Ticket list */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">{t('eng.loading')}</div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">{activeTab === 'active' ? '🎉' : '📋'}</p>
            <p className="text-slate-500 font-medium">
              {activeTab === 'active' ? t('eng.noActive') : t('eng.noTickets')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {displayed.map(ticket => {
              const pri  = PRIORITY_STYLE[ticket.priority] || PRIORITY_STYLE.medium
              const stat = STATUS_STYLE[ticket.status]     || STATUS_STYLE.open
              const next = STATUS_NEXT[ticket.status]
              const isCritical = ticket.priority === 'critical' && !['resolved','closed'].includes(ticket.status)

              return (
                <div
                  key={ticket.id}
                  className={`p-4 hover:bg-slate-50/60 transition-colors ${isCritical ? 'border-r-4 border-red-400' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${pri.dot}`} />

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="flex items-start gap-2 flex-wrap">
                        <button
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="font-semibold text-slate-800 hover:text-yellow-600 text-sm text-start leading-snug flex-1"
                        >
                          {ticket.title}
                        </button>
                        <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5">#{ticket.id}</span>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`badge text-xs ${stat.badge}`}>{t(stat.key)}</span>
                        <span className={`badge text-xs ${pri.badge}`}>{t(pri.key)}</span>
                        {ticket.requester_name && (
                          <span className="text-xs text-slate-400">👤 {ticket.requester_name}</span>
                        )}
                        {ticket.department?.name && (
                          <span className="text-xs text-slate-400">🏢 {ticket.department.name}</span>
                        )}
                        <span className="text-xs text-slate-300 mr-auto">{timeAgo(ticket.created_at)}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        {next && (
                          <button
                            onClick={() => handleStatus(ticket.id, next.next)}
                            disabled={updatingId === ticket.id}
                            className="btn-success !text-xs !py-1 !px-3 disabled:opacity-50"
                          >
                            {updatingId === ticket.id ? '...' : t(next.actionKey)}
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className="btn-secondary !text-xs !py-1 !px-3"
                        >
                          {t('eng.viewDetails')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
