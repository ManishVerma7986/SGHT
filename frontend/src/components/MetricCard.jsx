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

export default MetricCard
