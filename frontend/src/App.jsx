import { useState } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"

import LoginPage from "./features/auth/LoginPage"
import RegistrationForm from "./features/auth/RegistrationForm"
import MemberDashboard from "./features/dashboard/MemberDashboard"

import { useBackendIdentity } from "./hooks/useBackendIdentity"
import { useRegistration } from "./hooks/useRegistration"

import "./App.css"

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

    try {
      await linkPasskey()
      setMessage("Passkey linked successfully!")
    } catch (error) {
      console.error("Passkey linking failed:", error)
      setMessage(error.message || "Passkey linking failed.")
    } finally {
      setLinking(false)
    }
  }

  const handleRegistration = async (memberData) => {
    try {
      console.log("APP RECEIVED REGISTRATION:", memberData)
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
  console.log("SHGT FRONTEND STATE:", {
    authenticated,
    backendLoading,
    backendError,
    identity,
    accessDenied,
  })

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

  return (
    <MemberDashboard
      user={user}
      wallet={wallet}
      hasPasskey={hasPasskey}
      linking={linking}
      message={message}
      onLinkPasskey={handleLinkPasskey}
      onLogout={logout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      backendIdentity={identity}
      backendLoading={backendLoading}
      backendError={backendError}
    />
  )
}

export default App
