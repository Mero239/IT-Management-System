import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { CurrencyProvider } from './context/CurrencyContext'
import { LanguageProvider, useLanguage } from './context/LanguageContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DisplayProvider, useDisplay } from './context/DisplayContext'
import { ThemeProvider } from './context/ThemeContext'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Assets from './pages/Assets'
import Requests from './pages/Requests'
import Tickets from './pages/Tickets'
import TicketDetail from './pages/TicketDetail'
import EngineerDashboard from './pages/EngineerDashboard'
import Departments from './pages/Departments'
import LicensedSoftware from './pages/LicensedSoftware'
import SupportAgreement from './pages/SupportAgreement'
import SLA from './pages/SLA'
import TicketRouting from './pages/TicketRouting'
import Reports from './pages/Reports'
import Import from './pages/Import'
import SoftwareReport from './pages/SoftwareReport'
import EmailAgent from './pages/EmailAgent'
import ITTeam from './pages/ITTeam'
import NewTicket from './pages/NewTicket'
import Login from './pages/Login'
import Settings from './pages/Settings'
import AdminEngineers from './pages/AdminEngineers'
import AdminDashboard from './pages/AdminDashboard'
import AdvancedReports from './pages/AdvancedReports'
import AdminTicketLog from './pages/AdminTicketLog'
import KnowledgeBase from './pages/KnowledgeBase'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import TicketPrint from './pages/TicketPrint'
import ChannelsConfig from './pages/ChannelsConfig'
import ServerMonitor from './pages/ServerMonitor'
import TelegramTickets from './pages/TelegramTickets'
import WhatsAppTickets from './pages/WhatsAppTickets'
import EmailTickets from './pages/EmailTickets'
import ChannelsInbox from './pages/ChannelsInbox'
import EmployeeDirectory from './pages/EmployeeDirectory'
import MailboxDashboard from './pages/MailboxDashboard'
import MailboxDetail from './pages/MailboxDetail'
import EmployeeDetail from './pages/EmployeeDetail'
import EmployeeDiscrepancies from './pages/EmployeeDiscrepancies'

function RequireAuth({ children }) {
  const { engineer, loading } = useAuth()
  const location = useLocation()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-400 text-sm">جاري التحميل...</p>
    </div>
  )
  if (!engineer) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function InternalLayout({ children }) {
  const { mobileView, sidebarOpen, setSidebarOpen } = useDisplay()
  const { t } = useLanguage()
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {mobileView && sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarOpen(false)} />
      )}
      <main className="flex-1 p-6 overflow-auto min-w-0">
        {mobileView && (
          <button onClick={() => setSidebarOpen(true)}
            className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 text-sm font-medium">
            ☰ <span>{t('sidebar.menu')}</span>
          </button>
        )}
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
      <DisplayProvider>
      <CurrencyProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public — no auth */}
              <Route path="/new-ticket"       element={<NewTicket />} />
              <Route path="/support-agreement" element={<SupportAgreement />} />
              <Route path="/login"            element={<LoginRedirect />} />
              <Route path="/forgot-password"  element={<ForgotPassword />} />
              <Route path="/reset-password"   element={<ResetPassword />} />

              {/* Internal — auth required */}
              <Route path="/*" element={
                <RequireAuth>
                  <InternalLayout>
                    <Routes>
                      <Route path="/"                    element={<Dashboard />} />
                      <Route path="/assets"              element={<Assets />} />
                      <Route path="/requests"            element={<Requests />} />
                      <Route path="/tickets"             element={<Tickets />} />
                      <Route path="/tickets/:id"         element={<TicketDetail />} />
                      <Route path="/tickets/:id/print"   element={<TicketPrint />} />
                      <Route path="/engineer-dashboard"  element={<EngineerDashboard />} />
                      <Route path="/knowledge-base"      element={<KnowledgeBase />} />
                      <Route path="/departments"         element={<Departments />} />
                      <Route path="/licensed-software"   element={<LicensedSoftware />} />
                      <Route path="/sla"                 element={<SLA />} />
                      <Route path="/reports"             element={<Reports />} />
                      <Route path="/import"              element={<Import />} />
                      <Route path="/swreport"            element={<SoftwareReport />} />
                      <Route path="/it-team"             element={<ITTeam />} />
                      <Route path="/email-agent"         element={<EmailAgent />} />
                      <Route path="/settings"            element={<Settings />} />
                      <Route path="/admin/engineers"     element={<AdminEngineers />} />
                      <Route path="/admin/dashboard"     element={<AdminDashboard />} />
                      <Route path="/admin/reports"       element={<AdvancedReports />} />
                      <Route path="/admin/ticket-log"    element={<AdminTicketLog />} />
                      <Route path="/admin/channels"      element={<ChannelsConfig />} />
                      <Route path="/admin/ticket-routing" element={<TicketRouting />} />
                      <Route path="/admin/monitor"       element={<ServerMonitor />} />
                      <Route path="/telegram-tickets"    element={<TelegramTickets />} />
                      <Route path="/whatsapp-tickets"    element={<WhatsAppTickets />} />
                      <Route path="/email-tickets"       element={<EmailTickets />} />
                      <Route path="/inbox"               element={<ChannelsInbox />} />
                      <Route path="/employees"           element={<EmployeeDirectory />} />
                      <Route path="/employees/discrepancies" element={<EmployeeDiscrepancies />} />
                      <Route path="/employees/:id"       element={<EmployeeDetail />} />
                      <Route path="/mailboxes"           element={<MailboxDashboard />} />
                      <Route path="/mailboxes/:id"       element={<MailboxDetail />} />
                    </Routes>
                  </InternalLayout>
                </RequireAuth>
              } />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </CurrencyProvider>
      </DisplayProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}

// Redirect already-logged-in users away from /login
function LoginRedirect() {
  const { engineer, loading } = useAuth()
  if (loading) return null
  if (engineer) return <Navigate to="/" replace />
  return <Login />
}
