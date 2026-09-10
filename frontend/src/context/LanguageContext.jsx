import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from '../i18n/translations'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(
    () => localStorage.getItem('it_language') || 'en'
  )

  const setAndStore = (lang) => {
    localStorage.setItem('it_language', lang)
    setLanguage(lang)
  }

  const t = (key) =>
    translations[language]?.[key] ?? translations['en']?.[key] ?? key

  const isRTL = language === 'ar'

  useEffect(() => {
    const html = document.documentElement
    html.lang = language
    html.dir = isRTL ? 'rtl' : 'ltr'
    document.body.style.fontFamily = isRTL
      ? "'Cairo', sans-serif"
      : "'Inter', sans-serif"
  }, [language, isRTL])

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setAndStore, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
