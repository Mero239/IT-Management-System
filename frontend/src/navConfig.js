// Flat catalog of every possible sidebar entry — icon, route, and the
// admin-only flag stay code-defined here. What admins can customize (via
// /admin/menu-customizer, saved through navConfigApi) is only the ORDER and
// GROUPING of these entries, resolved against this catalog at render time.
// This keeps route/icon changes a normal code change, while still letting an
// admin reorganize the menu without touching code.
export const NAV_CATALOG = {
  'nav.dashboard':             { to: '/', icon: '📊', end: true },

  'nav.ticketingSystem':       { icon: '🎫', isGroup: true },
  'nav.tickets':                { to: '/tickets', icon: '🎫' },
  'nav.sla':                    { to: '/sla', icon: '⏱️' },
  'nav.inbox':                  { to: '/inbox', icon: '📥' },
  'nav.telegramTickets':        { to: '/telegram-tickets', icon: '✈️' },
  'nav.whatsappTickets':        { to: '/whatsapp-tickets', icon: '💬' },
  'nav.emailTickets':           { to: '/email-tickets', icon: '✉️' },
  'nav.myTickets':              { to: '/engineer-dashboard', icon: '👷' },
  'nav.knowledgeBase':          { to: '/knowledge-base', icon: '📚' },
  'nav.ticketReports':          { to: '/ticket-reports', icon: '📊' },
  'nav.cannedResponses':        { to: '/canned-responses', icon: '💬' },
  'nav.supportAgreement':       { to: '/support-agreement', icon: '🤝' },
  'nav.downtime':                { to: '/downtime', icon: '🔌' },
  'nav.adminDashboard':         { to: '/admin/dashboard', icon: '📈', adminOnly: true },
  'nav.adminTicketLog':         { to: '/admin/ticket-log', icon: '📋', adminOnly: true },
  'nav.adminTicketRouting':     { to: '/admin/ticket-routing', icon: '🧭', adminOnly: true },
  'nav.adminRecurringTickets':  { to: '/admin/recurring-tickets', icon: '🔁', adminOnly: true },
  'nav.adminTicketCategories':  { to: '/admin/ticket-categories', icon: '🏷️', adminOnly: true },
  'nav.adminChannels':          { to: '/admin/channels', icon: '📱', adminOnly: true },
  'nav.emailAgent':             { to: '/email-agent', icon: '🤖', adminOnly: true },

  'nav.tasks':                  { to: '/tasks', icon: '📝' },

  'nav.assetsManagement':       { icon: '🖥️', isGroup: true },
  'nav.assetsOverview':         { to: '/assets-overview', icon: '📊' },
  'nav.assets':                 { to: '/assets', icon: '🖥️' },
  'nav.requests':               { to: '/requests', icon: '📋' },

  'nav.employees':              { to: '/employees', icon: '👥' },
  'nav.discrepancies':          { to: '/employees/discrepancies', icon: '⚠️' },
  'nav.mailboxes':              { to: '/mailboxes', icon: '📬' },
  'nav.departments':            { to: '/departments', icon: '🏢' },
  'nav.organizations':          { to: '/organizations', icon: '🏛️' },
  'nav.licensedSoftware':       { to: '/licensed-software', icon: '📜' },
  'nav.reports':                { to: '/reports', icon: '📈' },
  'nav.import':                 { to: '/import', icon: '📥' },
  'nav.swreport':               { to: '/swreport', icon: '📊' },
  'nav.itTeam':                 { to: '/it-team', icon: '👥' },

  'sidebar.adminSection':       { icon: '🛡️', isGroup: true, adminOnly: true },
  'nav.adminReports':           { to: '/admin/reports', icon: '📈' },
  'nav.adminEngineers':         { to: '/admin/engineers', icon: '🛡️' },
  'nav.adminMonitor':           { to: '/admin/monitor', icon: '📡' },
}

// The out-of-the-box arrangement — also what "Reset to default" restores.
export const DEFAULT_STRUCTURE = [
  { key: 'nav.dashboard' },
  { key: 'nav.ticketingSystem', children: [
    'nav.tasks', 'nav.tickets', 'nav.sla', 'nav.inbox', 'nav.telegramTickets', 'nav.whatsappTickets', 'nav.emailTickets',
    'nav.myTickets', 'nav.knowledgeBase', 'nav.ticketReports', 'nav.supportAgreement', 'nav.downtime',
    'nav.adminDashboard', 'nav.adminTicketLog', 'nav.adminTicketRouting', 'nav.adminRecurringTickets',
    'nav.adminTicketCategories', 'nav.adminChannels', 'nav.emailAgent',
  ] },
  { key: 'nav.assetsManagement', children: ['nav.assetsOverview', 'nav.assets', 'nav.requests'] },
  { key: 'nav.employees' },
  { key: 'nav.discrepancies' },
  { key: 'nav.mailboxes' },
  { key: 'nav.departments' },
  { key: 'nav.organizations' },
  { key: 'nav.licensedSoftware' },
  { key: 'nav.reports' },
  { key: 'nav.import' },
  { key: 'nav.swreport' },
  { key: 'sidebar.adminSection', children: ['nav.itTeam', 'nav.adminReports', 'nav.adminEngineers', 'nav.adminMonitor'] },
]

// A saved (per-user) structure is a snapshot from whenever it was last
// saved — it won't know about nav items added to the catalog afterwards
// (e.g. a brand-new page). This merges any such newcomers in, positioned
// right before whichever later default item the user still has (falling
// back to the end), so new features show up for everyone automatically
// instead of silently vanishing for anyone who has customized their menu.
export function mergeWithDefaults(savedStructure) {
  const known = new Set()
  savedStructure.forEach(sec => {
    known.add(sec.key)
    sec.children?.forEach(ck => known.add(ck))
  })

  let merged = savedStructure.map(sec => (sec.children ? { ...sec, children: [...sec.children] } : sec))

  DEFAULT_STRUCTURE.forEach((defSec, i) => {
    if (!known.has(defSec.key)) {
      let insertIdx = merged.length
      for (let j = i + 1; j < DEFAULT_STRUCTURE.length; j++) {
        const idx = merged.findIndex(s => s.key === DEFAULT_STRUCTURE[j].key)
        if (idx !== -1) { insertIdx = idx; break }
      }
      merged.splice(insertIdx, 0, defSec.children ? { key: defSec.key, children: [...defSec.children] } : { key: defSec.key })
      known.add(defSec.key)
      defSec.children?.forEach(ck => known.add(ck))
    } else if (defSec.children) {
      merged = merged.map(sec => {
        if (sec.key !== defSec.key) return sec
        const missing = defSec.children.filter(ck => !known.has(ck))
        missing.forEach(ck => known.add(ck))
        return missing.length ? { ...sec, children: [...(sec.children || []), ...missing] } : sec
      })
    }
  })

  return merged
}

// Turns a lightweight {key, children:[key,...]} structure into the fully
// resolved shape the Sidebar's render logic expects (icon/to/adminOnly
// attached). Unknown keys (e.g. a saved structure predating a removed page)
// are dropped rather than breaking the render.
export function resolveStructure(structure) {
  return (structure || [])
    .map(sec => {
      const meta = NAV_CATALOG[sec.key]
      if (!meta) return null
      if (sec.children) {
        const children = sec.children
          .map(ck => {
            const cmeta = NAV_CATALOG[ck]
            return cmeta ? { key: ck, to: cmeta.to, icon: cmeta.icon, adminOnly: !!cmeta.adminOnly } : null
          })
          .filter(Boolean)
        return { key: sec.key, icon: meta.icon, adminOnly: !!meta.adminOnly, children }
      }
      return { key: sec.key, to: meta.to, icon: meta.icon, end: !!meta.end, adminOnly: !!meta.adminOnly }
    })
    .filter(Boolean)
}

// Applies one drag-and-drop move to a lightweight structure (same shape as
// DEFAULT_STRUCTURE) and returns a new structure. `target` is one of:
//   { type: 'top-before', beforeKey } — reorder at top level, before beforeKey
//   { type: 'top-end' }               — move to the end of the top level
//   { type: 'into-group', groupKey }  — nest a flat item into a group (appended)
//   { type: 'child-before', groupKey, beforeKey } — reorder within a group
// Groups can never be nested into another group — such a drop is a no-op.
export function moveItem(structure, draggedKey, target) {
  let draggedSection = structure.find(s => s.key === draggedKey)
  let working = structure

  if (draggedSection) {
    working = structure.filter(s => s.key !== draggedKey)
  } else {
    let sourceGroupKey = null
    for (const sec of structure) {
      if (sec.children?.includes(draggedKey)) { sourceGroupKey = sec.key; break }
    }
    if (!sourceGroupKey) return structure
    draggedSection = { key: draggedKey }
    working = structure.map(sec =>
      sec.key === sourceGroupKey ? { ...sec, children: sec.children.filter(k => k !== draggedKey) } : sec
    )
  }

  const isGroup = !!draggedSection.children

  if (target.type === 'top-before') {
    const idx = working.findIndex(s => s.key === target.beforeKey)
    const insertIdx = idx === -1 ? working.length : idx
    const next = [...working]
    next.splice(insertIdx, 0, draggedSection)
    return next
  }

  if (target.type === 'top-end') {
    return [...working, draggedSection]
  }

  if (isGroup) return structure // groups can't nest into a group

  if (target.type === 'into-group') {
    return working.map(sec =>
      sec.key === target.groupKey ? { ...sec, children: [...(sec.children || []), draggedKey] } : sec
    )
  }

  if (target.type === 'child-before') {
    return working.map(sec => {
      if (sec.key !== target.groupKey) return sec
      const children = [...(sec.children || [])]
      const idx = children.indexOf(target.beforeKey)
      children.splice(idx === -1 ? children.length : idx, 0, draggedKey)
      return { ...sec, children }
    })
  }

  return structure
}
