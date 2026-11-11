export function formatDemoCurrency(minorUnits) {
  if (!Number.isSafeInteger(minorUnits)) {
    return "Not available"
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minorUnits / 100)
}

export function formatDemoDate(value) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date)
}

export function formatDemoCount(value) {
  return new Intl.NumberFormat("en-IN").format(value)
}
