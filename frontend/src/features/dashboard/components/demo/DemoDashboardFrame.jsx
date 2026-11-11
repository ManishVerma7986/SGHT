const roleDetails = Object.freeze({
  MEMBER: {
    name: "Member workspace",
    shortName: "Member",
    initials: "M",
    subtitle: "Member services · static preview",
  },
  PLATFORM_ADMIN: {
    name: "Platform administration",
    shortName: "Platform admin",
    initials: "PA",
    subtitle: "Network operations · static preview",
  },
  PRESIDENT: {
    name: "Group president",
    shortName: "President",
    initials: "GP",
    subtitle: "Group governance · static preview",
  },
  SECRETARY: {
    name: "Group secretary",
    shortName: "Secretary",
    initials: "GS",
    subtitle: "Member services · static preview",
  },
  TREASURER: {
    name: "Group treasurer",
    shortName: "Treasurer",
    initials: "GT",
    subtitle: "Financial oversight · static preview",
  },
})

const availableRoles = [
  ["PLATFORM_ADMIN", "Platform admin"],
  ["PRESIDENT", "President"],
  ["SECRETARY", "Secretary"],
  ["TREASURER", "Treasurer"],
]

function DemoDashboardFrame({
  role,
  navigation,
  activeSection,
  children,
  workspaceHref = role === "MEMBER"
    ? "?memberWorkspace=groups"
    : `?dashboardDemo=${encodeURIComponent(role)}&portal=groups`,
  workspaceLabel = "Explore application pages",
}) {
  const details = roleDetails[role]
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date())

  return (
    <div className="demo-dashboard" data-dashboard-role={role}>
      <aside className="demo-sidebar">
        <a className="demo-brand" href="?">
          <span className="demo-brand-mark" aria-hidden="true">S</span>
          <span>SHGT<span className="demo-brand-dot">.</span></span>
        </a>
        <div className="demo-sidebar-label">WORKSPACE PREVIEW</div>
        <nav className="demo-navigation" aria-label={`${details.name} sections`}>
          {navigation.map((item) => (
          <a
            key={item.id}
            href={item.href || `#${item.id}`}
            className={activeSection === item.id ? "is-active" : ""}
            aria-current={activeSection === item.id ? "location" : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </a>
          ))}
        </nav>
        <div className="demo-sidebar-bottom">
          <span className="demo-preview-dot" />
          Static demo only
          <a className="demo-back-link" href={workspaceHref}>{workspaceLabel} <span aria-hidden="true">↗</span></a>
          {role !== "MEMBER" && (
            <a className="demo-back-link" href="?">Return to member dashboard <span aria-hidden="true">↗</span></a>
          )}
        </div>
      </aside>

      <main className="demo-main">
        <header className="demo-topbar">
          <div className="demo-breadcrumb">
            SHGT <span>/</span> {details.shortName.toUpperCase()}
          </div>
          <div className="demo-topbar-right">
          <a className="demo-topbar-workspace" href={workspaceHref}>{workspaceLabel}</a>
          <span className="demo-date">{today}</span>
            <span className="demo-avatar" aria-hidden="true">{details.initials}</span>
            <span className="demo-role-name">{details.shortName}</span>
          </div>
        </header>

        <div className="demo-content">
          <section className="demo-callout" role="note">
            <span className="demo-callout-icon" aria-hidden="true">i</span>
            <p>
              <strong>DEMO PREVIEW</strong>
              <span>
                Illustrative static data only. This preview does not verify or
                grant this role; no payment, approval, or database action occurs.
              </span>
            </p>
          </section>

          <div className="demo-page-heading">
            <div>
              <div className="demo-eyebrow">{details.subtitle}</div>
              <h1>{details.name}</h1>
              <p>Clear oversight for the work that matters to your community.</p>
            </div>
            {role !== "MEMBER" && <label className="demo-role-switch">
              <span>Preview role</span>
              <select
                value={role}
                onChange={(event) => {
                  window.location.assign(
                    `?dashboardDemo=${encodeURIComponent(event.target.value)}`
                  )
                }}
                aria-label="Select demo dashboard role"
              >
                {availableRoles.map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>}
          </div>

          {children}
          <footer className="demo-footer">
            <span>SHGT · Prototype dashboard</span>
            <span>Live data and role authorization are not connected</span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default DemoDashboardFrame
