function DashboardSidebar({ activeTab, setActiveTab, onLogout }) {
  const navigation = [
    { name: "Overview", icon: "◫" },
    { name: "Savings", icon: "↗" },
    { name: "Loans", icon: "◇" },
    { name: "Activity", icon: "◷" },
  ]

  return (
    <aside className="dashboard-sidebar">
      <div className="brand">
        <span className="brand-symbol">S</span>
        <span>SHGT<span className="brand-dot">.</span></span>
      </div>

      <div className="sidebar-label">MEMBER WORKSPACE</div>

      <nav className="dashboard-nav" aria-label="Member workspace">
        {navigation.map((item) => (
          <button
            key={item.name}
            type="button"
            className={`nav-item ${activeTab === item.name ? "active" : ""}`}
            onClick={() => setActiveTab(item.name)}
            aria-current={activeTab === item.name ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            {item.name}
            {activeTab === item.name && (
              <span className="nav-active-dot" />
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-security">
          <span className="status-indicator" aria-hidden="true" />
          Account identity verified
        </div>

        <button
          className="logout-button sidebar-logout"
          type="button"
          onClick={onLogout}
        >
          Sign out <span>→</span>
        </button>
      </div>
    </aside>
  )
}

export default DashboardSidebar
