export function formatPortalCurrency(minorUnits) {
  if (!Number.isSafeInteger(minorUnits)) {
    return "Not available"
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minorUnits / 100)
}

export function formatPortalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "Not available"
  }
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date)
}

export function formatPortalCount(value) {
  return new Intl.NumberFormat("en-IN").format(value)
}

export function toCsv(rows, columns) {
  const escapeCell = (value) => {
    let text = String(value ?? "")
    if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) {
      text = `'${text}`
    }
    return `"${text.replaceAll('"', '""')}"`
  }
  const header = columns.map((column) => escapeCell(column.label)).join(",")
  const body = rows.map((row) =>
    columns.map((column) => {
      const value = column.csvValue
        ? column.csvValue(row)
        : row[column.key]
      return escapeCell(value)
    }).join(",")
  )
  return [header, ...body].join("\r\n")
}
