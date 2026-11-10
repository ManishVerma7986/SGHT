import { useState } from "react"

function LoginPage({ onLogin }) {
  const [coinTilt, setCoinTilt] = useState({ x: 12, y: -16 })
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState("")

  const handleLogin = async () => {
    setLoggingIn(true)
    setLoginError("")

    try {
      await onLogin()
    } catch (error) {
      console.error("SHGT login failed:", error)
      setLoginError("Unable to start sign in. Please try again.")
    } finally {
      setLoggingIn(false)
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
              <span className="feature-icon">⌘</span>
              <span>Secure digital identity</span>
            </div>
          </div>

          <div
            className="visual-stage"
            aria-hidden="true"
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

            <button
              className="primary-button"
              type="button"
              onClick={handleLogin}
              disabled={loggingIn}
              aria-busy={loggingIn}
            >
              <span>{loggingIn ? "Opening secure sign in..." : "Continue to SHGT"}</span>
              <span className="button-arrow">→</span>
            </button>

            {loginError && (
              <p className="feedback-message is-error" role="alert">
                {loginError}
              </p>
            )}

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

export default LoginPage
