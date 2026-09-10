import { useEffect, useState } from 'react'
import { reportsApi } from '../api/client'
import StatCard from '../components/StatCard'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'
import { useTheme, THEMES } from '../context/ThemeContext'

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
      <span className="text-xs text-slate-400 font-medium">🎨 الثيم</span>
      <div className="flex gap-1.5">
        {Object.entries(THEMES).map(([key, t]) => (
          <button
            key={key}
            onClick={() => setTheme(key)}
            title={t.label}
            className={`w-6 h-6 rounded-full transition-all ${theme === key ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`}
            style={{ backgroundColor: t.swatch }}
          >
            {theme === key && <span className="text-white text-xs">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { t } = useLanguage()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reportsApi.stats().then((r) => setStats(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-lg">{t('common.loading')}</div>
    </div>
  )

  return (
    <div className="space-y-6">
      <Header title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      {/* Activity indicator + theme switcher */}
      <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 px-1">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
        </span>
        <span className="text-sm text-yellow-600 font-semibold">{t('dashboard.systemActive')}</span>
        <span className="text-xs text-slate-400">· {stats.active_assets} {t('dashboard.unitActive')}</span>
      </div>
      <ThemeSwitcher />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard title={t('dashboard.totalAssets')}    value={stats.total_assets}      icon="🖥️"  color="blue" />
        <StatCard title={t('dashboard.activeAssets')}   value={stats.active_assets}     icon="✅"  color="green"  subtitle={`${Math.round(stats.active_assets / (stats.total_assets || 1) * 100)}% ${t('dashboard.unitOfTotal')}`} />
        <StatCard title={t('dashboard.needsRequests')}  value={stats.total_requests}    icon="📋"  color="blue" subtitle={`${stats.pending_requests} ${t('dashboard.unitPending')}`} />
        <StatCard title={t('dashboard.supportTickets')} value={stats.total_tickets}     icon="🎫"  color="purple" subtitle={`${stats.open_tickets} ${t('dashboard.unitOpen')}`} />
        <StatCard title={t('dashboard.departments')}    value={stats.total_departments} icon="🏢"  color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-bold text-slate-700 mb-4 text-base">{t('dashboard.assetStatus')}</h3>
          <div className="space-y-3">
            {[
              { label: t('dashboard.labelActive'), value: stats.active_assets, total: stats.total_assets, color: 'bg-yellow-500' },
              { label: t('dashboard.labelMaintenance'), value: stats.maintenance_assets, total: stats.total_assets, color: 'bg-yellow-500' },
              { label: t('dashboard.labelRetired'), value: stats.retired_assets, total: stats.total_assets, color: 'bg-slate-400' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: item.total ? `${(item.value / item.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold text-slate-700 mb-4 text-base">{t('dashboard.requestsStatus')}</h3>
          <div className="space-y-3">
            {[
              { label: t('dashboard.labelPending'), value: stats.pending_requests, color: 'text-yellow-600 bg-yellow-50' },
              { label: t('dashboard.labelApproved'), value: stats.approved_requests, color: 'text-yellow-600 bg-yellow-50' },
              { label: t('dashboard.labelRejected'), value: stats.rejected_requests, color: 'text-red-600 bg-red-50' },
            ].map((item) => (
              <div key={item.label} className={`flex items-center justify-between p-3 rounded-xl ${item.color}`}>
                <span className="text-sm font-medium">{item.label}</span>
                <span className="font-bold text-lg">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold text-slate-700 mb-4 text-base">{t('dashboard.ticketsStatus')}</h3>
          <div className="space-y-3">
            {[
              { label: t('dashboard.labelOpen'), value: stats.open_tickets, color: 'text-red-600 bg-red-50' },
              { label: t('dashboard.labelInProgress'), value: stats.in_progress_tickets, color: 'text-yellow-600 bg-yellow-50' },
              { label: t('dashboard.labelResolved'), value: stats.resolved_tickets, color: 'text-yellow-600 bg-yellow-50' },
            ].map((item) => (
              <div key={item.label} className={`flex items-center justify-between p-3 rounded-xl ${item.color}`}>
                <span className="text-sm font-medium">{item.label}</span>
                <span className="font-bold text-lg">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
