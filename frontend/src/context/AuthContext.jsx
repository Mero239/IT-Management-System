import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

const TOKEN_KEY   = 'it_token'
const ENGINEER_KEY = 'it_engineer'

export function AuthProvider({ children }) {
  const [engineer, setEngineer] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ENGINEER_KEY)) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null)
  const [loading, setLoading] = useState(true)

  // Attach token to every request
  useEffect(() => {
    const id = api.interceptors.request.use(cfg => {
      const t = localStorage.getItem(TOKEN_KEY)
      if (t) cfg.headers['Authorization'] = `Bearer ${t}`
      return cfg
    })
    return () => api.interceptors.request.eject(id)
  }, [])

  // Verify token on mount
  useEffect(() => {
    if (!token) { setLoading(false); return }
    api.get('/auth/me')
      .then(r => setEngineer(r.data))
      .catch(() => { logout() })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { token: t, engineer: eng } = res.data
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem(ENGINEER_KEY, JSON.stringify(eng))
    setToken(t)
    setEngineer(eng)
    return eng
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ENGINEER_KEY)
    localStorage.removeItem('selectedEngineer')
    setToken(null)
    setEngineer(null)
  }, [])

  const updateEngineer = useCallback((data) => {
    setEngineer(prev => {
      const updated = { ...prev, ...data }
      localStorage.setItem(ENGINEER_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{ engineer, token, loading, login, logout, updateEngineer }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
