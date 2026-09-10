import { useEffect, useState, useMemo, useRef } from 'react'
import { reportsApi } from '../api/client'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'
import { useCurrency, useFormatCurrency } from '../context/CurrencyContext'

export default function SoftwareReport() {
  const { t, isRTL } = useLanguage()
  const { currency } = useCurrency()
  const formatCurrency = useFormatCurrency()
  const printRef = useRef()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState({})
  const [filterDept, setFilterDept] = useState('')
  const [filterSw, setFilterSw] = useState('')
  const [allCollapsed, setAllCollapsed] = useState(false)

  useEffect(() => {
    reportsApi.bySoftware()
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  // All unique department names for filter dropdown
  const allDepts = useMemo(() => {
    if (!data) return []
    const s = new Set()
    data.software.forEach(sw => sw.departments.forEach(d => s.add(d.department)))
    return [...s].sort()
  }, [data])

  // Filtered software list
  const filtered = useMemo(() => {
    if (!data) return []
    return data.software
      .map(sw => {
        const depts = filterDept
          ? sw.departments.filter(d => d.department === filterDept)
          : sw.departments
        return { ...sw, departments: depts }
      })
      .filter(sw =>
        sw.departments.length > 0 &&
        (!filterSw || sw.title.toLowerCase().includes(filterSw.toLowerCase()))
      )
  }, [data, filterDept, filterSw])

  // Filtered totals
  const filteredTotals = useMemo(() => ({
    qty: filtered.reduce((s, sw) => s + sw.departments.reduce((a, d) => a + d.quantity, 0), 0),
    cost: filtered.reduce((s, sw) => s + sw.departments.reduce((a, d) => a + d.cost, 0), 0),
  }), [filtered])

  const toggleOne = (title) =>
    setCollapsed(c => ({ ...c, [title]: !c[title] }))

  const toggleAll = () => {
    const next = !allCollapsed
    setAllCollapsed(next)
    const map = {}
    filtered.forEach(sw => { map[sw.title] = next })
    setCollapsed(map)
  }

  const handlePrint = () => window.print()

  const exportCsv = () => {
    const rows = [
      [t('swreport.software'), t('swreport.department'), t('swreport.quantity'), t('swreport.totalCost'), 'Currency']
    ]
    filtered.forEach(sw => {
      sw.departments.forEach(d => {
        rows.push([sw.title, d.department, d.quantity, d.cost, d.currency])
      })
      rows.push([sw.title, t('swreport.subtotal'), sw.departments.reduce((a,d)=>a+d.quantity,0),
        sw.departments.reduce((a,d)=>a+d.cost,0), sw.departments[0]?.currency || 'USD'])
      rows.push([])
    })
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `software_report_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-lg">
      {t('common.loading')}
    </div>
  )

  return (
    <>
      {/* ── Print styles injected into <head> ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #sw-print-area, #sw-print-area * { visibility: visible !important; }
          #sw-print-area { position: fixed; top: 0; left: 0; right: 0; width: 100%; }
          .no-print { display: none !important; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 4px 8px; }
          thead { background: #166534; color: white; }
          .subtotal-row td { background: #f0fdf4; font-weight: 700; }
          .grand-row td { background: #14532d; color: white; font-weight: 700; }
          .sw-header { background: #166534; color: white; padding: 6px 10px; font-weight: 700; margin-top: 12px; }
        }
      `}</style>

      <div className="space-y-4 max-w-6xl">
        <Header title={t('swreport.title')} subtitle={t('swreport.subtitle')} />

        {/* ── Toolbar ── */}
        <div className="no-print card !p-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-3 flex-wrap flex-1">
            {/* Search */}
            <input
              className="form-input w-52"
              placeholder={t('swreport.filterSw')}
              value={filterSw}
              onChange={e => setFilterSw(e.target.value)}
            />
            {/* Department filter */}
            <select
              className="form-select w-52"
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
            >
              <option value="">{t('swreport.allDepts')}</option>
              {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {/* Collapse toggle */}
            <button onClick={toggleAll} className="btn-secondary text-xs">
              {allCollapsed ? t('swreport.expand') : t('swreport.collapse')}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="btn-secondary flex items-center gap-1.5">
              <span>📥</span> {t('swreport.exportCsv')}
            </button>
            <button onClick={handlePrint} className="btn-primary flex items-center gap-1.5">
              <span>🖨️</span> {t('swreport.print')}
            </button>
          </div>
        </div>

        {/* ── Summary bar ── */}
        <div className="no-print grid grid-cols-3 gap-3">
          {[
            { label: t('swreport.programs'), value: filtered.length, icon: '💿', color: 'blue' },
            { label: t('swreport.units'), value: filteredTotals.qty.toLocaleString(), icon: '🔢', color: 'slate' },
            { label: t('swreport.grandTotal'), value: formatCurrency(filteredTotals.cost, 'USD'), icon: '💰', color: 'green' },
          ].map(c => (
            <div key={c.label} className={`card border-2 ${
              c.color === 'blue' ? 'border-yellow-100 bg-yellow-50' :
              c.color === 'green' ? 'border-yellow-100 bg-yellow-50' :
              'border-slate-100 bg-slate-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">{c.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{c.value}</p>
                </div>
                <span className="text-3xl opacity-70">{c.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="card text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">📭</p>
            <p>{t('swreport.noData')}</p>
          </div>
        ) : (
          /* ── Printable area ── */
          <div id="sw-print-area" ref={printRef}>
            {/* Print header */}
            <div className="hidden print:block mb-4 text-center border-b pb-3">
              <h1 className="text-xl font-bold">{t('swreport.title')}</h1>
              <p className="text-sm text-slate-500">
                {t('swreport.printDate')} {new Date().toLocaleDateString()}
              </p>
            </div>

            {/* Per-software cards */}
            <div className="space-y-3">
              {filtered.map((sw, idx) => {
                const swQty  = sw.departments.reduce((a, d) => a + d.quantity, 0)
                const swCost = sw.departments.reduce((a, d) => a + d.cost, 0)
                const isOpen = !collapsed[sw.title]

                return (
                  <div key={sw.title} className="card !p-0 overflow-hidden border border-slate-200 shadow-sm">
                    {/* Software header row */}
                    <button
                      onClick={() => toggleOne(sw.title)}
                      className="w-full flex items-center justify-between px-5 py-3 bg-yellow-700 hover:bg-yellow-800 transition-colors text-white no-print"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-yellow-200 text-xs font-mono w-6 text-center">{idx + 1}</span>
                        <span className="text-lg">💿</span>
                        <span className="font-bold text-base">{sw.title}</span>
                        <span className="text-yellow-200 text-sm">
                          ({sw.departments.length} {t('swreport.department')})
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <span>🔢 {swQty.toLocaleString()} {t('swreport.units')}</span>
                        <span className="font-semibold">💰 {formatCurrency(swCost, sw.currency)}</span>
                        <span className="text-yellow-300 text-lg">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {/* Print-only software header */}
                    <div className="sw-header hidden print:block">
                      {idx + 1}. {sw.title}
                    </div>

                    {/* Department table */}
                    {(isOpen || true /* always visible when printing */) && (
                      <div className={isOpen ? '' : 'print:block hidden'}>
                        {isOpen && (
                          <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="table-th w-8 text-center">#</th>
                                <th className="table-th">{t('swreport.department')}</th>
                                <th className="table-th text-center">{t('swreport.quantity')}</th>
                                <th className="table-th ltr:text-right rtl:text-left">{t('swreport.unitCost')}</th>
                                <th className="table-th ltr:text-right rtl:text-left">{t('swreport.totalCost')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {sw.departments.map((d, di) => (
                                <tr key={d.department}
                                  className={di % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                  <td className="table-td text-center text-slate-400 text-xs">{di + 1}</td>
                                  <td className="table-td font-medium text-slate-800">{d.department}</td>
                                  <td className="table-td text-center">
                                    <span className="inline-flex items-center justify-center w-10 h-7 rounded-lg bg-yellow-50 text-yellow-700 font-bold text-sm">
                                      {d.quantity}
                                    </span>
                                  </td>
                                  <td className="table-td ltr:text-right rtl:text-left text-slate-500">
                                    {sw.unit_price > 0 ? formatCurrency(sw.unit_price, sw.currency) : '—'}
                                  </td>
                                  <td className="table-td ltr:text-right rtl:text-left font-semibold text-slate-700">
                                    {d.cost > 0 ? formatCurrency(d.cost, d.currency) : '—'}
                                  </td>
                                </tr>
                              ))}

                              {/* Subtotal row */}
                              <tr className="subtotal-row bg-yellow-50 border-t-2 border-yellow-200">
                                <td className="table-td" />
                                <td className="table-td font-bold text-yellow-800">
                                  {t('swreport.subtotal')}
                                </td>
                                <td className="table-td text-center font-bold text-yellow-800">
                                  <span className="inline-flex items-center justify-center w-10 h-7 rounded-lg bg-yellow-200 text-yellow-900 font-bold text-sm">
                                    {swQty}
                                  </span>
                                </td>
                                <td className="table-td" />
                                <td className="table-td ltr:text-right rtl:text-left font-bold text-yellow-800 text-base">
                                  {formatCurrency(swCost, sw.currency)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Grand total */}
              <div className="grand-row rounded-2xl bg-yellow-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📊</span>
                  <div>
                    <p className="text-yellow-200 text-xs">{filtered.length} {t('swreport.programs')}</p>
                    <p className="font-bold text-lg">{t('swreport.grandTotal')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-10 text-right">
                  <div>
                    <p className="text-yellow-300 text-xs">{t('swreport.units')}</p>
                    <p className="text-2xl font-bold">{filteredTotals.qty.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-yellow-300 text-xs">{t('swreport.totalCost')}</p>
                    <p className="text-2xl font-bold">{formatCurrency(filteredTotals.cost, 'USD')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
