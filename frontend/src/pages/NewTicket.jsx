import { useState, useEffect, useRef } from 'react'
import { departmentsApi, organizationsApi, branchesApi, ticketsApi, API_BASE } from '../api/client'
import { BRAND_TAGLINE } from '../constants'

async function getWaConfig() {
  try {
    const r = await fetch(`${API_BASE}/channels/public`)
    if (r.ok) return r.json()
  } catch {}
  return null
}

/* ── Data ─────────────────────────────────────── */
const PRIORITIES = [
  {
    value: 'low',
    label: 'منخفضة',
    sub: 'مشكلة بسيطة لا تعيق العمل',
    icon: '🟡',
    active: 'border-yellow-400 bg-yellow-50 text-yellow-800',
  },
  {
    value: 'medium',
    label: 'متوسطة',
    sub: 'تؤثر على الإنتاجية جزئياً',
    icon: '🟠',
    active: 'border-yellow-400 bg-yellow-50 text-yellow-800',
  },
  {
    value: 'high',
    label: 'عالية',
    sub: 'مشكلة كبيرة تحتاج تدخلاً سريعاً',
    icon: '🔴',
    active: 'border-red-400 bg-red-50 text-red-800',
  },
  {
    value: 'critical',
    label: 'حرجة',
    sub: 'توقف العمل كلياً — طوارئ',
    icon: '🚨',
    active: 'border-red-600 bg-red-100 text-red-900',
  },
]

const STEPS = [
  { id: 1, title: 'معلوماتك',   icon: '👤' },
  { id: 2, title: 'المشكلة',    icon: '💬' },
  { id: 3, title: 'الأولوية',   icon: '⚡' },
]

const CATEGORIES = [
  { value: 'network',            label: 'مشكلة شبكة',      icon: '🌐' },
  { value: 'laptop_maintenance', label: 'صيانة لاب توب',   icon: '💻' },
  { value: 'internet',           label: 'انترنت بيقطع',    icon: '📶' },
  { value: 'printing',           label: 'مشكلة طباعة',     icon: '🖨️' },
  { value: 'other',              label: 'أخرى',            icon: '❓' },
]

const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024 // 2MB

const empty = {
  requester_name: '', requester_email: '', department_id: '',
  organization_id: '', branch_id: '',
  title: '', description: '', category: '', priority: 'medium', asset_id: '',
}

/* ── Select with inline "add new" ─────────────── */
function SelectWithAdd({ label, options, value, onChange, onAdd, addPlaceholder, emptyLabel }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const created = await onAdd(newName.trim())
      onChange(String(created.id))
      setAdding(false); setNewName('')
    } finally { setSaving(false) }
  }

  return (
    <Input label={label}>
      {adding ? (
        <div className="flex gap-2">
          <input
            autoFocus
            className="flex-1 border-2 border-yellow-300 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-yellow-500 bg-white"
            placeholder={addPlaceholder}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button type="button" onClick={handleAdd} disabled={saving}
            className="shrink-0 px-4 rounded-2xl bg-yellow-600 text-white font-bold disabled:opacity-50">✓</button>
          <button type="button" onClick={() => { setAdding(false); setNewName('') }}
            className="shrink-0 px-4 rounded-2xl bg-slate-100 text-slate-500 font-bold">✕</button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            className="flex-1 border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-yellow-500 bg-white"
            value={value}
            onChange={e => onChange(e.target.value)}
          >
            <option value="">{emptyLabel}</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button type="button" onClick={() => setAdding(true)}
            className="shrink-0 px-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold text-sm active:bg-slate-50">
            + جديد
          </button>
        </div>
      )}
    </Input>
  )
}

/* ── Helpers ──────────────────────────────────── */
function Input({ label, required, error, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[15px] font-semibold text-slate-700">
        {label}{required && <span className="text-red-500 mr-0.5">*</span>}
      </label>
      {children}
      {hint  && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><span>⚠️</span>{error}</p>}
    </div>
  )
}

/* ── Main Component ───────────────────────────── */
export default function NewTicket() {
  const [form, setForm]         = useState({ ...empty })
  const [departments, setDepts] = useState([])
  const [organizations, setOrgs] = useState([])
  const [branches, setBranches] = useState([])
  const [step, setStep]         = useState(1)          // 1 | 2 | 3
  const [screen, setScreen]     = useState('wizard')   // wizard | success
  const [saving, setSaving]     = useState(false)
  const [errors, setErrors]     = useState({})
  const [ticket, setTicket]     = useState(null)
  const [dir, setDir]           = useState(1)          // 1=forward -1=back
  const [waConfig, setWaConfig] = useState(null)
  const [empCode, setEmpCode]   = useState('')
  const [empLookup, setEmpLookup] = useState(null)   // null | 'loading' | 'found' | 'not_found'
  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState('')
  const [kbSuggestions, setKbSuggestions] = useState([])
  const [kbLoading, setKbLoading]     = useState(false)
  const [kbDismissed, setKbDismissed] = useState(false)
  const [prefillAsset, setPrefillAsset] = useState(null) // { id, name } — from a device's QR code
  const topRef                  = useRef()
  const lookupTimer             = useRef()

  useEffect(() => {
    departmentsApi.list().then(r => setDepts(r.data)).catch(() => {})
    organizationsApi.list().then(r => setOrgs(r.data)).catch(() => {})
    branchesApi.list().then(r => setBranches(r.data)).catch(() => {})
    getWaConfig().then(cfg => { if (cfg?.whatsapp_phone) setWaConfig(cfg) })

    // A device's QR code links here with ?asset=<id>&category=<slug> pre-filled
    const params = new URLSearchParams(window.location.search)
    const assetId = params.get('asset')
    const category = params.get('category')
    if (category && CATEGORIES.some(c => c.value === category)) {
      setForm(f => ({ ...f, category }))
    }
    if (assetId) {
      setForm(f => ({ ...f, asset_id: assetId }))
      fetch(`${API_BASE}/assets/${assetId}`)
        .then(r => r.ok ? r.json() : null)
        .then(a => { if (a) setPrefillAsset({ id: a.id, name: a.name }) })
        .catch(() => {})
    }
  }, [])

  /* KB self-service suggestions while typing the problem title (step 2) */
  useEffect(() => {
    if (step !== 2) return
    const q = form.title.trim()
    if (q.length < 4) { setKbSuggestions([]); return }
    setKbLoading(true)
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/tickets/knowledge-base?search=${encodeURIComponent(q)}&page_size=3`)
        if (r.ok) {
          const data = await r.json()
          const items = data.items || []
          setKbSuggestions(items)
          if (items.length > 0) setKbDismissed(false)
        }
      } catch {} finally { setKbLoading(false) }
    }, 600)
    return () => clearTimeout(timer)
  }, [form.title, step])

  const handleAttachment = (file) => {
    if (!file) { setAttachment(null); setAttachmentPreview(''); return }
    if (!file.type.startsWith('image/')) {
      setErrors(e => ({ ...e, attachment: 'الملف المسموح به صورة فقط' })); return
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setErrors(e => ({ ...e, attachment: 'الحجم الأقصى المسموح به 2 ميجابايت' })); return
    }
    setErrors(e => ({ ...e, attachment: '' }))
    setAttachment(file)
    setAttachmentPreview(URL.createObjectURL(file))
  }

  const lookupEmployee = (val) => {
    setEmpCode(val)
    clearTimeout(lookupTimer.current)
    if (!val.trim()) { setEmpLookup(null); return }
    setEmpLookup('loading')
    lookupTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/employees/lookup?q=${encodeURIComponent(val.trim())}`)
        if (r.ok) {
          const emp = await r.json()
          setEmpLookup('found')
          setForm(f => ({
            ...f,
            requester_name: emp.name || f.requester_name,
            requester_email: emp.email,
          }))
          setErrors(e => ({ ...e, requester_name: '', requester_email: '' }))
        } else {
          setEmpLookup('not_found')
        }
      } catch { setEmpLookup('not_found') }
    }, 600)
  }

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }))
  }

  /* scroll to top on step change */
  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' })

  /* ── Validation per step ── */
  const validate = (s) => {
    const e = {}
    if (s === 1) {
      if (!form.requester_name.trim())  e.requester_name  = 'الاسم مطلوب'
      if (!form.requester_email.trim()) e.requester_email = 'البريد مطلوب'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.requester_email))
        e.requester_email = 'صيغة البريد غير صحيحة'
    }
    if (s === 2) {
      if (!form.title.trim()) e.title = 'عنوان المشكلة مطلوب'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (!validate(step)) return
    setDir(1)
    setStep(s => s + 1)
    scrollTop()
  }

  const back = () => {
    setDir(-1)
    setStep(s => s - 1)
    scrollTop()
  }

  const submit = async () => {
    if (!validate(3)) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/tickets/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          department_id: form.department_id || null,
          organization_id: form.organization_id || null,
          branch_id: form.branch_id || null,
          category: form.category || null,
          asset_id: form.asset_id ? Number(form.asset_id) : null,
          status: 'open',
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      if (attachment) {
        const fd = new FormData()
        fd.append('file', attachment)
        try { await ticketsApi.uploadAttachment(created.id, fd) } catch {}
      }
      setTicket(created)
      setScreen('success')
      scrollTop()
    } catch {
      setErrors({ submit: 'حدث خطأ أثناء الإرسال، حاول مرة أخرى' })
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setForm({ ...empty }); setStep(1); setErrors({})
    setAttachment(null); setAttachmentPreview('')
    setScreen('wizard'); setTicket(null)
  }

  /* ── SUCCESS ── */
  if (screen === 'success') return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-600 to-yellow-700 flex flex-col" dir="rtl">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-5">
        {/* Animated checkmark */}
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-5xl animate-bounce">
              ✅
            </div>
          </div>
        </div>

        <div className="text-white space-y-2">
          <h2 className="text-3xl font-black">تم الإرسال!</h2>
          <p className="text-yellow-100 text-base">طلبك وصل لفريق IT بنجاح</p>
        </div>

        {/* Ticket card */}
        <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
          <div className="text-center">
            <p className="text-slate-400 text-sm mb-1">رقم التذكرة</p>
            <p className="text-6xl font-black text-yellow-600">#{ticket?.id}</p>
          </div>

          <div className="divide-y divide-slate-50 text-sm">
            {[
              { label: 'الموضوع',  value: ticket?.title },
              { label: 'المقدم',   value: ticket?.requester_name },
              { label: 'الأولوية', value: PRIORITIES.find(p => p.value === ticket?.priority)?.label },
              { label: 'الحالة',   value: 'مفتوحة — قيد المراجعة' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2.5 gap-2">
                <span className="text-slate-400">{row.label}</span>
                <span className="font-semibold text-slate-700 text-left">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-yellow-50 rounded-2xl p-3 text-center">
            <p className="text-xs text-yellow-700">
              سيتواصل معك الفريق على
            </p>
            <p className="text-sm font-bold text-yellow-800 mt-0.5 break-all">
              {ticket?.requester_email}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 pb-safe space-y-2.5">
        <button
          onClick={reset}
          className="w-full py-4 rounded-2xl bg-white text-yellow-700 font-bold text-lg shadow-lg active:scale-95 transition-transform"
        >
          تقديم طلب جديد
        </button>
        <a
          href="/track-ticket"
          className="block w-full text-center py-3 rounded-2xl bg-white/10 text-white font-semibold active:bg-white/20 transition-colors"
        >
          🔍 تتبّع حالة هذا الطلب لاحقًا
        </a>
      </div>
    </div>
  )

  /* ── WIZARD ── */
  const progress = ((step - 1) / STEPS.length) * 100 + (100 / STEPS.length)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl" ref={topRef}>

      {/* ── Top bar ── */}
      <div className="bg-yellow-600 text-white px-5 pt-safe-top pb-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shrink-0 p-1.5">
            <img src="/mobica-logo.png" alt="Mobica" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight">طلب دعم فني</p>
            <p className="text-yellow-200 text-xs">{BRAND_TAGLINE}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {waConfig && (
              <a
                href={`https://wa.me/${waConfig.whatsapp_phone.replace(/\D/g,'')}?text=${encodeURIComponent(waConfig.whatsapp_message_ar)}`}
                target="_blank" rel="noreferrer"
                className="text-xs bg-green-500 hover:bg-green-600 text-white rounded-xl px-2.5 py-1.5 font-semibold flex items-center gap-1"
              >
                💬 واتساب
              </a>
            )}
            <span className="text-yellow-200 text-sm">{step}/{STEPS.length}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step pills */}
        <div className="flex justify-between mt-3">
          {STEPS.map(s => (
            <div key={s.id} className={`flex items-center gap-1.5 text-xs transition-all ${
              s.id === step ? 'text-white font-bold' :
              s.id < step  ? 'text-yellow-300' : 'text-yellow-400/60'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                s.id < step  ? 'bg-white text-yellow-700' :
                s.id === step ? 'bg-white/30 text-white' : 'bg-white/10 text-yellow-300'
              }`}>
                {s.id < step ? '✓' : s.id}
              </span>
              {s.title}
            </div>
          ))}
        </div>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 px-5 py-6 space-y-5 max-w-lg mx-auto w-full">

        {/* ── STEP 1: Personal info ── */}
        {step === 1 && (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-800">معلوماتك الشخصية</h2>
              <p className="text-slate-400 text-sm">سنتواصل معك على هذه البيانات</p>
            </div>

            {/* Employee code lookup */}
            <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 space-y-2">
              <p className="text-sm font-semibold text-yellow-800">🔍 ابحث بكود الموظف أو الإيميل</p>
              <div className="relative">
                <input
                  value={empCode}
                  onChange={e => lookupEmployee(e.target.value)}
                  placeholder="مثال: 104330 أو ahmed@mobica.net"
                  className="w-full border-2 border-yellow-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-yellow-500 bg-white"
                  dir="ltr"
                />
                {empLookup === 'loading' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm animate-pulse">⏳</span>
                )}
                {empLookup === 'found' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-500 text-sm">✅</span>
                )}
                {empLookup === 'not_found' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400 text-sm">❌</span>
                )}
              </div>
              {empLookup === 'found' && (
                <p className="text-xs text-yellow-600">تم ملء البيانات تلقائيًا ↓</p>
              )}
              {empLookup === 'not_found' && (
                <p className="text-xs text-red-500">لم يتم العثور على الموظف — يمكنك الإدخال اليدوي</p>
              )}
            </div>

            <Input label="الاسم الكامل" required error={errors.requester_name}>
              <input
                className={`w-full border-2 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-yellow-500 bg-white transition-colors ${
                  errors.requester_name ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="مثال: أحمد محمد"
                inputMode="text"
                autoComplete="name"
                value={form.requester_name}
                onChange={e => set('requester_name', e.target.value)}
              />
            </Input>

            <Input label="البريد الإلكتروني" required error={errors.requester_email}
              hint="سيصلك تأكيد على هذا البريد">
              <input
                type="email"
                className={`w-full border-2 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-yellow-500 bg-white transition-colors ${
                  errors.requester_email ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="your.name@mobica.net"
                inputMode="email"
                autoComplete="email"
                value={form.requester_email}
                onChange={e => set('requester_email', e.target.value)}
              />
            </Input>

            {departments.length > 0 && (
              <Input label="الإدارة / القسم">
                <select
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-yellow-500 bg-white"
                  value={form.department_id}
                  onChange={e => set('department_id', e.target.value)}
                >
                  <option value="">— اختر إدارتك —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Input>
            )}

            <SelectWithAdd
              label="المؤسسة"
              options={organizations}
              value={form.organization_id}
              onChange={v => set('organization_id', v)}
              onAdd={async (name) => {
                const r = await organizationsApi.create(name)
                setOrgs(o => o.some(x => x.id === r.data.id) ? o : [...o, r.data])
                return r.data
              }}
              addPlaceholder="اسم المؤسسة الجديدة"
              emptyLabel="— اختر المؤسسة (اختياري) —"
            />

            <SelectWithAdd
              label="الفرع"
              options={branches}
              value={form.branch_id}
              onChange={v => set('branch_id', v)}
              onAdd={async (name) => {
                const r = await branchesApi.create(name, form.organization_id || null)
                setBranches(b => b.some(x => x.id === r.data.id) ? b : [...b, r.data])
                return r.data
              }}
              addPlaceholder="اسم الفرع الجديد"
              emptyLabel="— اختر الفرع (اختياري) —"
            />
          </>
        )}

        {/* ── STEP 2: Problem ── */}
        {step === 2 && (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-800">ما هي المشكلة؟</h2>
              <p className="text-slate-400 text-sm">اشرح المشكلة بوضوح لنتمكن من مساعدتك بسرعة</p>
            </div>

            {prefillAsset && (
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-2xl px-4 py-2.5 text-sm text-yellow-800">
                <span>🖥️</span>
                <span>بخصوص الجهاز: <strong>{prefillAsset.name}</strong></span>
              </div>
            )}

            <Input label="عنوان المشكلة" required error={errors.title}
              hint="جملة قصيرة تصف المشكلة">
              <input
                className={`w-full border-2 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-yellow-500 bg-white transition-colors ${
                  errors.title ? 'border-red-300' : 'border-slate-200'
                }`}
                placeholder="مثال: الطابعة لا تعمل / مشكلة في الإنترنت"
                value={form.title}
                onChange={e => set('title', e.target.value)}
              />
            </Input>

            {kbLoading && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">⏳ جاري البحث عن حلول مشابهة...</p>
            )}

            {kbSuggestions.length > 0 && !kbDismissed && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-blue-800">💡 حلول مشابهة قد تفيدك</p>
                  <button type="button" onClick={() => setKbDismissed(true)} className="text-blue-400 text-xs shrink-0">إخفاء ✕</button>
                </div>
                <div className="space-y-2">
                  {kbSuggestions.map(item => (
                    <div key={item.id} className="bg-white rounded-xl p-3 border border-blue-100">
                      <p className="text-sm font-semibold text-slate-700">{item.title}</p>
                      {item.steps && item.steps.length > 0 ? (
                        <ul className="mt-1.5 space-y-1">
                          {item.steps.slice(0, 3).map((s, i) => (
                            <li key={i} className="text-xs text-slate-500 flex gap-1.5">
                              <span className="shrink-0">{i + 1}.</span><span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      ) : item.resolution ? (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-3">{item.resolution}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-blue-500">
                  جرّب الحل ده الأول، ولو المشكلة لسه موجودة كمّل تقديم الطلب عادي في الخطوات الجاية.
                </p>
              </div>
            )}

            <Input label="وصف المشكلة بالتفصيل"
              hint="متى بدأت؟ ماذا جربت؟ هل تؤثر على زملائك؟">
              <textarea
                rows={5}
                className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-yellow-500 bg-white transition-colors resize-none"
                placeholder="اكتب هنا وصفاً تفصيلياً..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </Input>

            {/* Quick shortcuts */}
            <div>
              <p className="text-xs text-slate-400 mb-2">اختصارات شائعة:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  'لا أستطيع الدخول للنظام',
                  'الكمبيوتر بطيء جداً',
                  'الطابعة لا تعمل',
                  'مشكلة في الإنترنت',
                  'نسيت كلمة المرور',
                  'الشاشة لا تعمل',
                ].map(t => (
                  <button key={t} type="button"
                    onClick={() => set('title', t)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      form.title === t
                        ? 'border-yellow-500 bg-yellow-50 text-yellow-700 font-medium'
                        : 'border-slate-200 bg-white text-slate-500 active:bg-slate-50'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <Input label="نوع المشكلة">
              <div className="grid grid-cols-2 gap-2.5">
                {CATEGORIES.map(c => (
                  <button key={c.value} type="button"
                    onClick={() => set('category', form.category === c.value ? '' : c.value)}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 text-start transition-all ${
                      form.category === c.value
                        ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}>
                    <span className="text-2xl shrink-0">{c.icon}</span>
                    <span className="text-sm font-semibold">{c.label}</span>
                  </button>
                ))}
              </div>
            </Input>

            {/* Attachment */}
            <Input label="إرفاق صورة (اختياري)" hint="بحد أقصى 2 ميجابايت" error={errors.attachment}>
              <input
                id="attach-file"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleAttachment(e.target.files?.[0])}
              />
              {attachment ? (
                <div className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-2xl bg-white">
                  <img src={attachmentPreview} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{attachment.name}</p>
                    <p className="text-xs text-slate-400">{(attachment.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button type="button" onClick={() => handleAttachment(null)}
                    className="shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">✕</button>
                </div>
              ) : (
                <label htmlFor="attach-file"
                  className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-medium cursor-pointer active:bg-slate-50">
                  📎 اضغط لإرفاق صورة للمشكلة
                </label>
              )}
            </Input>
          </>
        )}

        {/* ── STEP 3: Priority ── */}
        {step === 3 && (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-800">درجة الإلحاح</h2>
              <p className="text-slate-400 text-sm">اختر ما يناسب حالتك</p>
            </div>

            <div className="space-y-3">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set('priority', p.value)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-start transition-all active:scale-[.98] ${
                    form.priority === p.value
                      ? p.active + ' shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <span className="text-3xl shrink-0">{p.icon}</span>
                  <div className="flex-1">
                    <p className="font-bold text-base">{p.label}</p>
                    <p className="text-sm opacity-70">{p.sub}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    form.priority === p.value ? 'border-current' : 'border-slate-300'
                  }`}>
                    {form.priority === p.value && (
                      <div className="w-2.5 h-2.5 rounded-full bg-current" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Summary review */}
            <div className="bg-white border-2 border-slate-100 rounded-2xl p-4 space-y-2 text-sm">
              <p className="font-bold text-slate-600 text-xs uppercase tracking-wide mb-3">مراجعة الطلب</p>
              {[
                { icon: '👤', label: form.requester_name },
                { icon: '📧', label: form.requester_email },
                { icon: '💬', label: form.title },
                form.category && { icon: CATEGORIES.find(c => c.value === form.category)?.icon, label: CATEGORIES.find(c => c.value === form.category)?.label },
                form.organization_id && { icon: '🏢', label: organizations.find(o => String(o.id) === String(form.organization_id))?.name },
                form.branch_id && { icon: '📍', label: branches.find(b => String(b.id) === String(form.branch_id))?.name },
                attachment && { icon: '📎', label: attachment.name },
              ].filter(Boolean).map((r, i) => (
                <div key={i} className="flex items-start gap-2.5 text-slate-600">
                  <span className="shrink-0 mt-0.5">{r.icon}</span>
                  <span className="break-all">{r.label}</span>
                </div>
              ))}
            </div>

            {errors.submit && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm text-center">
                ⚠️ {errors.submit}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Bottom navigation (sticky) ── */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-4 pb-safe space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {/* Next / Submit */}
        {step < 3 ? (
          <button
            onClick={next}
            className="w-full py-4 rounded-2xl bg-yellow-600 text-white font-bold text-lg active:bg-yellow-700 active:scale-[.98] transition-all shadow-sm"
          >
            التالي ←
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-yellow-600 disabled:opacity-60 text-white font-bold text-lg active:bg-yellow-700 active:scale-[.98] transition-all shadow-sm"
          >
            {saving ? '⏳ جاري الإرسال...' : '📤 إرسال الطلب'}
          </button>
        )}

        {/* Back */}
        {step > 1 && (
          <button
            onClick={back}
            className="w-full py-3 rounded-2xl bg-slate-100 text-slate-600 font-semibold text-base active:bg-slate-200 transition-all"
          >
            → رجوع
          </button>
        )}
      </div>
    </div>
  )
}
