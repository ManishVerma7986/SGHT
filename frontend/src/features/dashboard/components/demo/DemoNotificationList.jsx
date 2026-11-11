import { useState } from "react"

function DemoNotificationList({ items }) {
  const [dismissed, setDismissed] = useState([])
  const visible = items.filter((item) => !dismissed.includes(item.id))

  return (
    <section className="demo-card demo-notifications" id="notifications">
      <div className="demo-card-heading">
        <div>
          <div className="demo-card-kicker">INBOX</div>
          <h2>Updates</h2>
        </div>
        <span className="demo-record-count">{visible.length} new</span>
      </div>
      {visible.length === 0 ? (
        <p className="demo-empty">You’re all caught up in this demo.</p>
      ) : (
        <ul className="demo-notification-list">
          {visible.map((item) => (
            <li className={`demo-notification tone-${item.tone}`} key={item.id}>
              <span className="demo-notification-mark" aria-hidden="true">•</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => setDismissed((current) => [...current, item.id])}
                aria-label={`Dismiss ${item.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default DemoNotificationList
