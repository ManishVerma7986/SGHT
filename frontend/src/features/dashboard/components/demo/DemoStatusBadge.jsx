const labels = {
  ACTIVE: "Active",
  ON_TRACK: "On track",
  PAYMENT_DUE: "Payment due",
  PENDING_REVIEW: "Pending review",
  REJECTED: "Not approved",
  DEMO: "Demo record",
  DEMO_ONLY: "Demo only",
}

function DemoStatusBadge({ status }) {
  return (
    <span className={`demo-status-badge demo-status-${String(status).toLowerCase()}`}>
      <span aria-hidden="true" />
      {labels[status] || status}
    </span>
  )
}

export default DemoStatusBadge
