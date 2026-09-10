import { useCurrency, CURRENCIES } from '../context/CurrencyContext'
import { useLanguage } from '../context/LanguageContext'
const LANGUAGES = {
  en: { label: 'EN', flag: '🇺🇸', name: 'English' },
  ar: { label: 'AR', flag: '🇸🇦', name: 'العربية' },
}

export default function Header({ title, subtitle }) {
  const { currency, setCurrency, CURRENCIES: C, rates, rateStatus } = useCurrency()
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Currency selector */}
        <div className="flex flex-col gap-0.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">{t('selector.currency')}</span>
            <div className="flex gap-1">
              {Object.values(CURRENCIES).map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  title={c.name}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                    currency === c.code
                      ? 'bg-yellow-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{c.flag}</span>
                  <span>{c.symbol} {c.code}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Live rate */}
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            {rateStatus === 'loading' && <span>⏳ loading rate...</span>}
            {rateStatus === 'error'   && <span>⚠️ offline rate</span>}
            {rateStatus === 'ok' && currency !== 'USD' && (
              <span>
                <span className="text-yellow-500">●</span>{' '}
                1 USD = {rates[currency]?.toLocaleString('en-US', { maximumFractionDigits: 2 })} {currency}
              </span>
            )}
            {rateStatus === 'ok' && currency === 'USD' && (
              <span>
                <span className="text-yellow-500">●</span>{' '}
                1 USD = {rates['EGP']?.toLocaleString('en-US', { maximumFractionDigits: 2 })} EGP
              </span>
            )}
          </div>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">{t('selector.language')}</span>
          <div className="flex gap-1">
            {Object.entries(LANGUAGES).map(([code, lang]) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                title={lang.name}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                  language === code
                    ? 'bg-yellow-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
