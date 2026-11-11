import { formatDemoCount, formatDemoCurrency } from "./demo-format.js"

function DemoMetricGrid({ metrics }) {
  return (
    <section className="demo-metric-grid" aria-label="Dashboard summary">
      {metrics.map((metric, index) => (
        <article className="demo-metric-card" key={metric.label} style={{ "--metric-index": index }}>
          <div className="demo-metric-top">
            <span>{metric.label}</span>
            <span className="demo-metric-icon" aria-hidden="true">{metric.icon}</span>
          </div>
          <strong>
            {metric.format === "currency"
              ? formatDemoCurrency(metric.value)
              : formatDemoCount(metric.value)}
          </strong>
          <span className="demo-metric-note">{metric.note}</span>
        </article>
      ))}
    </section>
  )
}

export default DemoMetricGrid
