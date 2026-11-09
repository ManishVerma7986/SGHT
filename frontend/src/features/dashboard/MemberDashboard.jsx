import DashboardSidebar from "./components/DashboardSidebar"
import DashboardHeader from "./components/DashboardHeader"
import MetricCard from "../../components/MetricCard"
import EmptyPage from "../../components/EmptyPage"

function MemberDashboard({
  user,
  wallet,
  hasPasskey,
  linking,
  message,
  onLinkPasskey,
  onLogout,
  activeTab,
  setActiveTab,
  backendIdentity,
  backendLoading,
  backendError,
}) {
  return (
    <main className="dashboard-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <DashboardSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={onLogout}
      />

      <section className="dashboard-main">
        <DashboardHeader
          user={user}
          activeTab={activeTab}
        />

        <section className="dashboard-panel">
          <h3>Backend identity verification</h3>

          {backendLoading && <p>Verifying your identity...</p>}

          {backendError && (
            <p role="alert">{backendError}</p>
          )}

          {backendIdentity && (
            <>
              <p>Privy authentication: Verified</p>

              <p>
                SHGT registration:{" "}
                {backendIdentity.registered ? "Registered" : "Pending"}
              </p>

              {backendIdentity.accountStatus && (
                <p>
                  Account status: {backendIdentity.accountStatus}
                </p>
              )}

              {backendIdentity.userId && (
                <p>
                  SHGT user ID: {backendIdentity.userId}
                </p>
              )}
            </>
          )}
        </section>

        {activeTab === "Overview" && (
          <>
            <section className="welcome-banner">
              <div>
                <span className="banner-eyebrow">
                  YOUR FINANCIAL COMMUNITY
                </span>

                <h2>Welcome to your SHGT workspace.</h2>

                <p>
                  Your savings, group contributions and loan information
                  will appear here once your SHG membership is connected.
                </p>
              </div>

              <div className="banner-emblem">S</div>
            </section>

            <div className="section-heading">
              <div>
                <h2>Financial overview</h2>
                <p>Your account information and financial activity.</p>
              </div>

              <span className="preview-label">
                AWAITING DATA CONNECTION
              </span>
            </div>

            <div className="metric-grid">
              <MetricCard
                icon="₹"
                label="Total savings"
                value="Not connected"
                note="Oracle account data pending"
              />

              <MetricCard
                icon="◇"
                label="Active loans"
                value="Not connected"
                note="Loan records pending"
              />

              <MetricCard
                icon="↗"
                label="Group contributions"
                value="Not connected"
                note="SHG membership pending"
              />

              <MetricCard
                icon="◷"
                label="Recent transactions"
                value="Not connected"
                note="Ledger integration pending"
              />
            </div>

            <div className="dashboard-lower-grid">
              <section className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Recent activity</h3>
                    <p>Your latest account transactions</p>
                  </div>
                </div>

                <div className="empty-state">
                  <span className="empty-icon">◷</span>
                  <strong>No activity yet</strong>

                  <p>
                    Transactions will appear here after the ledger
                    integration is connected.
                  </p>
                </div>
              </section>

              <section className="dashboard-panel wallet-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Wallet status</h3>
                    <p>Your blockchain identity</p>
                  </div>

                  <span className="status-indicator" />
                </div>

                <div className="wallet-detail">
                  <span>EMBEDDED WALLET</span>
                  <strong>
                    {wallet?.address || "Wallet unavailable"}
                  </strong>
                </div>

                <div className="wallet-detail">
                  <span>PRIVY ID</span>
                  <strong>{user?.id || "Unavailable"}</strong>
                </div>

                <div className="wallet-badges">
                  <span className={wallet ? "connected-badge" : "pending-badge"}>
                    {wallet ? "Wallet connected" : "Wallet unavailable"}
                  </span>

                  <span className={hasPasskey ? "connected-badge" : "pending-badge"}>
                    {hasPasskey ? "Passkey linked" : "Passkey not linked"}
                  </span>
                </div>

                {!hasPasskey && (
                  <button
                    className="secondary-button dashboard-passkey"
                    onClick={onLinkPasskey}
                    disabled={linking}
                  >
                    {linking ? "Linking..." : "+ Link a passkey"}
                  </button>
                )}

                {message && (
                  <p className="feedback-message" role="status">
                    {message}
                  </p>
                )}
              </section>
            </div>
          </>
        )}

        {activeTab === "Savings" && (
          <EmptyPage
            icon="₹"
            title="Savings"
            description="Your SHG savings accounts and contribution history will appear here once Oracle data integration is complete."
          />
        )}

        {activeTab === "Loans" && (
          <EmptyPage
            icon="◇"
            title="Loans"
            description="Loan applications, approvals, repayment schedules and outstanding balances will appear here."
          />
        )}

        {activeTab === "Activity" && (
          <EmptyPage
            icon="◷"
            title="Transaction activity"
            description="Your verified savings, contribution, loan and blockchain transactions will appear here."
          />
        )}
      </section>
    </main>
  )
}

export default MemberDashboard
