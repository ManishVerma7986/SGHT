function DashboardHeader({ user, activeTab }) {
  const displayName = user?.email?.address || "SHGT Member"

  return (
    <header className="dashboard-header">
      <div>
        <div className="dashboard-breadcrumb">SHGT / MEMBER</div>
        <h1>{activeTab}</h1>
      </div>

      <div className="profile-chip">
        <div className="profile-avatar">
          {displayName.charAt(0).toUpperCase()}
        </div>

        <div className="profile-info">
          <strong>{displayName}</strong>
          <span>Member account</span>
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader
