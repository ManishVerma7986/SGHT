function DashboardSidebar({ activeTab, setActiveTab, onLogout }) {
  const navigation = [
    { name: "Overview", icon: "◫" },
    { name: "Savings", icon: "↗" },
    { name: "Loans", icon: "◇" },
    { name: "Activity", icon: "◷" },
  ]

  return (
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
            className={`nav-item ${activeTab === item.name ? "active" : ""}`}
            onClick={() => setActiveTab(item.name)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.name}
            {activeTab === item.name && (
              <span className="nav-active-dot" />
            )}
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
  )
}

export default DashboardSidebar
