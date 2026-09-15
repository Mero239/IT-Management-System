import { useEffect, useState } from 'react'
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
  const [errorMsg, setErrorMsg] = useState('')

  const submit = async (rating) => {
    setSelected(rating)
    setStatus('saving')
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}/csat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.detail?.includes('من قبل')) setStatus('already')
        else { setStatus('error'); setErrorMsg(data.detail || '') }
        return
      }
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  // one-click from email: rating already in URL
  useEffect(() => {
    if (urlRating >= 1 && urlRating <= 5) submit(urlRating)
  }, []) // eslint-disable-line

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-yellow-800 to-yellow-700 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg">💻</div>
          <h1 className="text-white font-bold text-xl">نظام إدارة IT</h1>
          <p className="text-yellow-200 text-sm mt-1">{BRAND_TAGLINE}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {status === 'done' ? (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">🙏</div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">شكراً لتقييمك!</h2>
              <p className="text-slate-500 text-sm">رأيك بيساعدنا نحسّن الخدمة باستمرار</p>
            </>
          ) : status === 'already' ? (
            <>
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">تم تسجيل تقييمك من قبل</h2>
              <p className="text-slate-500 text-sm">شكراً، وصلنا رأيك بالفعل على هذه التذكرة</p>
            </>
          ) : status === 'error' ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">حدث خطأ</h2>
              <p className="text-slate-500 text-sm">{errorMsg || 'حاول مرة أخرى لاحقًا'}</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-800 mb-1">تذكرة #{id}</h2>
              <p className="text-slate-500 text-sm mb-6">إزاي كانت تجربتك مع فريق الدعم الفني؟</p>
              <div className="flex justify-center gap-1.5" dir="ltr">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    disabled={status === 'saving'}
                    onClick={() => submit(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    className="text-5xl transition-transform active:scale-90 disabled:opacity-50"
                    style={{ color: (hover || selected) >= n ? '#f59e0b' : '#e2e8f0' }}
                  >
                    ★
                  </button>
                ))}
              </div>
              {status === 'saving' && <p className="text-xs text-slate-400 mt-4">جاري الحفظ...</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
