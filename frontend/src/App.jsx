import { useState } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"

import LoginPage from "./features/auth/LoginPage"
import RegistrationForm from "./features/auth/RegistrationForm"
import MemberDashboard from "./features/dashboard/MemberDashboard"
import DashboardDemoPage from "./features/dashboard/components/demo/DemoRoleDashboard.jsx"
import PortalWorkspace from "./features/portal/components/PortalWorkspace.jsx"
import {
  createPortalDataService,
  createPortalDemoProvider,
} from "./features/portal/services/portal-data.service.js"
import { createPortalApiProvider } from "./features/portal/services/portal-api.provider.js"
import { apiRequest } from "./services/api.js"

import { useBackendIdentity } from "./hooks/useBackendIdentity"
import { useRegistration } from "./hooks/useRegistration"

import "./App.css"

const portalDataService = createPortalDataService({
  providers: {
    demo: createPortalDemoProvider(),
    api: createPortalApiProvider({ apiRequest }),
  },
})
const portalDataMode = import.meta.env.VITE_PORTAL_DATA_MODE || "demo"

function App() {
  const {
    ready,
    authenticated,
    user,
    login,
    logout,
    linkPasskey,
    getAccessToken,
  } = usePrivy()

  const { wallets } = useWallets()

  const [linking, setLinking] = useState(false)
  const [message, setMessage] = useState("")
  const [messageIsError, setMessageIsError] = useState(false)
  const [activeTab, setActiveTab] = useState("Overview")

  const wallet = wallets.find(
    (item) => item.walletClientType === "privy"
  )

  const hasPasskey = user?.linkedAccounts?.some(
    (account) => account.type === "passkey"
  ) || false

  const {
    identity,
    loading: backendLoading,
    error: backendError,
    accessDenied,
    refreshIdentity,
    retry,
  } = useBackendIdentity({
    ready,
    authenticated,
    getAccessToken,
  })

  const {
    loading: registrationLoading,
    error: registrationError,
    submitRegistration,
  } = useRegistration({
    getAccessToken,
    refreshIdentity,
  })

  const handleLinkPasskey = async () => {
    setLinking(true)
    setMessage("")
    setMessageIsError(false)

    try {
      await linkPasskey()
      setMessage("Passkey linked successfully!")
    } catch (error) {
      console.error("Passkey linking failed:", error)
      setMessage("Unable to link your passkey. Please try again.")
      setMessageIsError(true)
    } finally {
      setLinking(false)
    }
  }

  const handleRegistration = async (memberData) => {
    try {
      await submitRegistration(memberData)
    } catch {
      // The registration hook maintains and exposes the error state.
    }
  }

  if (!ready) {
    return (
      <main className="loading-screen">
        <div className="loading-orb" />
        <p>Preparing your SHGT experience...</p>
      </main>
    )
  }

  if (!authenticated) {
    return <LoginPage onLogin={login} />
  }

  if (backendLoading) {
    return (
      <main className="loading-screen">
        <div className="loading-orb" />
        <p>Verifying your SHGT identity...</p>
      </main>
    )
  }

  if (accessDenied) {
    return (
      <main className="loading-screen">
        <h2>Access restricted</h2>
        <p>
          Your authenticated identity does not currently have
          permission to access this SHGT account.
        </p>
        <button className="primary-button" onClick={logout}>
          Sign out
        </button>
      </main>
    )
  }

  if (backendError || !identity) {
    return (
      <main className="loading-screen">
        <h2>Unable to verify your identity</h2>

        <p role="alert">
          {backendError || "No identity information was returned by SHGT."}
        </p>

        <button className="primary-button" onClick={retry}>
          Retry verification
        </button>

        <button className="logout-button" onClick={logout}>
          Sign out
        </button>
      </main>
    )
  }

  if (!identity.registered) {
    return (
      <RegistrationForm
        initialEmail={user?.email?.address || ""}
        loading={registrationLoading}
        error={registrationError}
        onSubmit={handleRegistration}
        onLogout={logout}
      />
    )
  }

  const searchParams = new URLSearchParams(window.location.search)
  const requestedDemoRole = searchParams.get("dashboardDemo")
  const requestedPortalModule = searchParams.get("portal")
  const requestedMemberModule = searchParams.get("memberWorkspace")
  const supportedDemoRoles = [
    "PLATFORM_ADMIN",
    "PRESIDENT",
    "SECRETARY",
    "TREASURER",
  ]
  if (
    import.meta.env.DEV &&
    supportedDemoRoles.includes(requestedDemoRole)
  ) {
    if (
      requestedPortalModule &&
      portalDataService.getAvailableModules(requestedDemoRole)
        .includes(requestedPortalModule)
    ) {
      return <PortalWorkspace
        role={requestedDemoRole}
        moduleName={requestedPortalModule}
        getAccessToken={getAccessToken}
        dataService={portalDataService}
      />
    }
    return <DashboardDemoPage role={requestedDemoRole} />
  }

  if (
    import.meta.env.DEV &&
    requestedMemberModule &&
    portalDataService.getAvailableModules("MEMBER").includes(requestedMemberModule)
  ) {
    return <PortalWorkspace
      role="MEMBER"
      moduleName={requestedMemberModule}
      mode={portalDataMode}
      getAccessToken={getAccessToken}
      dataService={portalDataService}
    />
  }

  return (
    <MemberDashboard
      user={user}
      wallet={wallet}
      hasPasskey={hasPasskey}
      linking={linking}
      message={message}
      messageIsError={messageIsError}
      onLinkPasskey={handleLinkPasskey}
      onLogout={logout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      backendIdentity={identity}
      backendLoading={backendLoading}
      backendError={backendError}
      getAccessToken={getAccessToken}
    />
  )
}

export default App
