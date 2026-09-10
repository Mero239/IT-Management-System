import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useEffect, useRef, useState } from 'react'
import { notificationsApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useDisplay } from '../context/DisplayContext'

const NAV_ITEMS = [
  { to: '/', key: 'nav.dashboard', icon: '📊', end: true },
  { to: '/assets', key: 'nav.assets', icon: '🖥️' },
  { to: '/requests', key: 'nav.requests', icon: '📋' },
  {
    key: 'nav.ticketingSystem', icon: '🎫', children: [
      { to: '/tickets',           key: 'nav.tickets',           icon: '🎫' },
      { to: '/sla',               key: 'nav.sla',               icon: '⏱️' },
      { to: '/inbox',             key: 'nav.inbox',             icon: '📥' },
      { to: '/telegram-tickets',  key: 'nav.telegramTickets',   icon: '✈️' },
      { to: '/whatsapp-tickets',  key: 'nav.whatsappTickets',   icon: '💬' },
      { to: '/email-tickets',     key: 'nav.emailTickets',      icon: '✉️' },
      { to: '/engineer-dashboard', key: 'nav.myTickets',        icon: '👷' },
      { to: '/knowledge-base',    key: 'nav.knowledgeBase',     icon: '📚' },
    ],
  },
  { to: '/employees',          key: 'nav.employees',       icon: '👥' },
  { to: '/employees/discrepancies', key: 'nav.discrepancies', icon: '⚠️' },
  { to: '/mailboxes',          key: 'nav.mailboxes',       icon: '📬' },
  { to: '/departments', key: 'nav.departments', icon: '🏢' },
  { to: '/licensed-software', key: 'nav.licensedSoftware', icon: '📜' },
  { to: '/support-agreement', key: 'nav.supportAgreement', icon: '🤝' },
  { to: '/reports', key: 'nav.reports', icon: '📈' },
  { to: '/import', key: 'nav.import', icon: '📥' },
  { to: '/swreport', key: 'nav.swreport', icon: '📊' },
  { to: '/it-team', key: 'nav.itTeam', icon: '👥' },
  { to: '/email-agent', key: 'nav.emailAgent', icon: '🤖' },
]

const ADMIN_GROUP = {
  key: 'sidebar.adminSection', icon: '🛡️', children: [
    { to: '/admin/dashboard',   key: 'nav.adminDashboard',   icon: '📊' },
    { to: '/admin/ticket-log',  key: 'nav.adminTicketLog',   icon: '📋' },
    { to: '/admin/reports',     key: 'nav.adminReports',     icon: '📈' },
    { to: '/admin/engineers',   key: 'nav.adminEngineers',   icon: '🛡️' },
    { to: '/admin/channels',    key: 'nav.adminChannels',    icon: '📱' },
    { to: '/admin/ticket-routing', key: 'nav.adminTicketRouting', icon: '🧭' },
    { to: '/admin/monitor',     key: 'nav.adminMonitor',     icon: '📡' },
  ],
}

function NavGroup({ item, isOpen, isActive, onToggle, t, collapsed }) {
  const navigate = useNavigate()

  if (collapsed) {
    return (
      <button
        onClick={() => navigate(item.children[0].to)}
        title={t(item.key)}
        className={`sidebar-link w-full flex items-center justify-center !text-white ${isActive ? '!bg-sky-500/40' : ''}`}
      >
        <span className="text-lg">{item.icon}</span>
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={`sidebar-link w-full flex items-center justify-between !text-white ${
          isOpen ? '!bg-blue-600 shadow-md' : isActive ? '!bg-sky-500/40' : ''
        }`}
      >
        <span className="flex items-center gap-3">
          <span className="text-lg">{item.icon}</span>
          <span>{t(item.key)}</span>
        </span>
        <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {isOpen && (
        <div className="ms-2 p-1.5 my-1 rounded-xl !bg-sky-100 shadow-inner space-y-1">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) => `sidebar-link !text-slate-700 ${isActive ? '!bg-blue-600 !text-white font-bold shadow' : 'hover:!bg-sky-200'}`}
            >
              <span className="text-base">{child.icon}</span>
              <span>{t(child.key)}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { t } = useLanguage()
  const { engineer, logout } = useAuth()
  const { mobileView, sidebarOpen, setSidebarOpen } = useDisplay()
  const navigate = useNavigate()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')
  const dropRef = useRef(null)

  const toggleCollapsed = () => {
    const next = !collapsed
    localStorage.setItem('sidebar_collapsed', String(next))
    setCollapsed(next)
  }

  const allGroups = [...NAV_ITEMS.filter(i => i.children), ADMIN_GROUP]

  const groupHasActiveChild = (item) =>
    item.children?.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/'))

  const [openGroups, setOpenGroups] = useState(() =>
    new Set(allGroups.filter(groupHasActiveChild).map(i => i.key))
  )

  useEffect(() => {
    allGroups.forEach(item => {
      if (groupHasActiveChild(item) && !openGroups.has(item.key)) {
        setOpenGroups(prev => new Set(prev).add(item.key))
      }
    })
  }, [location.pathname])

  useEffect(() => {
    if (mobileView) setSidebarOpen(false)
  }, [location.pathname])

  const toggleGroup = (key) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const fetchCount = () => {
    notificationsApi.unreadCount().then(r => setUnread(r.data.count)).catch(() => {})
  }

  const fetchNotifs = () => {
    notificationsApi.list({ limit: 20 }).then(r => setNotifs(r.data)).catch(() => {})
  }

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!open) return
    fetchNotifs()
    const handleClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleMarkRead = async (id) => {
    await notificationsApi.markRead(id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: 'true' } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead()
    setNotifs(prev => prev.map(n => ({ ...n, is_read: 'true' })))
    setUnread(0)
  }

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr + 'Z')) / 1000
    if (diff < 60) return t('time.now')
    if (diff < 3600) return t('time.minutes').replace('{n}', Math.floor(diff / 60))
    if (diff < 86400) return t('time.hours').replace('{n}', Math.floor(diff / 3600))
    return t('time.days').replace('{n}', Math.floor(diff / 86400))
  }

  return (
    <aside className={`${collapsed ? 'w-[72px]' : 'w-64'} min-h-screen bg-gradient-to-b from-yellow-900 to-yellow-800 flex flex-col shadow-xl shrink-0 transition-all duration-200 ${
      mobileView
        ? `fixed inset-y-0 z-40 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'}`
        : ''
    }`}>
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={mobileView ? undefined : toggleCollapsed}
            title={collapsed ? t('sidebar.expandMenu') : t('sidebar.collapseMenu')}
            className={`flex items-center gap-3 flex-1 ${mobileView ? '' : 'cursor-pointer hover:opacity-80'} transition-opacity`}
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0">💻</div>
            {!collapsed && (
              <div className="flex-1 text-start">
                <h1 className="text-white font-bold text-sm leading-tight">{t('app.name')}</h1>
                <p className="text-yellow-200 text-xs">{t('app.tagline')}</p>
              </div>
            )}
          </button>
          {mobileView && (
            <button onClick={() => setSidebarOpen(false)} className="text-white/70 hover:text-white text-xl px-1">✕</button>
          )}
        </div>
      </div>

      {/* Notification bell */}
      <div className="px-4 pt-3 pb-1 relative" ref={dropRef}>
        <button
          onClick={() => setOpen(v => !v)}
          title={t('sidebar.notifications')}
          className={`w-full flex items-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors ${
            collapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2.5'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🔔</span>
            {!collapsed && <span className="text-white text-sm font-medium">{t('sidebar.notifications')}</span>}
          </div>
          {unread > 0 && (
            <span className={`bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse ${
              collapsed ? 'absolute top-1 right-1 w-4 h-4 text-[9px]' : 'w-5 h-5'
            }`}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className={`absolute top-full mt-1 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden ${
            collapsed ? 'start-full ms-2 w-72' : 'left-2 right-2'
          }`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <span className="font-bold text-slate-700 text-sm">{t('sidebar.notifications')}</span>
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-xs text-yellow-600 hover:underline font-medium">
                  {t('sidebar.markAllRead')}
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
              {notifs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">{t('sidebar.noNotifications')}</div>
              ) : notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => n.is_read === 'false' && handleMarkRead(n.id)}
                  className={`px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 ${n.is_read === 'false' ? 'bg-yellow-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-xs flex-shrink-0 mt-0.5">
                      {n.engineer_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${n.is_read === 'false' ? 'text-slate-800 font-semibold' : 'text-slate-600'}`}>
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400">{timeAgo(n.created_at)}</span>
                        {n.email_sent === 'true' && (
                          <span className="text-[10px] text-yellow-500">{t('sidebar.emailSent')}</span>
                        )}
                        {n.is_read === 'false' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          item.children ? (
            <NavGroup
              key={item.key}
              item={item}
              t={t}
              collapsed={collapsed}
              isOpen={openGroups.has(item.key)}
              isActive={groupHasActiveChild(item)}
              onToggle={() => toggleGroup(item.key)}
            />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? t(item.key) : undefined}
              className={({ isActive }) => `sidebar-link ${collapsed ? 'justify-center' : ''} ${isActive ? 'active' : ''}`}
            >
              <span className="text-lg">{item.icon}</span>
              {!collapsed && <span>{t(item.key)}</span>}
            </NavLink>
          )
        ))}

        {/* Admin-only section */}
        {engineer?.permission_level === 'admin' && (
          <NavGroup
            item={ADMIN_GROUP}
            t={t}
            collapsed={collapsed}
            isOpen={openGroups.has(ADMIN_GROUP.key)}
            isActive={groupHasActiveChild(ADMIN_GROUP)}
            onToggle={() => toggleGroup(ADMIN_GROUP.key)}
          />
        )}
      </nav>

      {/* Current user + logout */}
      {engineer && (
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => navigate('/settings')}
            title={collapsed ? engineer.name : undefined}
            className={`w-full flex items-center gap-3 rounded-xl hover:bg-white/10 p-2 -m-2 transition-colors group ${collapsed ? 'justify-center mb-0' : 'mb-3'}`}
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {engineer.name.charAt(0)}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-start">
                  <p className="text-white text-sm font-semibold truncate">{engineer.name}</p>
                  <p className="text-yellow-300 text-xs truncate">{engineer.role}</p>
                </div>
                <span className="text-yellow-400 group-hover:text-white text-xs opacity-0 group-hover:opacity-100 transition-all">⚙️</span>
              </>
            )}
          </button>
          {!collapsed && (
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/engineer-dashboard')}
                className="flex-1 text-xs text-yellow-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg py-1.5 transition-colors"
              >
                {t('sidebar.myTickets')}
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="flex-1 text-xs text-yellow-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg py-1.5 transition-colors"
              >
                {t('sidebar.settings')}
              </button>
              <button
                onClick={() => { logout(); navigate('/login') }}
                className="px-2 text-xs text-yellow-200 hover:text-red-300 bg-white/10 hover:bg-white/20 rounded-lg py-1.5 transition-colors"
                title={t('sidebar.logout')}
              >
                🚪
              </button>
            </div>
          )}
          {collapsed && (
            <button
              onClick={() => { logout(); navigate('/login') }}
              title={t('sidebar.logout')}
              className="w-full mt-2 text-sm text-yellow-200 hover:text-red-300 bg-white/10 hover:bg-white/20 rounded-lg py-1.5 transition-colors"
            >
              🚪
            </button>
          )}
        </div>
      )}
      {!engineer && (
        <div className="p-4 border-t border-white/10">
          <p className="text-yellow-300 text-xs text-center">{t('app.version')}</p>
        </div>
      )}
    </aside>
  )
}
