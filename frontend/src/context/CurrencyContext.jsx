import { createContext, useContext, useState, useEffect, useCallback } from 'react'

export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$',  name: 'US Dollar',      flag: '🇺🇸' },
  EGP: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', flag: '🇪🇬' },
}

// Format without conversion (display only)
export function formatCurrency(amount, currencyCode) {
  if (amount === null || amount === undefined || amount === '') return '—'
  const num = parseFloat(amount)
  if (isNaN(num)) return amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}

const CurrencyContext = createContext(null)

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(
    () => localStorage.getItem('it_currency') || 'USD'
  )
  const [rates, setRates]       = useState({ USD: 1, EGP: 1 })
  const [rateStatus, setStatus] = useState('loading') // loading | ok | error
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data.result === 'success') {
          setRates(data.rates)
          setLastUpdated(data.time_last_update_utc)
          setStatus('ok')
        } else {
          setStatus('error')
        }
      })
      .catch(() => setStatus('error'))
  }, [])

  const setAndStore = (code) => {
    localStorage.setItem('it_currency', code)
    setCurrency(code)
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency: setAndStore, CURRENCIES, rates, rateStatus, lastUpdated }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}

// Hook: returns a formatter that auto-converts to the selected display currency
export function useFormatCurrency() {
  const { currency: displayCurrency, rates } = useContext(CurrencyContext)

  return useCallback((amount, sourceCurrency = 'USD') => {
    if (amount === null || amount === undefined || amount === '') return '—'
    const num = parseFloat(amount)
    if (isNaN(num)) return amount

    const src = sourceCurrency || 'USD'
    const dst = displayCurrency

    // Convert: amount(src) → USD → dst
    const rateFrom = rates[src] || 1
    const rateTo   = rates[dst] || 1
    const converted = num * (rateTo / rateFrom)

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: dst,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(converted)
  }, [displayCurrency, rates])
}
