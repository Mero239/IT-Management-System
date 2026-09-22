export default function StatCard({ title, value, icon, color = 'blue', subtitle, onClick }) {
  const colors = {
    blue: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    green: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  }

  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={`card border-2 ${colors[color]} w-full text-start ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className="text-4xl opacity-80">{icon}</div>
      </div>
    </Tag>
  )
}
