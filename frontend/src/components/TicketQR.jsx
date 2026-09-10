import { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export default function TicketQR() {
  const [copied, setCopied] = useState(false)
  const svgRef = useRef()

  const url = `${window.location.origin}/new-ticket`

  const copyLink = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadQR = () => {
    const svg = svgRef.current?.querySelector('svg')
    if (!svg) return
    const data = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([data], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'it-support-qr.svg'
    a.click()
  }

  const printQR = () => window.print()

  return (
    <div className="space-y-4">
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #qr-print-area, #qr-print-area * { visibility: visible !important; }
          #qr-print-area { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      <div id="qr-print-area" className="card flex flex-col items-center gap-6 py-8">
        {/* Print header */}
        <div className="text-center">
          <div className="w-14 h-14 bg-yellow-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow">
            <span className="text-2xl">🎫</span>
          </div>
          <h3 className="text-lg font-bold text-slate-800">طلب دعم فني IT</h3>
          <p className="text-sm text-slate-500 mt-1">امسح الكود لتقديم طلبك</p>
        </div>

        {/* QR Code */}
        <div ref={svgRef} className="p-4 bg-white border-2 border-yellow-100 rounded-2xl shadow-sm">
          <QRCodeSVG
            value={url}
            size={200}
            level="H"
            fgColor="#713f12"
            bgColor="#ffffff"
            includeMargin={true}
          />
        </div>

        {/* URL */}
        <div className="text-center space-y-1">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">أو افتح الرابط مباشرة</p>
          <p className="font-mono text-sm text-yellow-700 bg-yellow-50 px-4 py-2 rounded-lg break-all">{url}</p>
        </div>

        {/* Actions — hidden in print */}
        <div className="flex gap-2 no-print">
          <button onClick={copyLink}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              copied ? 'bg-yellow-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}>
            {copied ? '✅ تم النسخ' : '📋 نسخ الرابط'}
          </button>
          <button onClick={downloadQR}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all">
            ⬇️ تحميل QR
          </button>
          <button onClick={printQR}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-yellow-600 hover:bg-yellow-700 text-white transition-all">
            🖨️ طباعة
          </button>
        </div>

        {/* Instructions */}
        <div className="w-full bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-2 no-print">
          <p className="font-semibold text-slate-700">📌 كيفية الاستخدام:</p>
          <ul className="space-y-1 list-disc list-inside text-xs text-slate-500">
            <li>ضع هذا الكود في مكان بارز (لوحة الإعلانات، طاولة الاستقبال، المكتب)</li>
            <li>يمسح الموظف الكود بكاميرا الهاتف ويملأ النموذج</li>
            <li>تصل التذكرة فوراً لفريق IT وتظهر في لوحة التذاكر</li>
            <li>يمكن أيضاً مشاركة الرابط عبر الإيميل أو واتساب</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
