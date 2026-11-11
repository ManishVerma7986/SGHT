import { formatDemoCurrency, formatDemoDate } from "./demo-format.js"

function DemoActivityFeed({ items }) {
  return (
    <section className="demo-card demo-activity" aria-labelledby="demo-activity-title">
      <div className="demo-card-heading">
        <div>
          <div className="demo-card-kicker">RECENT ACTIVITY · DEMO</div>
          <h2 id="demo-activity-title">Latest updates</h2>
        </div>
        <span className="demo-record-count">{items.length} events</span>
      </div>
      {items.length === 0 ? (
        <p className="demo-empty">No sample activity for this view.</p>
      ) : (
        <ul className="demo-activity-list">
          {items.map((item) => (
            <li className="demo-activity-item" key={item.id}>
              <span className={`demo-activity-icon kind-${item.kind.toLowerCase()}`} aria-hidden="true">
                {item.kind === "CONTRIBUTION" ? "+" : item.kind === "REPAYMENT" ? "↙" : "•"}
              </span>
              <div className="demo-activity-copy">
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <div className="demo-activity-meta">
                {Number.isSafeInteger(item.amountMinor) && (
                  <strong>{formatDemoCurrency(item.amountMinor)}</strong>
                )}
                <time dateTime={item.date}>{formatDemoDate(item.date)}</time>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="demo-activity-footnote">All events are illustrative and are not posted transactions.</p>
    </section>
  )
}

export default DemoActivityFeed
