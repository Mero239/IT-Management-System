import { useEffect, useState } from 'react'
import { reportsApi } from '../api/client'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

const COLORS = ['#ca8a04', '#eab308', '#facc15', '#fde047', '#a16207', '#713f12']

export default function Reports() {
  const { t } = useLanguage()
  const [byType, setByType] = useState([])
  const [byStatus, setByStatus] = useState([])
  const [byDept, setByDept] = useState([])
  const [ticketsPriority, setTicketsPriority] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      reportsApi.byType(),
      reportsApi.byStatus(),
      reportsApi.byDepartment(),
      reportsApi.ticketsByPriority(),
    ]).then(([ty, st, dp, tp]) => {
      setByType(ty.data.map((r) => ({ name: t(`type.${r.type}`), value: r.count })))
      setByStatus(st.data.map((r) => ({ name: t(`status.${r.status}`), value: r.count })))
      setByDept(dp.data.map((r) => ({ name: r.department, value: r.count })))
      setTicketsPriority(tp.data.map((r) => ({ name: t(`priority.${r.priority}`), value: r.count })))
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-lg">{t('common.loading')}</div>
  )

  const ChartCard = ({ title, children, data }) => (
    <div className="card">
      <h3 className="font-bold text-slate-700 mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-slate-400 text-center py-8">{t('reports.noData')}</p>
      ) : children}
    </div>
  )

  return (
    <div className="space-y-6">
      <Header title={t('reports.title')} subtitle={t('reports.subtitle')} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t('reports.assetsByType')} data={byType}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}>
                {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('reports.assetsByStatus')} data={byStatus}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byStatus} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" name={t('reports.count')} radius={[6, 6, 0, 0]}>
                {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('reports.assetsByDept')} data={byDept}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byDept} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={110} />
              <Tooltip />
              <Bar dataKey="value" name={t('reports.count')} fill="#ca8a04" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('reports.ticketsByPriority')} data={ticketsPriority}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={ticketsPriority} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}>
                {ticketsPriority.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
