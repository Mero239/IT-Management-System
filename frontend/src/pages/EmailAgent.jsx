import { useEffect, useState, useRef } from 'react'
import Header from '../components/Header'
import { API_BASE } from '../api/client'

const API = `${API_BASE}/email-agent`

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error')
  }
  return res.json()
}

const STATUS_COLORS = {
  running:  'bg-yellow-100 text-yellow-700',
  stopped:  'bg-slate-100 text-slate-600',
  error:    'bg-red-100 text-red-600',
  starting: 'bg-yellow-100 text-yellow-700',
  stopping: 'bg-yellow-100 text-yellow-700',
}

const PROVIDERS = [
  {
    id: 'gemini', name: 'Google Gemini', model: 'gemini-1.5-flash',
    badge: '🆓 مجاني', badgeColor: 'bg-yellow-100 text-yellow-700',
    limit: '1,500 طلب/يوم', url: 'aistudio.google.com/app/apikey',
    keyField: 'gemini_api_key', hasKey: 'has_gemini_key',
    placeholder: 'AIzaSy...',
  },
  {
    id: 'groq', name: 'Groq (Llama 3.1)', model: 'llama-3.1-8b-instant',
    badge: '🆓 مجاني', badgeColor: 'bg-yellow-100 text-yellow-700',
    limit: '14,400 طلب/يوم', url: 'console.groq.com',
    keyField: 'groq_api_key', hasKey: 'has_groq_key',
    placeholder: 'gsk_...',
  },
  {
    id: 'claude', name: 'Anthropic Claude', model: 'claude-haiku',
    badge: '💳 مدفوع', badgeColor: 'bg-slate-100 text-slate-600',
    limit: '$5 = آلاف الإيميلات', url: 'console.anthropic.com',
    keyField: 'claude_api_key', hasKey: 'has_claude_key',
    placeholder: 'sk-ant-...',
  },
]

const emptyForm = {
  imap_host: 'Imap.worldposta.com', imap_port: 993,
  email: 'it.support@mobica.net', password: '',
  poll_interval: 60, ai_provider: 'gemini',
  gemini_api_key: '', groq_api_key: '', claude_api_key: '',
  auto_assign: '',
}

export default function EmailAgent() {
  const [status,     setStatus]     = useState(null)
  const [config,     setConfig]     = useState(null)
  const [history,    setHistory]    = useState([])
  const [form,       setForm]       = useState({ ...emptyForm })
  const [saving,     setSaving]     = useState(false)
  const [testing,    setTesting]    = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')
  const intervalRef = useRef()

  const loadAll = async () => {
    try {
      const [s, c, h] = await Promise.all([
        apiFetch('/status'),
        apiFetch('/config'),
        apiFetch('/history?limit=30'),
      ])
      setStatus(s)
      setConfig(c)
      setHistory(h)
      setForm(f => ({
        ...f,
        imap_host:    c.imap_host,
        imap_port:    c.imap_port,
        email:        c.email,
        poll_interval: c.poll_interval,
        auto_assign:  c.auto_assign || '',
        ai_provider:  c.ai_provider || 'gemini',
      }))
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    loadAll()
    intervalRef.current = setInterval(loadAll, 5000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      await apiFetch('/config', { method: 'PUT', body: JSON.stringify({ ...form, enabled: config?.enabled || false }) })
      setSuccess('تم حفظ الإعدادات')
      await loadAll()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleTest = async () => {
    setTesting(true); setTestResult(null); setError('')
    try {
      await apiFetch('/config', { method: 'PUT', body: JSON.stringify({ ...form, enabled: config?.enabled || false }) })
      const r = await apiFetch('/test-connection', { method: 'POST' })
      setTestResult({ ok: true, unread: r.unread })
    } catch (e) { setTestResult({ ok: false, error: e.message }) }
    finally { setTesting(false) }
  }

  const handleStart = async () => {
    setError('')
    try {
      await apiFetch('/config', { method: 'PUT', body: JSON.stringify({ ...form, enabled: true }) })
      await apiFetch('/start', { method: 'POST' })
      setSuccess('تم تشغيل العميل ✅')
      await loadAll()
    } catch (e) { setError(e.message) }
  }

  const handleStop = async () => {
    try {
      await apiFetch('/stop', { method: 'POST' })
      setSuccess('تم إيقاف العميل')
      await loadAll()
    } catch (e) { setError(e.message) }
  }

  const isRunning    = status?.running
  const agentStatus  = status?.status || 'stopped'
  const activeProvider = PROVIDERS.find(p => p.id === form.ai_provider) || PROVIDERS[0]

  return (
    <div className="space-y-5 max-w-4xl">
      <Header title="AI Ops Agent — البريد الإلكتروني" subtitle="استقبال تذاكر الدعم من it.support@mobica.net تلقائياً" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'الحالة', value: isRunning ? '🟢 يعمل' : '⚪ متوقف' },
          { label: 'تذاكر أُنشئت', value: status?.tickets_created ?? 0, sub: 'هذه الجلسة' },
          { label: 'إيميلات مُعالَجة', value: status?.emails_processed ?? 0 },
          { label: 'آخر فحص', value: status?.last_check ? new Date(status.last_check + 'Z').toLocaleTimeString('ar-EG') : '—' },
        ].map(c => (
          <div key={c.label} className="card !p-4">
            <p className="text-xs text-slate-400 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-slate-800">{c.value}</p>
            {c.sub && <p className="text-xs text-slate-400">{c.sub}</p>}
          </div>
        ))}
      </div>

      {error   && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">⚠️ {error}</div>}
      {success && <div className="p-3 bg-yellow-50 text-yellow-700 rounded-xl text-sm">✅ {success}</div>}
      {status?.last_error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          <span className="font-bold">آخر خطأ: </span>{status.last_error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Left: Config ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-700">⚙️ إعدادات البريد</h3>
            <span className={`badge ${STATUS_COLORS[agentStatus] || STATUS_COLORS.stopped}`}>{agentStatus}</span>
          </div>

          <div>
            <label className="form-label">البريد الإلكتروني</label>
            <input className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">IMAP Server</label>
              <input className="form-input" value={form.imap_host} onChange={e => setForm(f => ({ ...f, imap_host: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Port</label>
              <input type="number" className="form-input" value={form.imap_port} onChange={e => setForm(f => ({ ...f, imap_port: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="form-label">
              كلمة المرور {config?.has_password && <span className="text-yellow-600 text-xs">(محفوظة ✓)</span>}
            </label>
            <input type="password" className="form-input" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={config?.has_password ? '••••••••' : 'Password'} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">فترة الفحص (ثواني)</label>
              <input type="number" min="30" className="form-input" value={form.poll_interval}
                onChange={e => setForm(f => ({ ...f, poll_interval: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="form-label">تعيين تلقائي لـ</label>
              <input className="form-input" value={form.auto_assign}
                onChange={e => setForm(f => ({ ...f, auto_assign: e.target.value }))}
                placeholder="اسم المهندس (اختياري)" />
            </div>
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl text-sm ${testResult.ok ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
              {testResult.ok ? `✅ اتصال ناجح — ${testResult.unread} رسالة غير مقروءة` : `❌ ${testResult.error}`}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'جاري الحفظ...' : '💾 حفظ'}
            </button>
            <button onClick={handleTest} disabled={testing} className="btn-secondary">
              {testing ? '⏳' : '🔗 اختبار'}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-3">
            {isRunning ? (
              <button onClick={handleStop} className="w-full py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-medium text-sm transition-colors">
                ⏹ إيقاف العميل
              </button>
            ) : (
              <button onClick={handleStart} className="w-full py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white font-medium text-sm transition-colors">
                ▶ تشغيل العميل
              </button>
            )}
          </div>
        </div>

        {/* ── Right: AI Provider ── */}
        <div className="card space-y-4">
          <h3 className="font-bold text-slate-700">🤖 محرك الذكاء الاصطناعي</h3>

          {/* Provider cards */}
          <div className="space-y-2">
            {PROVIDERS.map(p => {
              const isSel = form.ai_provider === p.id
              const saved = config?.[p.hasKey]
              return (
                <button key={p.id} type="button"
                  onClick={() => setForm(f => ({ ...f, ai_provider: p.id }))}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-start transition-all ${
                    isSel ? 'border-yellow-500 bg-yellow-50' : 'border-slate-100 hover:border-slate-200 bg-white'
                  }`}>
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    isSel ? 'border-yellow-500' : 'border-slate-300'
                  }`}>
                    {isSel && <div className="w-2 h-2 rounded-full bg-yellow-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{p.name}</span>
                      <span className={`badge text-xs ${p.badgeColor}`}>{p.badge}</span>
                      {saved && <span className="badge bg-yellow-100 text-yellow-700 text-xs">Key ✓</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{p.model} · {p.limit}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Active provider key input */}
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <label className="form-label flex items-center gap-2">
              {activeProvider.name} API Key
              {config?.[activeProvider.hasKey] && <span className="text-yellow-600 text-xs">(محفوظ ✓)</span>}
            </label>
            <input type="password" className="form-input"
              value={form[activeProvider.keyField] || ''}
              onChange={e => setForm(f => ({ ...f, [activeProvider.keyField]: e.target.value }))}
              placeholder={config?.[activeProvider.hasKey] ? '••••••••' : activeProvider.placeholder}
            />
            <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
              <span className="text-lg">🔗</span>
              <div>
                <p className="text-xs text-slate-500">احصل على مفتاح مجاني من:</p>
                <p className="text-xs font-mono text-yellow-700 font-semibold">{activeProvider.url}</p>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">كيف يعمل:</p>
            <ol className="space-y-1.5 text-xs text-slate-500">
              {[
                'يفحص صندوق البريد كل دقيقة',
                `يحلل ${activeProvider.name} محتوى الإيميل`,
                'ينشئ تذكرة دعم تلقائياً',
                'يُحدد الإيميل كمقروء',
              ].map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="card">
        <h3 className="font-bold text-slate-700 mb-4">📬 سجل الإيميلات المُعالَجة ({history.length})</h3>
        {history.length === 0 ? (
          <p className="text-slate-400 text-center py-6 text-sm">لا توجد إيميلات مُعالَجة بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-th">الموضوع</th>
                  <th className="table-th">المُرسِل</th>
                  <th className="table-th text-center">تذكرة</th>
                  <th className="table-th">وقت المعالجة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="table-td font-medium text-slate-700 max-w-xs truncate">{row.subject}</td>
                    <td className="table-td text-slate-500 max-w-xs truncate">{row.sender}</td>
                    <td className="table-td text-center">
                      {row.ticket_id
                        ? <span className="badge bg-yellow-100 text-yellow-700">#{row.ticket_id}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-td text-slate-400 text-xs">
                      {new Date(row.processed_at).toLocaleString('ar-EG')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
