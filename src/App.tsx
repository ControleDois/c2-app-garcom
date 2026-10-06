import { useEffect, useState, type ReactNode } from 'react'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { CompanySelectionPage } from './pages/CompanySelectionPage'
import { TablesPage } from './pages/TablesPage'
import { TablePage } from './pages/TablePage'
import { MenuPage } from './pages/MenuPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { ThemeToggle } from './components/ThemeToggle'
import { Logo } from './components/Logo'
import { BuildingsIcon, LogoutIcon } from './components/icons'
import { useRoute } from './hooks/useRoute'
import { useTables } from './hooks/useTables'
import { useMyPerson } from './hooks/useMyPerson'
import { disconnectSocket } from './lib/socket'
import {
  loadSession,
  saveSession,
  clearSession,
  loadActiveCompany,
  saveActiveCompany,
  clearActiveCompany,
  getUserCompanies,
  fetchMyCompanies,
  getCompanyName,
  getPersonName,
  type AuthSession,
  type AuthCompany,
} from './lib/auth'

type Screen = 'login' | 'forgot-password'

function Salon({
  session,
  company,
  onSwitchCompany,
  onLogout,
}: {
  session: AuthSession
  company: AuthCompany
  onSwitchCompany: () => void
  onLogout: () => void
}) {
  const { path, navigate } = useRoute()
  const { tables, loading, error, refresh } = useTables(session, company)
  const person = useMyPerson(session, company)

  const parts = path.split('/').filter(Boolean)
  const tableId = parts[0] === 'mesas' ? parts[1] : undefined
  const table = tables.find((item) => item.id === tableId)

  useEffect(() => {
    if (parts[0] !== 'mesas') navigate('/mesas', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  let screen: ReactNode
  if (tableId && parts[2] === 'cardapio') {
    screen = (
      <MenuPage
        session={session}
        company={company}
        person={person}
        table={table}
        onRefresh={refresh}
        navigate={navigate}
      />
    )
  } else if (tableId && parts[2] === 'fechar') {
    screen = (
      <CheckoutPage
        session={session}
        company={company}
        person={person}
        table={table}
        onRefresh={refresh}
        navigate={navigate}
      />
    )
  } else if (tableId) {
    screen = (
      <TablePage
        session={session}
        company={company}
        person={person}
        table={table}
        loading={loading}
        onRefresh={refresh}
        navigate={navigate}
      />
    )
  } else {
    screen = (
      <TablesPage
        session={session}
        company={company}
        personId={person?.id ?? null}
        tables={tables}
        loading={loading}
        error={error}
        onRefresh={refresh}
        navigate={navigate}
      />
    )
  }

  const atRoot = !tableId

  return (
    <div className="flex h-svh flex-col bg-[var(--page)]">
      {atRoot && (
        <header className="flex flex-none items-center justify-between gap-2 bg-[var(--blue-500)] px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 text-white">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo className="h-7 w-7 flex-none rounded-md bg-white p-0.5" />
            <div className="min-w-0">
              <p className="truncate text-[14px] leading-tight font-extrabold">Garçom</p>
              <p className="truncate text-[11.5px] leading-tight opacity-85">
                {person?.name ?? getPersonName(session.user)}
              </p>
            </div>
          </div>
          <div className="flex flex-none items-center gap-1">
            <button
              type="button"
              onClick={onSwitchCompany}
              className="flex max-w-[150px] items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] font-semibold active:bg-white/15"
            >
              <BuildingsIcon className="h-4 w-4 flex-none" />
              <span className="truncate">{getCompanyName(company)}</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sair"
              className="flex h-9 w-9 items-center justify-center rounded-lg active:bg-white/15"
            >
              <LogoutIcon className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}
      {!atRoot && <div className="flex-none bg-[var(--surface)] pt-[env(safe-area-inset-top)]" />}
      <main className="flex min-h-0 flex-1 flex-col">{screen}</main>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())
  const [activeCompany, setActiveCompany] = useState<AuthCompany | null>(() => loadActiveCompany())
  const [screen, setScreen] = useState<Screen>('login')
  const [switchingCompany, setSwitchingCompany] = useState(false)

  function handleLoginSuccess(newSession: AuthSession) {
    saveSession(newSession)
    setSession(newSession)

    const companies = getUserCompanies(newSession)
    if (companies.length === 1) {
      saveActiveCompany(companies[0])
      setActiveCompany(companies[0])
    }
  }

  function handleSelectCompany(company: AuthCompany) {
    saveActiveCompany(company)
    setActiveCompany(company)
  }

  async function handleSwitchCompany() {
    clearActiveCompany()
    setActiveCompany(null)
    disconnectSocket()

    if (!session) return

    setSwitchingCompany(true)
    try {
      const { companies } = await fetchMyCompanies(session.token.token)
      const updatedSession: AuthSession = { ...session, user: { ...session.user, companies } }
      saveSession(updatedSession)
      setSession(updatedSession)

      if (companies.length === 1) handleSelectCompany(companies[0])
    } catch {
      // segue com a lista que já estava na sessão
    } finally {
      setSwitchingCompany(false)
    }
  }

  function handleLogout() {
    disconnectSocket()
    clearSession()
    setSession(null)
    setActiveCompany(null)
    setScreen('login')
  }

  let content: ReactNode

  if (session && switchingCompany) {
    content = (
      <div className="flex h-svh items-center justify-center bg-[var(--page)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue-300)] border-t-[var(--blue-500)]" />
      </div>
    )
  } else if (session && activeCompany) {
    content = (
      <Salon
        key={activeCompany.id}
        session={session}
        company={activeCompany}
        onSwitchCompany={handleSwitchCompany}
        onLogout={handleLogout}
      />
    )
  } else if (session) {
    content = (
      <CompanySelectionPage
        session={session}
        companies={getUserCompanies(session)}
        onSelect={handleSelectCompany}
        onLogout={handleLogout}
      />
    )
  } else if (screen === 'forgot-password') {
    content = <ForgotPasswordPage onBackToLogin={() => setScreen('login')} />
  } else {
    content = <LoginPage onForgotPassword={() => setScreen('forgot-password')} onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <>
      {content}
      {!(session && activeCompany) && <ThemeToggle />}
    </>
  )
}

export default App
