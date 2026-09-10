import { createContext, useContext, useState } from 'react'

const DisplayContext = createContext(null)

export function DisplayProvider({ children }) {
  // Default: sidebar hidden behind a hamburger toggle on all screens, to keep
  // the maximum width available for wide tables/dashboards. Users who
  // explicitly opted out before (stored "false") keep their choice.
  const [mobileView, setMobileViewState] = useState(() => {
    const stored = localStorage.getItem('pref_mobile_view')
    return stored === null ? true : stored === 'true'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const setMobileView = (val) => {
    localStorage.setItem('pref_mobile_view', String(val))
    setMobileViewState(val)
    if (!val) setSidebarOpen(false)
  }

  return (
    <DisplayContext.Provider value={{ mobileView, setMobileView, sidebarOpen, setSidebarOpen }}>
      {children}
    </DisplayContext.Provider>
  )
}

export function useDisplay() {
  return useContext(DisplayContext)
}
