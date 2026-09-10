// Compact horizontal stat card: icon on the left, value/label on the right,
// with an optional pulsing dot for "needs attention" counts. Shared by the
// per-channel ticket dashboards (was duplicated 4x before consolidation).
export default function StatCardCompact({ icon, label, value, color, pulse }) {
  return (
    <div className={`card !p-4 flex items-center gap-4 border-r-4 ${color}`}>
      <div className="text-3xl relative">
        {icon}
        {pulse && value > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}
