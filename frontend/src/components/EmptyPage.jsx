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

export default EmptyPage
