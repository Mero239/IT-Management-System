import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { API_BASE } from '../api/client'
import { BRAND_TAGLINE } from '../constants'

export default function RateTicket() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const urlRating = Number(params.get('rating')) || 0

  const [status, setStatus] = useState('idle') // idle | saving | done | error | already
  const [hover, setHover] = useState(0)
  const [selected, setSelected] = useState(urlRating)
  const [comment, setComment] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const submit = async () => {
    if (!selected) return
    setStatus('saving')
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}/csat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: selected, comment: comment.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.detail?.includes('already')) setStatus('already')
        else { setStatus('error'); setErrorMsg(data.detail || '') }
        return
      }
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-yellow-800 to-yellow-700 flex items-center justify-center p-4" dir="ltr">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="bg-white rounded-2xl shadow-lg mx-auto mb-4 px-5 py-3 inline-flex items-center justify-center">
            <img src="/mobica-logo.png" alt="Mobica" className="h-8 w-auto" />
          </div>
          <h1 className="text-white font-bold text-xl">IT Management System</h1>
          <p className="text-yellow-200 text-sm mt-1">{BRAND_TAGLINE}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {status === 'done' ? (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">🙏</div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Thank you for your feedback!</h2>
              <p className="text-slate-500 text-sm">Your rating helps us keep improving our service.</p>
            </>
          ) : status === 'already' ? (
            <>
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Rating already submitted</h2>
              <p className="text-slate-500 text-sm">We already received your feedback for this ticket.</p>
            </>
          ) : status === 'error' ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Something went wrong</h2>
              <p className="text-slate-500 text-sm">{errorMsg || 'Please try again later.'}</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Ticket #{id}</h2>
              <p className="text-slate-500 text-sm mb-6">How was your experience with our IT support team?</p>
              <div className="flex justify-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    disabled={status === 'saving'}
                    onClick={() => setSelected(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    className="text-5xl transition-transform active:scale-90 disabled:opacity-50"
                    style={{ color: (hover || selected) >= n ? '#f59e0b' : '#e2e8f0' }}
                  >
                    ★
                  </button>
                ))}
              </div>

              {selected > 0 && (
                <div className="mt-5 text-left">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Add a comment (optional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={status === 'saving'}
                    rows={3}
                    maxLength={2000}
                    placeholder="Tell us more about your experience..."
                    className="w-full border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-yellow-500 disabled:opacity-50 resize-none"
                  />
                  <button
                    onClick={submit}
                    disabled={status === 'saving'}
                    className="w-full mt-3 py-3 rounded-xl bg-yellow-600 text-white font-bold text-sm active:bg-yellow-700 active:scale-[.98] transition-all disabled:opacity-60"
                  >
                    {status === 'saving' ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              )}
            </>
          )}
          <p className="text-xs text-slate-400 mt-6 pt-5 border-t border-slate-100">
            Need further assistance? Contact IT Support — ext. 526
          </p>
        </div>
      </div>
    </div>
  )
}
