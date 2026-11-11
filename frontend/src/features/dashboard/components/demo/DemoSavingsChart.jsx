import { formatDemoCurrency } from "./demo-format.js"

function DemoSavingsChart({ data, title = "Group savings trend" }) {
  const width = 720
  const height = 220
  const left = 54
  const right = 18
  const top = 18
  const bottom = 34
  const max = Math.max(...data.map((item) => item.amountMinor), 1)
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const points = data.map((item, index) => ({
    ...item,
    x: left + (data.length === 1 ? plotWidth / 2 : (plotWidth * index) / (data.length - 1)),
    y: top + plotHeight - (item.amountMinor / max) * plotHeight,
  }))
  const line = points.map((point) => `${point.x},${point.y}`).join(" ")
  const area = `${left},${top + plotHeight} ${line} ${left + plotWidth},${top + plotHeight}`

  return (
    <section className="demo-card demo-chart-card" aria-labelledby="demo-chart-title">
      <div className="demo-card-heading">
        <div>
          <div className="demo-card-kicker">SAVINGS MOMENTUM</div>
          <h2 id="demo-chart-title">{title}</h2>
        </div>
        <span className="demo-chart-period">Jun — Nov 2026 · demo</span>
      </div>
      <div className="demo-chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Illustrative savings balance grows from ${formatDemoCurrency(data[0]?.amountMinor || 0)} to ${formatDemoCurrency(data.at(-1)?.amountMinor || 0)} over ${data.length} months`}
        >
          <defs>
            <linearGradient id="demo-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--demo-accent)" stopOpacity=".28" />
              <stop offset="100%" stopColor="var(--demo-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((step) => {
            const y = top + (plotHeight * step) / 3
            return <line key={step} x1={left} x2={width - right} y1={y} y2={y} className="demo-chart-gridline" />
          })}
          <polygon points={area} fill="url(#demo-chart-fill)" />
          <polyline points={line} className="demo-chart-line" />
          {points.map((point) => (
            <g key={point.month}>
              <circle cx={point.x} cy={point.y} r="4" className="demo-chart-point" />
              <text x={point.x} y={height - 8} textAnchor="middle" className="demo-chart-label">
                {point.month}
              </text>
            </g>
          ))}
          <text x="0" y={top + 5} className="demo-chart-value">
            {formatDemoCurrency(max)}
          </text>
          <text x="0" y={top + plotHeight} className="demo-chart-value">
            {formatDemoCurrency(0)}
          </text>
        </svg>
      </div>
    </section>
  )
}

export default DemoSavingsChart
