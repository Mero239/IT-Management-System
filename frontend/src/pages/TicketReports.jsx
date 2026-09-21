import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { ticketReportsApi, departmentsApi, organizationsApi, branchesApi, engineersApi, ticketCategoriesApi } from '../api/client'
import Modal from '../components/Modal'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const SOURCES = ['manual', 'email', 'telegram', 'whatsapp']

const emptyFilters = {
  date_from: '', date_to: '', status: '', priority: '', category: '',
  organization_id: '', branch_id: '', department_id: '', assigned_to: '', source: '',
}

function BreakdownCard({ title, data, total, labelFor, noDataLabel }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1])
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

export default function TicketReports() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ ...emptyFilters })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [branches, setBranches] = useState([])
  const [engineers, setEngineers] = useState([])
  const [categories, setCategories] = useState([])
  const [presets, setPresets] = useState([])
  const [saveModal, setSaveModal] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('overview') // overview | ratings

  const loadPresets = () => ticketReportsApi.listPresets().then(r => setPresets(r.data)).catch(() => {})

  useEffect(() => {
    departmentsApi.list().then(r => setDepartments(r.data))
    organizationsApi.list().then(r => setOrganizations(r.data))
    branchesApi.list().then(r => setBranches(r.data))
    engineersApi.list().then(r => setEngineers(r.data))
    ticketCategoriesApi.list().then(r => setCategories(r.data))
    loadPresets()
  }, [])

  const runReport = () => {
    setLoading(true)
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    ticketReportsApi.data(params).then(r => setData(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { runReport() }, []) // eslint-disable-line

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }))
  const clearFilters = () => { setFilters({ ...emptyFilters }); setTimeout(runReport, 0) }

  const applyPreset = (preset) => {
    setFilters({ ...emptyFilters, ...preset.filters })
    setTimeout(runReport, 0)
  }

  const handleSavePreset = async () => {
    if (!presetName.trim()) return
    setSaving(true)
    try {
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      await ticketReportsApi.savePreset(presetName.trim(), activeFilters)
      setSaveModal(false); setPresetName('')
      loadPresets()
    } finally { setSaving(false) }
  }

  const handleDeletePreset = async (id) => {
    if (!confirm(t('ticketReports.deleteSavedConfirm'))) return
    await ticketReportsApi.deletePreset(id)
    loadPresets()
  }

  const priorityLabel = { low: t('priority.low'), medium: t('priority.medium'), high: t('priority.high'), critical: t('priority.critical') }
  const statusLabel = { open: t('status.open'), in_progress: t('status.in_progress'), resolved: t('status.resolved'), closed: t('status.closed') }
  const categoryLabel = {
    ...Object.fromEntries(categories.map(c => [c.value, c.label])),
    uncategorized: t('ticketReports.category.uncategorized'),
  }
  const slaLabel = {
    on_time: t('ticketReports.sla.onTime'), at_risk: t('ticketReports.sla.atRisk'),
    breached: t('ticketReports.sla.breached'), met: t('ticketReports.sla.met'),
  }
  const sourceLabel = {
    manual: t('ticketReports.source.manual'), email: t('ticketReports.source.email'),
    telegram: t('ticketReports.source.telegram'), whatsapp: t('ticketReports.source.whatsapp'),
  }

  const exportExcel = () => {
    if (!data?.tickets?.length) return
    const rows = data.tickets.map((tk, i) => ({
      [t('ticketReports.col.index')]: i + 1,
      [t('tickets.col.title')]: tk.title,
      [t('tickets.col.status')]: statusLabel[tk.status] || tk.status,
      [t('tickets.col.priority')]: priorityLabel[tk.priority] || tk.priority,
      [t('ticketReports.col.type')]: tk.category ? categoryLabel[tk.category] : '',
      [t('ticketReports.col.organization')]: tk.organization?.name || '',
      [t('ticketReports.col.branch')]: tk.branch?.name || '',
      [t('ticketReports.col.department')]: tk.department?.name || '',
      [t('tickets.col.assignedTo')]: tk.assigned_to || '',
      [t('ticketReports.col.source')]: sourceLabel[tk.source] || tk.source || '',
      [t('tickets.col.createdAt')]: tk.created_at ? new Date(tk.created_at).toLocaleDateString() : '',
      [t('tickets.col.dueDate')]: tk.sla_due_at ? new Date(tk.sla_due_at).toLocaleDateString() : '',
      [t('ticketReports.col.slaStatus')]: tk.sla_status ? slaLabel[tk.sla_status] : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ticket Report')
    XLSX.writeFile(wb, `ticket_report_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const ratedTickets = (data?.tickets || []).filter(tk => tk.csat_rating).sort((a, b) =>
    new Date(b.csat_submitted_at || 0) - new Date(a.csat_submitted_at || 0))

  const exportRatingsExcel = () => {
    if (!ratedTickets.length) return
    const rows = ratedTickets.map((tk, i) => ({
      [t('ticketReports.col.index')]: i + 1,
      [t('ticketReports.csat.col.ticketNumber')]: tk.id,
      [t('tickets.col.title')]: tk.title,
      [t('ticketReports.csat.col.ratingOutOf5')]: tk.csat_rating,
      [t('ticketReports.csat.col.comment')]: tk.csat_comment || '',
      [t('ticketReports.csat.col.requesterName')]: tk.requester_name || '',
      [t('ticketReports.csat.col.requesterEmail')]: tk.requester_email || '',
      [t('ticketReports.csat.col.resolvedBy')]: tk.assigned_to || '',
      [t('ticketReports.csat.col.ratedAt')]: tk.csat_submitted_at ? new Date(tk.csat_submitted_at).toLocaleString() : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'CSAT Report')
    XLSX.writeFile(wb, `ticket_ratings_report_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <Header title={t('ticketReports.title')} subtitle={t('ticketReports.subtitle')} />

      {/* Saved presets */}
      {presets.length > 0 && (
        <div className="card !p-4 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500 shrink-0">{t('ticketReports.savedReports')}</span>
          {presets.map(p => (
            <div key={p.id} className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-full pr-1 pl-3 py-1">
              <button onClick={() => applyPreset(p)} className="text-xs font-medium text-yellow-700">{p.name}</button>
              <button onClick={() => handleDeletePreset(p.id)} className="text-yellow-500 hover:text-red-500 text-xs w-5 h-5 rounded-full flex items-center justify-center">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="form-label">{t('ticketReports.filter.dateFrom')}</label>
            <input type="date" className="form-input" value={filters.date_from} onChange={e => set('date_from', e.target.value)} />
          </div>
          <div>
            <label className="form-label">{t('ticketReports.filter.dateTo')}</label>
            <input type="date" className="form-input" value={filters.date_to} onChange={e => set('date_to', e.target.value)} />
          </div>
          <div>
            <label className="form-label">{t('ticketReports.filter.status')}</label>
            <select className="form-select" value={filters.status} onChange={e => set('status', e.target.value)}>
              <option value="">{t('ticketReports.filter.all')}</option>
              {STATUSES.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('ticketReports.filter.priority')}</label>
            <select className="form-select" value={filters.priority} onChange={e => set('priority', e.target.value)}>
              <option value="">{t('ticketReports.filter.all')}</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{priorityLabel[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('ticketReports.filter.category')}</label>
            <select className="form-select" value={filters.category} onChange={e => set('category', e.target.value)}>
              <option value="">{t('ticketReports.filter.all')}</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('ticketReports.filter.organization')}</label>
            <select className="form-select" value={filters.organization_id} onChange={e => set('organization_id', e.target.value)}>
              <option value="">{t('ticketReports.filter.all')}</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('ticketReports.filter.branch')}</label>
            <select className="form-select" value={filters.branch_id} onChange={e => set('branch_id', e.target.value)}>
              <option value="">{t('ticketReports.filter.all')}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('ticketReports.filter.department')}</label>
            <select className="form-select" value={filters.department_id} onChange={e => set('department_id', e.target.value)}>
              <option value="">{t('ticketReports.filter.all')}</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('ticketReports.filter.assignedTo')}</label>
            <select className="form-select" value={filters.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
              <option value="">{t('ticketReports.filter.all')}</option>
              {engineers.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('ticketReports.filter.source')}</label>
            <select className="form-select" value={filters.source} onChange={e => set('source', e.target.value)}>
              <option value="">{t('ticketReports.filter.all')}</option>
              {SOURCES.map(s => <option key={s} value={s}>{sourceLabel[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={runReport} className="btn-primary">{t('ticketReports.applyFilters')}</button>
          <button onClick={clearFilters} className="btn-secondary">{t('ticketReports.clearFilters')}</button>
          <button onClick={() => setSaveModal(true)} className="btn-secondary">{t('ticketReports.saveAsCustom')}</button>
          <button onClick={exportExcel} disabled={!data?.tickets?.length} className="btn-secondary disabled:opacity-40">{t('ticketReports.exportExcel')}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { key: 'overview', label: t('ticketReports.tab.overview') },
          { key: 'ratings', label: t('ticketReports.tab.ratings') },
        ].map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === tb.key ? 'border-yellow-500 text-yellow-700' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {tb.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12 text-slate-400">{t('ticketReports.loading')}</div>
      ) : data && tab === 'ratings' ? (
        <>
          {/* CSAT stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="card !p-4">
              <p className="text-3xl font-bold text-yellow-500">{data.avg_csat_rating ?? '—'} {data.avg_csat_rating ? '⭐' : ''}</p>
              <p className="text-xs text-slate-500 mt-1">{t('ticketReports.csat.avgRating')}</p>
            </div>
            <div className="card !p-4">
              <p className="text-3xl font-bold text-slate-800">{data.csat_count || 0}</p>
              <p className="text-xs text-slate-500 mt-1">{t('ticketReports.csat.countLabel')}</p>
            </div>
            <div className="card !p-4">
              <p className="text-3xl font-bold text-slate-800">{data.total ? Math.round(((data.csat_count || 0) / data.total) * 100) : 0}%</p>
              <p className="text-xs text-slate-500 mt-1">{t('ticketReports.csat.percentRated')}</p>
            </div>
          </div>

          {/* Rating distribution */}
          <BreakdownCard
            title={t('ticketReports.csat.distribution')}
            data={data.by_csat_rating}
            total={data.csat_count}
            labelFor={k => '⭐'.repeat(Number(k)) + ` (${k})`}
            noDataLabel={t('ticketReports.breakdown.noData')}
          />

          {/* Ratings table */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-700 text-sm">{t('ticketReports.csat.reportTitle')} ({ratedTickets.length})</h3>
              <button onClick={exportRatingsExcel} disabled={!ratedTickets.length} className="btn-secondary !text-xs !py-1.5 disabled:opacity-40">{t('ticketReports.exportExcel')}</button>
            </div>
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <tr>
                    {[
                      t('ticketReports.col.index'), t('tickets.col.title'), t('ticketReports.csat.col.rating'),
                      t('ticketReports.csat.col.comment'), t('ticketReports.csat.col.requesterName'),
                      t('ticketReports.csat.col.resolvedBy'), t('ticketReports.csat.col.ratedAt'),
                    ].map(h => (
                      <th key={h} className="table-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ratedTickets.length === 0 ? (
                    <tr><td colSpan={7} className="table-td text-center py-10 text-slate-400">{t('ticketReports.csat.noMatching')}</td></tr>
                  ) : ratedTickets.map(tk => (
                    <tr key={tk.id} className="hover:bg-slate-50/50">
                      <td className="table-td text-slate-400 text-xs">#{tk.id}</td>
                      <td className="table-td">
                        <button onClick={() => navigate(`/tickets/${tk.id}`)} className="text-yellow-600 hover:underline text-start">{tk.title}</button>
                      </td>
                      <td className="table-td">
                        <span className="text-amber-500">{'★'.repeat(tk.csat_rating)}</span>
                        <span className="text-slate-200">{'★'.repeat(5 - tk.csat_rating)}</span>
                      </td>
                      <td className="table-td text-slate-500 text-xs max-w-[16rem] truncate" title={tk.csat_comment || ''}>{tk.csat_comment || '—'}</td>
                      <td className="table-td text-slate-600 text-xs">
                        {tk.requester_name || '—'}
                        {tk.requester_email && <p className="text-slate-400">{tk.requester_email}</p>}
                      </td>
                      <td className="table-td text-slate-500 text-xs">{tk.assigned_to || '—'}</td>
                      <td className="table-td text-slate-500 text-xs">{tk.csat_submitted_at ? new Date(tk.csat_submitted_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card !p-4"><p className="text-3xl font-bold text-slate-800">{data.total}</p><p className="text-xs text-slate-500 mt-1">{t('ticketReports.stat.total')}</p></div>
            <div className="card !p-4"><p className="text-3xl font-bold text-red-600">{data.by_sla_status?.breached || 0}</p><p className="text-xs text-slate-500 mt-1">{t('ticketReports.stat.slaBreached')}</p></div>
            <div className="card !p-4"><p className="text-3xl font-bold text-yellow-600">{(data.by_status?.open || 0) + (data.by_status?.in_progress || 0)}</p><p className="text-xs text-slate-500 mt-1">{t('ticketReports.stat.openInProgress')}</p></div>
            <div className="card !p-4"><p className="text-3xl font-bold text-slate-800">{data.avg_resolution_hours ?? '—'}</p><p className="text-xs text-slate-500 mt-1">{t('ticketReports.stat.avgResolution')}</p></div>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <BreakdownCard title={t('ticketReports.breakdown.byStatus')} data={data.by_status} total={data.total} labelFor={k => statusLabel[k] || k} noDataLabel={t('ticketReports.breakdown.noData')} />
            <BreakdownCard title={t('ticketReports.breakdown.byPriority')} data={data.by_priority} total={data.total} labelFor={k => priorityLabel[k] || k} noDataLabel={t('ticketReports.breakdown.noData')} />
            <BreakdownCard title={t('ticketReports.breakdown.byCategory')} data={data.by_category} total={data.total} labelFor={k => categoryLabel[k] || k} noDataLabel={t('ticketReports.breakdown.noData')} />
            <BreakdownCard title={t('ticketReports.breakdown.byBranch')} data={data.by_branch} total={data.total} noDataLabel={t('ticketReports.breakdown.noData')} />
            <BreakdownCard title={t('ticketReports.breakdown.byOrganization')} data={data.by_organization} total={data.total} noDataLabel={t('ticketReports.breakdown.noData')} />
            <BreakdownCard title={t('ticketReports.breakdown.byEngineer')} data={data.by_engineer} total={data.total} noDataLabel={t('ticketReports.breakdown.noData')} />
            <BreakdownCard title={t('ticketReports.breakdown.bySource')} data={data.by_source} total={data.total} labelFor={k => sourceLabel[k] || k} noDataLabel={t('ticketReports.breakdown.noData')} />
            <BreakdownCard title={t('ticketReports.breakdown.bySla')} data={data.by_sla_status} total={data.total} labelFor={k => slaLabel[k] || k} noDataLabel={t('ticketReports.breakdown.noData')} />
          </div>

          {/* Ticket list */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-700 text-sm">{t('ticketReports.ticketsList')} ({data.tickets.length})</h3>
            </div>
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <tr>
                    {[
                      t('ticketReports.col.index'), t('tickets.col.title'), t('tickets.col.status'),
                      t('tickets.col.priority'), t('ticketReports.col.type'), t('tickets.col.assignedTo'),
                      t('tickets.col.createdAt'),
                    ].map(h => (
                      <th key={h} className="table-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.tickets.length === 0 ? (
                    <tr><td colSpan={7} className="table-td text-center py-10 text-slate-400">{t('ticketReports.noMatchingTickets')}</td></tr>
                  ) : data.tickets.map(tk => (
                    <tr key={tk.id} className="hover:bg-slate-50/50">
                      <td className="table-td text-slate-400 text-xs">#{tk.id}</td>
                      <td className="table-td">
                        <button onClick={() => navigate(`/tickets/${tk.id}`)} className="text-yellow-600 hover:underline text-start">{tk.title}</button>
                      </td>
                      <td className="table-td text-slate-500 text-xs">{statusLabel[tk.status] || tk.status}</td>
                      <td className="table-td text-slate-500 text-xs">{priorityLabel[tk.priority] || tk.priority}</td>
                      <td className="table-td text-slate-500 text-xs">{tk.category ? categoryLabel[tk.category] : '—'}</td>
                      <td className="table-td text-slate-500 text-xs">{tk.assigned_to || '—'}</td>
                      <td className="table-td text-slate-500 text-xs">{tk.created_at ? new Date(tk.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={saveModal} onClose={() => setSaveModal(false)} title={t('ticketReports.saveModal.title')} size="sm">
        <div className="space-y-4">
          <div>
            <label className="form-label">{t('ticketReports.saveModal.nameLabel')}</label>
            <input className="form-input" value={presetName} onChange={e => setPresetName(e.target.value)}
              placeholder={t('ticketReports.saveModal.namePlaceholder')} autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSavePreset()} />
          </div>
          <p className="text-xs text-slate-400">{t('ticketReports.saveModal.hint')}</p>
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
          <button onClick={handleSavePreset} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? t('ticketReports.saveModal.saving') : t('ticketReports.saveModal.save')}
          </button>
          <button onClick={() => setSaveModal(false)} className="btn-secondary">{t('ticketReports.saveModal.cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
