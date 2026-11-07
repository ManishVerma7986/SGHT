
import { useState } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import './App.css'

function App() {
  const {
    ready,
    authenticated,
    user,
    login,
    logout,
    linkPasskey,
  } = usePrivy()

  const { wallets } = useWallets()

  const [linking, setLinking] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('Overview')
  const [coinTilt, setCoinTilt] = useState({ x: 12, y: -16 })

  const hasPasskey = user?.linkedAccounts?.some(
    (account) => account.type === 'passkey'
  )

  const wallet = wallets.find(
    (item) => item.walletClientType === 'privy'
  )

  const handleLinkPasskey = async () => {
    setLinking(true)
    setMessage('')

    try {
      await linkPasskey()
      setMessage('Passkey linked successfully!')
    } catch (error) {
      console.error(error)
      setMessage(error.message || 'Passkey linking failed.')
    } finally {
      setLinking(false)
    }
  }

  const handleCoinMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height

    setCoinTilt({
      x: 12 + (0.5 - y) * 25,
      y: -16 + (x - 0.5) * 30,
    })
  }

  if (!ready) {
    return (
      <main className="loading-screen">
        <div className="loading-orb" />
        <p>Preparing your SHGT experience...</p>
      </main>
    )
  }

  if (authenticated) {
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
      />
    )
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />
      <div className="grid-overlay" />

      <nav className="navbar">
        <a className="brand" href="#">
          <span className="brand-symbol">S</span>
          <span>SHGT<span className="brand-dot">.</span></span>
        </a>

        <div className="nav-status">
          <span className="status-indicator" />
          Secure blockchain platform
        </div>
      </nav>

      <section className="main-content">
        <div className="hero-section">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            FINANCIAL FREEDOM, TOGETHER
          </div>

          <h1>
            Empowering
            <br />
            communities.
            <br />
            <span className="gradient-text">Building futures.</span>
          </h1>

          <p className="hero-description">
            A smarter way to save, collaborate and access
            community-driven microfinance. Built on trust,
            powered by blockchain.
          </p>

          <div className="feature-list">
            <div className="feature">
              <span className="feature-icon">✦</span>
              <span>Transparent transactions</span>
            </div>
            <div className="feature">
              <span className="feature-icon">◇</span>
              <span>Community-powered savings</span>
            </div>
            <div className="feature">
              <span className="feature-icon">⌁</span>
              <span>Secure digital identity</span>
            </div>
          </div>

          <div
            className="visual-stage"
            onPointerMove={handleCoinMove}
            onPointerLeave={() => setCoinTilt({ x: 12, y: -16 })}
          >
            <div className="orbit orbit-outer" />
            <div className="orbit orbit-middle" />
            <div className="orbit orbit-inner" />

            <div className="floating-symbol symbol-one">₹</div>
            <div className="floating-symbol symbol-two">✦</div>
            <div className="floating-symbol symbol-three">◇</div>

            <div className="coin-shadow" />

            <div
              className="coin"
              style={{
                transform: `rotateX(${coinTilt.x}deg) rotateY(${coinTilt.y}deg)`,
              }}
            >
              <div className="coin-edge" />
              <div className="coin-face">
                <div className="coin-inner">
                  <span className="coin-letter">S</span>
                  <span className="coin-name">SHGT</span>
                  <span className="coin-stars">✦ · ✦ · ✦</span>
                </div>
              </div>
            </div>

            <div className="visual-caption">
              <span className="caption-line" />
              TRUST THROUGH TECHNOLOGY
            </div>
          </div>
        </div>

        <div className="auth-section">
          <div className="auth-card">
            <div className="card-top-glow" />

            <div className="card-icon">
              <span>↗</span>
            </div>

            <div className="card-eyebrow">YOUR COMMUNITY. YOUR FUTURE.</div>

            <h2>Welcome to SHGT</h2>

            <p className="card-description">
              Sign in securely to access your community's
              savings and financial services.
            </p>

            <button className="primary-button" onClick={login}>
              <span>Continue to SHGT</span>
              <span className="button-arrow">→</span>
            </button>

            <div className="login-methods">
              <span>EMAIL</span>
              <i />
              <span>GOOGLE</span>
              <i />
              <span>PASSKEY</span>
            </div>

            <div className="security-note">
              <span className="lock-icon">⌑</span>
              Protected by secure embedded wallet technology
            </div>
          </div>

          <p className="outside-caption">
            TRUSTED TECHNOLOGY. STRONGER COMMUNITIES.
          </p>
        </div>
      </section>

      <footer className="footer">
        <span>© 2026 SHGT PROJECT</span>
        <span>SECURE · TRANSPARENT · COMMUNITY FIRST</span>
      </footer>
    </main>
  )
}

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
}) {
  const navigation = [
    { name: 'Overview', icon: '◫' },
    { name: 'Savings', icon: '↗' },
    { name: 'Loans', icon: '◇' },
    { name: 'Activity', icon: '◷' },
  ]

  return (
    <main className="dashboard-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <aside className="dashboard-sidebar">
        <a className="brand" href="#">
          <span className="brand-symbol">S</span>
          <span>SHGT<span className="brand-dot">.</span></span>
        </a>

        <div className="sidebar-label">MEMBER WORKSPACE</div>

        <nav className="dashboard-nav">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${activeTab === item.name ? 'active' : ''}`}
              onClick={() => setActiveTab(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
              {activeTab === item.name && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-security">
            <span className="status-indicator" />
            Wallet infrastructure ready
          </div>
          <button className="logout-button sidebar-logout" onClick={onLogout}>
            Sign out <span>→</span>
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <div className="dashboard-breadcrumb">SHGT / MEMBER</div>
            <h1>{activeTab}</h1>
          </div>

          <div className="profile-chip">
            <div className="profile-avatar">
              {(user?.email?.address || 'M').charAt(0).toUpperCase()}
            </div>
            <div className="profile-info">
              <strong>{user?.email?.address || 'SHGT Member'}</strong>
              <span>Member account</span>
            </div>
          </div>
        </header>

        {activeTab === 'Overview' && (
          <>
            <section className="welcome-banner">
              <div>
                <span className="banner-eyebrow">YOUR FINANCIAL COMMUNITY</span>
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
              <span className="preview-label">AWAITING DATA CONNECTION</span>
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
                  <strong>{wallet?.address || 'Wallet unavailable'}</strong>
                </div>

                <div className="wallet-detail">
                  <span>PRIVY ID</span>
                  <strong>{user?.id || 'Unavailable'}</strong>
                </div>

                <div className="wallet-badges">
                  <span className="connected-badge">Wallet connected</span>
                  <span className={hasPasskey ? 'connected-badge' : 'pending-badge'}>
                    {hasPasskey ? 'Passkey linked' : 'Passkey not linked'}
                  </span>
                </div>

                {!hasPasskey && (
                  <button
                    className="secondary-button dashboard-passkey"
                    onClick={onLinkPasskey}
                    disabled={linking}
                  >
                    {linking ? 'Linking...' : '＋ Link a passkey'}
                  </button>
                )}

                {message && (
                  <p className="feedback-message" role="status">{message}</p>
                )}
              </section>
            </div>
          </>
        )}

        {activeTab === 'Savings' && (
          <EmptyPage
            icon="₹"
            title="Savings"
            description="Your SHG savings accounts and contribution history will appear here once Oracle data integration is complete."
          />
        )}

        {activeTab === 'Loans' && (
          <EmptyPage
            icon="◇"
            title="Loans"
            description="Loan applications, approvals, repayment schedules and outstanding balances will appear here."
          />
        )}

        {activeTab === 'Activity' && (
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

function MetricCard({ icon, label, value, note }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  )
}

function EmptyPage({ icon, title, description }) {
  return (
    <section className="empty-page-panel">
      <div className="empty-page-icon">{icon}</div>
      <span className="banner-eyebrow">SHGT MEMBER SERVICES</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <span className="preview-label">INTEGRATION IN PROGRESS</span>
    </section>
  )
}

export default App
