import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketsApi, engineersApi, departmentsApi } from '../api/client'
import { useLanguage } from '../context/LanguageContext'

const PRIORITY_STYLE = {
  critical: { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500',    key: 'priority.critical' },
  high:     { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', key: 'priority.high' },
  medium:   { badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400',  key: 'priority.medium' },
  low:      { badge: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-300',  key: 'priority.low' },
}
const PAGE_SIZES = [12, 24, 48]

function highlight(text, query) {
  if (!query || !text) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{p}</mark>
      : p
  )
}

// ── KB Card ───────────────────────────────────────────────────────────────────
function KBCard({ item, query, onViewTicket, t, timeAgo }) {
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied]   = useState(false)
  const pri = PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.medium
  const PREVIEW_STEPS = 3
  const visibleSteps  = showAll ? item.steps : item.steps.slice(0, PREVIEW_STEPS)
  const hasMore       = item.steps.length > PREVIEW_STEPS

  const handleCopy = () => {
    const steps = item.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    const txt = t('kb.copyFormat')
      .replace('{title}', item.title)
      .replace('{steps}', steps)
    navigator.clipboard.writeText(txt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-yellow-300 hover:shadow-md transition-all flex flex-col group">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`badge text-[10px] ${pri.badge}`}>{t(pri.key)}</span>
            {item.department && (
              <span className="badge text-[10px] bg-slate-100 text-slate-600">{item.department.name}</span>
            )}
            {item.source === 'email' && (
              <span className="badge text-[10px] bg-purple-50 text-purple-500">📧</span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 flex-shrink-0"># {item.id}</span>
        </div>
        <h3 className="font-bold text-slate-800 text-sm leading-snug mb-2 group-hover:text-yellow-700 transition-colors">
          {highlight(item.title, query)}
        </h3>
        {item.description && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
            {highlight(item.description, query)}
          </p>
        )}
      </div>

      <div className="mx-4 border-t border-slate-100" />

      {/* Steps */}
      <div className="p-4 pt-3 flex-1">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs font-semibold text-yellow-700 flex items-center gap-1.5">
            <span className="w-4 h-4 bg-yellow-100 rounded-full flex items-center justify-center text-[9px]">✓</span>
            {t('kb.solutionSteps')}
            <span className="text-slate-400 font-normal">({item.steps_count})</span>
          </p>
          <button onClick={handleCopy}
            className="text-[10px] text-slate-400 hover:text-yellow-600 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-yellow-50">
            {copied ? t('kb.copied') : t('kb.copy')}
          </button>
        </div>

        <div className="space-y-2">
          {visibleSteps.map((step, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">{highlight(step, query)}</p>
            </div>
          ))}

          {hasMore && !showAll && (
            <button onClick={() => setShowAll(true)}
              className="text-xs text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1 pt-0.5 hover:underline">
              {t('kb.moreSteps').replace('{n}', item.steps.length - PREVIEW_STEPS)}
            </button>
          )}
          {showAll && hasMore && (
            <button onClick={() => setShowAll(false)}
              className="text-xs text-slate-400 hover:text-slate-600 pt-0.5">
              {t('kb.collapse')}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            {item.assigned_to && (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold flex items-center justify-center">
                  {item.assigned_to.charAt(0)}
                </div>
                <span className="text-[11px] text-slate-500">{item.assigned_to}</span>
              </div>
            )}
            {item.resolved_at && (
              <span className="text-[11px] text-slate-400">· {timeAgo(item.resolved_at)}</span>
            )}
          </div>
          <button onClick={() => onViewTicket(item.id)}
            className="text-[11px] text-yellow-600 hover:text-yellow-700 font-medium hover:underline flex items-center gap-1">
            {t('kb.viewTicket')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ hasFilters, onClear, t }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-5">
        {hasFilters ? '🔍' : '📚'}
      </div>
      {hasFilters ? (
        <>
          <h3 className="font-bold text-slate-700 text-lg mb-2">{t('kb.noResults')}</h3>
          <p className="text-slate-500 text-sm mb-4 max-w-xs">{t('kb.noResultsSub')}</p>
          <button onClick={onClear} className="btn-secondary !py-2 !px-4">{t('kb.clearSearch')}</button>
        </>
      ) : (
        <>
          <h3 className="font-bold text-slate-700 text-lg mb-2">{t('kb.emptyTitle')}</h3>
          <p className="text-slate-500 text-sm mb-1 max-w-sm">{t('kb.emptySub')}</p>
          <p className="text-slate-400 text-xs">{t('kb.emptyHint')}</p>
        </>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KnowledgeBase() {
  const navigate = useNavigate()
  const { t, language } = useLanguage()

  const [data, setData]           = useState({ items: [], total: 0, page: 1, pages: 1, stats: { total_solutions: 0 } })
  const [engineers, setEngineers] = useState([])
  const [departments, setDepts]   = useState([])
  const [loading, setLoading]     = useState(true)

  const [search, setSearch]       = useState('')
  const [priority, setPriority]   = useState('')
  const [deptId, setDeptId]       = useState('')
  const [solvedBy, setSolvedBy]   = useState('')
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(12)
  const [viewMode, setViewMode]   = useState('grid')

  const searchTimer = useRef(null)

  const timeAgo = (iso) => {
    if (!iso) return ''
    const d = (Date.now() - new Date(iso + (iso.includes('Z') ? '' : 'Z'))) / 1000
    if (d < 3600)   return t('time.minutes').replace('{n}', Math.floor(d / 60))
    if (d < 86400)  return t('time.hours').replace('{n}', Math.floor(d / 3600))
    if (d < 604800) return t('time.days').replace('{n}', Math.floor(d / 86400))
    return new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const load = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = { page: p, page_size: pageSize }
      if (search.trim()) params.search       = search.trim()
      if (priority)      params.priority     = priority
      if (deptId)        params.department_id = deptId
      if (solvedBy)      params.solved_by    = solvedBy
      const res = await ticketsApi.knowledgeBase(params)
      setData(res.data)
    } finally { setLoading(false) }
  }, [search, priority, deptId, solvedBy, page, pageSize])

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); load(1) }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [search, priority, deptId, solvedBy, pageSize])

  useEffect(() => { load(page) }, [page])

  useEffect(() => {
    Promise.all([engineersApi.list(), departmentsApi.list()])
      .then(([e, d]) => { setEngineers(e.data); setDepts(d.data) })
  }, [])

  const clearAll   = () => { setSearch(''); setPriority(''); setDeptId(''); setSolvedBy(''); setPage(1) }
  const hasFilters = !!(search || priority || deptId || solvedBy)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            📚 {t('kb.title')}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">{t('kb.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold text-yellow-700">{data.stats.total_solutions}</p>
            <p className="text-[11px] text-yellow-600">{t('kb.statSolutions')}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-center">
            <p className="text-xl font-bold text-slate-700">{data.total}</p>
            <p className="text-[11px] text-slate-500">{hasFilters ? t('kb.statResults') : t('kb.statTotal')}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('kb.searchPlaceholder')}
          className="input w-full pr-12 pl-12 !py-3.5 text-base shadow-sm"
          autoFocus
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg transition-colors">
            ✕
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 flex-wrap items-center">
        <select value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }}
          className="input !py-2 !px-3 text-sm w-auto">
          <option value="">{t('kb.allPriorities')}</option>
          {Object.entries(PRIORITY_STYLE).map(([k, v]) => (
            <option key={k} value={k}>{t(v.key)}</option>
          ))}
        </select>

        <select value={deptId} onChange={e => { setDeptId(e.target.value); setPage(1) }}
          className="input !py-2 !px-3 text-sm w-auto max-w-[180px]">
          <option value="">{t('kb.allDepts')}</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <select value={solvedBy} onChange={e => { setSolvedBy(e.target.value); setPage(1) }}
          className="input !py-2 !px-3 text-sm w-auto max-w-[180px]">
          <option value="">{t('kb.allEngineers')}</option>
          {engineers.filter(e => e.active === 'true').map(e => (
            <option key={e.id} value={e.name}>{e.name}</option>
          ))}
        </select>

        {hasFilters && (
          <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 flex items-center gap-1">
            {t('kb.clearFilters')}
          </button>
        )}

        <div className="flex-1" />

        <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1) }}
          className="input !py-2 !px-3 text-sm w-auto">
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s} {t('kb.perPage')}</option>)}
        </select>

        <div className="flex bg-slate-100 rounded-xl p-0.5">
          {['grid', 'list'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${viewMode === mode ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}>
              {mode === 'grid' ? '⊞' : '≡'}
            </button>
          ))}
        </div>
      </div>

      {/* Active filter tags */}
      {hasFilters && (
        <div className="flex gap-2 flex-wrap items-center text-xs">
          <span className="text-slate-400">{t('kb.activeFilters')}</span>
          {search   && <span className="px-2.5 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-full">🔍 "{search}"</span>}
          {priority && <span className="px-2.5 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-full">{t(PRIORITY_STYLE[priority]?.key)}</span>}
          {deptId   && <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full">{departments.find(d => d.id == deptId)?.name}</span>}
          {solvedBy && <span className="px-2.5 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-full">👤 {solvedBy}</span>}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">{t('kb.searching')}</p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.items.length === 0
            ? <EmptyState hasFilters={hasFilters} onClear={clearAll} t={t} />
            : data.items.map(item => (
              <KBCard key={item.id} item={item} query={search} t={t} timeAgo={timeAgo}
                onViewTicket={id => navigate(`/tickets/${id}`)} />
            ))
          }
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.length === 0
            ? <EmptyState hasFilters={hasFilters} onClear={clearAll} t={t} />
            : data.items.map(item => {
              const pri = PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.medium
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200 hover:border-yellow-300 hover:shadow-sm transition-all p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-yellow-100 text-yellow-600 text-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      ✅
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-slate-400 text-xs">#{item.id}</span>
                        <span className={`badge text-[10px] ${pri.badge}`}>{t(pri.key)}</span>
                        {item.department && <span className="badge text-[10px] bg-slate-100 text-slate-500">{item.department.name}</span>}
                      </div>
                      <h3 className="font-semibold text-slate-800 text-sm mb-1.5">
                        {highlight(item.title, search)}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {item.steps.map((step, i) => (
                          <span key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-yellow-100 text-yellow-700 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                            <span className="line-clamp-1 max-w-[180px]">{highlight(step, search)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <button onClick={() => navigate(`/tickets/${item.id}`)}
                        className="text-xs text-yellow-600 hover:text-yellow-700 font-medium hover:underline whitespace-nowrap">
                        {t('kb.view')}
                      </button>
                      {item.assigned_to && <span className="text-[11px] text-slate-400">{item.assigned_to}</span>}
                      {item.resolved_at && <span className="text-[10px] text-slate-300">{timeAgo(item.resolved_at)}</span>}
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>
      )}

      {/* Pagination */}
      {data.total > 0 && data.pages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button onClick={() => setPage(1)} disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 text-xs">«</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 text-xs">‹</button>

          {Array.from({ length: Math.min(7, data.pages) }, (_, i) => {
            let p
            if (data.pages <= 7) p = i + 1
            else if (page <= 4)  p = i + 1
            else if (page >= data.pages - 3) p = data.pages - 6 + i
            else p = page - 3 + i
            return (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-medium transition-all
                  ${page === p ? 'bg-yellow-600 border-yellow-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {p}
              </button>
            )
          })}

          <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 text-xs">›</button>
          <button onClick={() => setPage(data.pages)} disabled={page === data.pages}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 text-xs">»</button>

          <span className="text-xs text-slate-400 mr-2">
            {t('kb.paginationOf')
              .replace('{from}', (page - 1) * pageSize + 1)
              .replace('{to}',   Math.min(page * pageSize, data.total))
              .replace('{total}', data.total)}
          </span>
        </div>
      )}
    </div>
  )
}
