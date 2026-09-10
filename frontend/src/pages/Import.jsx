import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/client'
import Header from '../components/Header'
import { useLanguage } from '../context/LanguageContext'
import { useCurrency } from '../context/CurrencyContext'

// System fields per import target
const FIELDS = {
  requests: [
    { key: 'title',          required: true  },
    { key: 'department_name',required: false },
    { key: 'quantity',       required: false },
    { key: 'estimated_cost', required: false },
    { key: 'currency',       required: false, fixedOptions: ['USD', 'EUR', 'EGP'] },
    { key: 'asset_type',     required: false, fixedOptions: ['software', 'hardware', 'network', 'service', 'other'] },
    { key: 'priority',       required: false, fixedOptions: ['low', 'medium', 'high', 'critical'] },
    { key: 'requester_name', required: false },
    { key: 'requester_email',required: false },
    { key: 'description',    required: false },
    { key: 'notes',          required: false },
  ],
  assets: [
    { key: 'name',           required: true  },
    { key: 'department_name',required: false },
    { key: 'asset_type',     required: false, fixedOptions: ['hardware', 'software', 'network', 'other'] },
    { key: 'brand',          required: false },
    { key: 'model',          required: false },
    { key: 'serial_number',  required: false },
    { key: 'location',       required: false },
    { key: 'assigned_to',    required: false },
    { key: 'notes',          required: false },
  ],
  licensed_software: [
    { key: 'software_name',        required: true  },
    { key: 'department_name',      required: false },
    { key: 'user_name',            required: false },
    { key: 'quantity',             required: false },
    { key: 'license_renewal_date', required: false },
    { key: 'notes',                required: false },
  ],
}

const STEP_ICONS = { upload: '📂', map: '🔗', result: '✅' }

export default function Import() {
  const { t } = useLanguage()
  const { currency: globalCurrency } = useCurrency()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const [step, setStep] = useState('upload')   // upload | map | result
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState(null)   // { headers, sample_rows, total_data_rows, filename }
  const initialTarget = searchParams.get('target')
  const [target, setTarget] = useState(FIELDS[initialTarget] ? initialTarget : 'requests')
  const [mapping, setMapping] = useState({})     // { fieldKey: colIndex | fixedString }
  const [fixedValues, setFixedValues] = useState({ currency: globalCurrency, asset_type: 'software', priority: 'medium' })
  const [fileObj, setFileObj] = useState(null)
  const [result, setResult] = useState(null)
  const [uploadError, setUploadError] = useState('')

  // ── upload ──────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return
    setUploadError('')
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/import/preview', fd)
      setPreview(res.data)
      setFileObj(file)
      // auto-map: try to match header name to field key
      const autoMap = {}
      const hdrs = res.data.headers.map((h) => h.toLowerCase().replace(/\s+/g, '_'))
      const fields = FIELDS[target]
      fields.forEach(({ key }) => {
        const idx = hdrs.findIndex((h) =>
          h.includes(key.replace(/_/g, '')) ||
          h.includes(key)
        )
        if (idx !== -1) autoMap[key] = idx
      })
      setMapping(autoMap)
      setStep('map')
    } catch (e) {
      setUploadError(e.response?.data?.detail || 'Cannot read file')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  // ── import ───────────────────────────────────────────────
  const handleImport = async () => {
    // Build final mapping: use column index if set, else fall back to fixed value
    const finalMap = {}
    FIELDS[target].forEach(({ key, fixedOptions }) => {
      if (mapping[key] !== undefined && mapping[key] !== -1) {
        finalMap[key] = mapping[key]
      } else if (fixedOptions && fixedValues[key]) {
        finalMap[key] = fixedValues[key]  // fixed string
      }
    })

    setImporting(true)
    const fd = new FormData()
    fd.append('file', fileObj)
    fd.append('mapping', JSON.stringify(finalMap))
    fd.append('target', target)
    try {
      const res = await api.post('/import/execute', fd)
      setResult(res.data)
      setStep('result')
    } catch (e) {
      alert(e.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setStep('upload'); setPreview(null); setFileObj(null)
    setMapping({}); setResult(null); setUploadError('')
  }

  // ── helpers ──────────────────────────────────────────────
  const setColMap = (fieldKey, value) => {
    setMapping((m) => ({ ...m, [fieldKey]: value === '' ? undefined : Number(value) }))
  }
  const setFixed = (fieldKey, value) => {
    setFixedValues((f) => ({ ...f, [fieldKey]: value }))
    // clear column mapping for this field to use fixed value
    setMapping((m) => { const n = { ...m }; delete n[fieldKey]; return n })
  }

  // ── step indicator ───────────────────────────────────────
  const steps = [
    { id: 'upload', label: t('import.step1') },
    { id: 'map',    label: t('import.step2') },
    { id: 'result', label: t('import.step3') },
  ]
  const stepIdx = steps.findIndex((s) => s.id === step)

  return (
    <div className="space-y-4 max-w-5xl">
      <Header title={t('import.title')} subtitle={t('import.subtitle')} />

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              i === stepIdx ? 'bg-yellow-600 text-white' :
              i < stepIdx  ? 'bg-yellow-100 text-yellow-700' :
                             'bg-slate-100 text-slate-400'
            }`}>
              <span>{STEP_ICONS[s.id]}</span>
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-8 ${i < stepIdx ? 'bg-yellow-400' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Upload ─────────────────────────────── */}
      {step === 'upload' && (
        <div className="card">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsm" className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />

          <div
            onClick={() => !uploading && fileInputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
              dragging ? 'border-yellow-400 bg-yellow-50' : 'border-slate-200 hover:border-yellow-300 hover:bg-slate-50'
            } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            {uploading ? (
              <div className="space-y-3">
                <div className="text-5xl animate-bounce">📊</div>
                <p className="text-slate-500 font-medium">{t('import.uploading')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-6xl">📂</div>
                <p className="text-slate-700 font-semibold text-lg">{t('import.dropzone')}</p>
                <p className="text-slate-400 text-sm">{t('import.dropzoneHint')}</p>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
              <span>⚠️</span> {uploadError}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Map & Preview ──────────────────────── */}
      {step === 'map' && preview && (
        <div className="space-y-4">
          {/* File info bar */}
          <div className="card !p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <p className="font-semibold text-slate-800">{preview.filename}</p>
                <p className="text-xs text-slate-400">
                  {preview.total_data_rows} data rows · {preview.headers.length} columns
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">{t('import.importAs')}</span>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                {[
                  { val: 'requests', label: t('import.targetRequests'), icon: '📋' },
                  { val: 'assets',   label: t('import.targetAssets'),   icon: '🖥️' },
                  { val: 'licensed_software', label: t('import.targetLicensedSoftware'), icon: '📜' },
                ].map((opt) => (
                  <button key={opt.val} onClick={() => { setTarget(opt.val); setMapping({}) }}
                    className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                      target === opt.val ? 'bg-yellow-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt.icon}</span><span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview table */}
          <div className="card !p-0 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <p className="font-semibold text-slate-700 text-sm">{t('import.previewTitle')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-slate-400 font-medium ltr:text-left rtl:text-right w-8">#</th>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-slate-600 font-semibold ltr:text-left rtl:text-right whitespace-nowrap">
                        <span className="text-slate-400 font-normal ltr:mr-1 rtl:ml-1">{String.fromCharCode(65 + i)}:</span>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {preview.sample_rows.map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="px-3 py-1.5 text-slate-300">{ri + 2}</td>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[180px] truncate">
                          {cell || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column mapping */}
          <div className="card">
            <div className="mb-4">
              <h3 className="font-bold text-slate-800">{t('import.mappingTitle')}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{t('import.mappingHint')}</p>
            </div>

            <div className="space-y-3">
              {FIELDS[target].map(({ key, required, fixedOptions }) => {
                const isFixed = mapping[key] === undefined && fixedOptions
                return (
                  <div key={key} className="grid grid-cols-2 gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${required ? 'bg-red-400' : 'bg-slate-300'}`} />
                      <span className="text-sm font-medium text-slate-700">{t(`import.field.${key}`)}</span>
                      {required && <span className="text-xs text-red-400">({t('import.required')})</span>}
                    </div>

                    <div className="flex gap-2">
                      {/* Column selector */}
                      <select
                        className="form-select flex-1 !py-1.5 text-xs"
                        value={mapping[key] ?? ''}
                        onChange={(e) => {
                          if (e.target.value === '') {
                            setColMap(key, '')
                          } else {
                            setColMap(key, e.target.value)
                          }
                        }}
                      >
                        <option value="">{fixedOptions ? `${t('import.fixedValue')} ↓` : t('import.skipColumn')}</option>
                        {preview.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {String.fromCharCode(65 + i)}: {h}
                          </option>
                        ))}
                      </select>

                      {/* Fixed value fallback for fields with options */}
                      {fixedOptions && mapping[key] === undefined && (
                        <select
                          className="form-select w-28 !py-1.5 text-xs bg-amber-50 border-amber-200"
                          value={fixedValues[key] || fixedOptions[0]}
                          onChange={(e) => setFixed(key, e.target.value)}
                        >
                          {fixedOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
              <button onClick={reset} className="btn-secondary">{t('import.back')}</button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="btn-primary flex-1 justify-center"
              >
                {importing
                  ? `${t('import.importing')} (${preview.total_data_rows} rows)`
                  : `${t('import.startImport')} — ${preview.total_data_rows} rows`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Results ────────────────────────────── */}
      {step === 'result' && result && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card border-2 border-yellow-100 bg-yellow-50 text-center">
              <div className="text-4xl font-bold text-yellow-600">{result.imported}</div>
              <div className="text-sm text-yellow-700 mt-1">{t('import.successMsg')}</div>
            </div>
            <div className="card border-2 border-yellow-100 bg-yellow-50 text-center">
              <div className="text-4xl font-bold text-yellow-500">{result.skipped}</div>
              <div className="text-sm text-yellow-700 mt-1">{t('import.skippedMsg')}</div>
            </div>
            <div className="card border-2 border-slate-100 text-center">
              <div className="text-4xl font-bold text-slate-600">{result.total}</div>
              <div className="text-sm text-slate-500 mt-1">{t('import.totalMsg')}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="card !p-4">
            <div className="flex justify-between text-sm text-slate-500 mb-1.5">
              <span>Import Progress</span>
              <span>{result.imported}/{result.total}</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 rounded-full transition-all"
                style={{ width: result.total ? `${(result.imported / result.total) * 100}%` : '0%' }}
              />
            </div>
          </div>

          {/* Errors */}
          {result.errors?.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                <p className="font-semibold text-red-700 text-sm">
                  ⚠️ {t('import.errorsTitle')} ({result.errors.length})
                </p>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="px-5 py-2.5 flex items-start gap-3 text-sm">
                    <span className="text-slate-400 shrink-0">{t('import.rowLabel')} {e.row}</span>
                    <span className="text-slate-600">{e.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={reset} className="btn-primary w-full justify-center">
            {t('import.newImport')}
          </button>
        </div>
      )}
    </div>
  )
}
