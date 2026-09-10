import { createContext, useContext, useState, useEffect } from 'react'

export const THEMES = {
  yellow: { label: 'أصفر', swatch: '#ca8a04', metaColor: '#ca8a04' },
  blue:   { label: 'أزرق', swatch: '#2563eb', metaColor: '#2563eb' },
  purple: { label: 'بنفسجي', swatch: '#9333ea', metaColor: '#9333ea' },
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('it_theme') || 'yellow'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEMES[theme]?.metaColor || THEMES.yellow.metaColor)
  }, [theme])

  const setTheme = (t) => {
    localStorage.setItem('it_theme', t)
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
