import { useState, useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'

const API = 'http://localhost:8000/api'

function token() {
  return localStorage.getItem('it_token') || ''
}

async function apiFetch(path, opts = {}) {
  const r = await fetch(API + path, {
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// ── Small reusable components ────────────────────────────────────────────────

function StatusBadge({ running }) {
  return running
    ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />يعمل</span>
    : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />متوقف</span>
}

function SectionCard({ title, icon, children }) {
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h3 className="font-semibold text-slate-700 text-sm">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function StepList({ steps }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
          <span className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  )
}

// ── Telegram Tab ─────────────────────────────────────────────────────────────

function TelegramTab({ t }) {
  const [status, setStatus]     = useState(null)
  const [config, setConfig]     = useState(null)
  const [token_, setToken_]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved,  setSaved]      = useState(false)
  const [savingToken, setSavingToken] = useState(false)
  const [form, setForm]         = useState({})

  const load = async () => {
    try {
      const [st, cfg] = await Promise.all([
        apiFetch('/channels/telegram/status'),
        apiFetch('/channels/config'),
      ])
      setStatus(st)
      setConfig(cfg)
      setForm({
        enabled:     cfg.enabled,
        language:    cfg.language || 'ar',
        welcome_ar:  cfg.welcome_ar || '',
        welcome_en:  cfg.welcome_en || '',
        success_ar:  cfg.success_ar || '',
        success_en:  cfg.success_en || '',
      })
    } catch (e) { console.error(e) }
  }

  useEffect(() => { load() }, [])

  const saveToken = async () => {
    if (!token_.trim()) return
    setSavingToken(true)
    try {
      await apiFetch('/channels/telegram/token', { method: 'POST', body: JSON.stringify({ token: token_.trim() }) })
      setToken_('')
      await load()
    } finally { setSavingToken(false) }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await apiFetch('/channels/config', { method: 'POST', body: JSON.stringify(form) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await load()
    } finally { setSaving(false) }
  }

  const startBot = async () => {
    try { await apiFetch('/channels/telegram/start', { method: 'POST' }); await load() } catch (e) { alert(e.message) }
  }
  const stopBot = async () => {
    try { await apiFetch('/channels/telegram/stop', { method: 'POST' }); await load() } catch (e) { alert(e.message) }
  }

  if (!status || !config) return <div className="py-12 text-center text-slate-400 text-sm">جاري التحميل...</div>

  return (
    <div className="space-y-5">
      {/* Status header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-sky-100 rounded-2xl flex items-center justify-center text-2xl">✈️</div>
          <div>
            <h3 className="font-bold text-slate-800">Telegram Bot</h3>
            <StatusBadge running={status.running} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {status.bot_username && (
            <a
              href={`https://t.me/${status.bot_username}`}
              target="_blank" rel="noreferrer"
              className="btn-secondary !py-1.5 !text-xs"
            >
              {t('ch.tgBotLink')} @{status.bot_username}
            </a>
          )}
          {status.running
            ? <button onClick={stopBot} className="btn-danger !py-1.5 !text-xs">{t('ch.tgStop')}</button>
            : <button onClick={startBot} disabled={!status.has_token} className="btn-success !py-1.5 !text-xs disabled:opacity-40">{t('ch.tgStart')}</button>
          }
        </div>
      </div>

      {/* How the flow works */}
      <SectionCard title={t('ch.flow')} icon="🔄">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[t('ch.flow1'), t('ch.flow2'), t('ch.flow3'), t('ch.flow4')].map((step, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">{['💬','🔘','🎫','✅'][i]}</div>
              <p className="text-xs text-slate-600 leading-snug">{step}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Token */}
      <SectionCard title={t('ch.tgToken')} icon="🔑">
        {status.has_token && (
          <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg">
            <span>✅</span>
            <span>تم حفظ الرمز{status.bot_name ? ` · ${status.bot_name}` : ''}</span>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="password"
            className="form-input flex-1 !text-sm"
            placeholder={t('ch.tgTokenPlh')}
            value={token_}
            onChange={e => setToken_(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveToken()}
          />
          <button onClick={saveToken} disabled={!token_.trim() || savingToken} className="btn-primary !py-2 !px-4 !text-sm disabled:opacity-40">
            {savingToken ? '...' : t('ch.tgTokenSave')}
          </button>
        </div>
        <StepList steps={[t('ch.tgStep1'), t('ch.tgStep2'), t('ch.tgStep3'), t('ch.tgStep4')]} />
      </SectionCard>

      {/* Settings */}
      <SectionCard title={t('ch.tgSaveSettings')} icon="⚙️">
        <div className="grid grid-cols-2 gap-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between col-span-2">
            <label className="text-sm font-medium text-slate-700">{t('ch.tgEnable')}</label>
            <button
              onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.enabled ? 'bg-yellow-500' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Language */}
          <div className="col-span-2">
            <label className="form-label">{t('ch.tgLanguage')}</label>
            <div className="flex gap-2">
              {[['ar', t('ch.tgLangAr')], ['en', t('ch.tgLangEn')]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setForm(f => ({ ...f, language: val }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                    form.language === val ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-slate-100 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Welcome messages */}
          <div>
            <label className="form-label">{t('ch.tgWelcomeAr')}</label>
            <textarea className="form-input !text-sm" rows={3} value={form.welcome_ar || ''} onChange={e => setForm(f => ({ ...f, welcome_ar: e.target.value }))} dir="rtl" />
          </div>
          <div>
            <label className="form-label">{t('ch.tgWelcomeEn')}</label>
            <textarea className="form-input !text-sm" rows={3} value={form.welcome_en || ''} onChange={e => setForm(f => ({ ...f, welcome_en: e.target.value }))} dir="ltr" />
          </div>

          {/* Success messages */}
          <div>
            <label className="form-label">{t('ch.tgSuccessAr')}</label>
            <textarea className="form-input !text-sm" rows={3} value={form.success_ar || ''} onChange={e => setForm(f => ({ ...f, success_ar: e.target.value }))} dir="rtl" />
            <p className="text-xs text-slate-400 mt-1">استخدم {`#{id}`} لرقم التذكرة</p>
          </div>
          <div>
            <label className="form-label">{t('ch.tgSuccessEn')}</label>
            <textarea className="form-input !text-sm" rows={3} value={form.success_en || ''} onChange={e => setForm(f => ({ ...f, success_en: e.target.value }))} dir="ltr" />
            <p className="text-xs text-slate-400 mt-1">Use {`#{id}`} for ticket number</p>
          </div>
        </div>

        <button onClick={saveSettings} disabled={saving} className="btn-primary w-full !py-2.5 mt-2 disabled:opacity-40">
          {saving ? t('ch.saving') : saved ? t('ch.saved') : t('ch.tgSaveSettings')}
        </button>
      </SectionCard>
    </div>
  )
}

// ── WhatsApp Tab ─────────────────────────────────────────────────────────────

function WhatsAppTab({ t }) {
  const [form, setForm] = useState({
    whatsapp_phone:      '',
    whatsapp_message_ar: 'مرحباً، أحتاج مساعدة فنية. مشكلتي: ',
    whatsapp_message_en: 'Hello, I need technical support. My issue: ',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    apiFetch('/channels/config').then(cfg => {
      setForm({
        whatsapp_phone:      cfg.whatsapp_phone || '',
        whatsapp_message_ar: cfg.whatsapp_message_ar || 'مرحباً، أحتاج مساعدة فنية. مشكلتي: ',
        whatsapp_message_en: cfg.whatsapp_message_en || 'Hello, I need technical support. My issue: ',
      })
    }).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await apiFetch('/channels/config', { method: 'POST', body: JSON.stringify(form) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const phone   = form.whatsapp_phone.replace(/\D/g, '')
  const message = encodeURIComponent(form.whatsapp_message_ar)
  const waLink  = phone ? `https://wa.me/${phone}?text=${message}` : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-2xl">💬</div>
        <div>
          <h3 className="font-bold text-slate-800">WhatsApp Business</h3>
          <p className="text-sm text-slate-500">{t('ch.subtitle')}</p>
        </div>
      </div>

      <SectionCard title={t('ch.waHowTo')} icon="ℹ️">
        <StepList steps={[t('ch.waStep1'), t('ch.waStep2'), t('ch.waStep3'), t('ch.waStep4')]} />
      </SectionCard>

      <SectionCard title="إعدادات واتساب" icon="⚙️">
        <div>
          <label className="form-label">{t('ch.waPhone')}</label>
          <input
            className="form-input !text-sm"
            placeholder={t('ch.waPhonePlh')}
            value={form.whatsapp_phone}
            onChange={e => setForm(f => ({ ...f, whatsapp_phone: e.target.value }))}
            dir="ltr"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">{t('ch.waMessageAr')}</label>
            <textarea
              className="form-input !text-sm"
              rows={3}
              value={form.whatsapp_message_ar}
              onChange={e => setForm(f => ({ ...f, whatsapp_message_ar: e.target.value }))}
              dir="rtl"
            />
          </div>
          <div>
            <label className="form-label">{t('ch.waMessageEn')}</label>
            <textarea
              className="form-input !text-sm"
              rows={3}
              value={form.whatsapp_message_en}
              onChange={e => setForm(f => ({ ...f, whatsapp_message_en: e.target.value }))}
              dir="ltr"
            />
          </div>
        </div>

        {/* Link preview */}
        {waLink && (
          <div>
            <p className="form-label">{t('ch.waPreview')}</p>
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <span className="text-green-600 text-lg">💬</span>
              <a href={waLink} target="_blank" rel="noreferrer" className="text-sm text-green-700 font-mono break-all hover:underline">
                {waLink.length > 80 ? waLink.slice(0, 80) + '…' : waLink}
              </a>
            </div>
            <p className="text-xs text-slate-400 mt-1">هذا الرابط سيظهر في نموذج رفع التذاكر العام</p>
          </div>
        )}

        <button onClick={save} disabled={saving || !phone} className="btn-primary w-full !py-2.5 disabled:opacity-40">
          {saving ? t('ch.saving') : saved ? t('ch.saved') : t('ch.waSave')}
        </button>
      </SectionCard>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ChannelsConfig() {
  const { t } = useLanguage()
  const [tab, setTab] = useState('telegram')

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t('ch.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('ch.subtitle')}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {[
          { key: 'telegram',  label: t('ch.tabTelegram'),  icon: '✈️' },
          { key: 'whatsapp',  label: t('ch.tabWhatsApp'),  icon: '💬' },
        ].map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === tb.key ? 'bg-white shadow text-yellow-700' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tb.icon}</span>
            {tb.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'telegram' && <TelegramTab t={t} />}
      {tab === 'whatsapp' && <WhatsAppTab t={t} />}
    </div>
  )
}
