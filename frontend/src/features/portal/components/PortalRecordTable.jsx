import { useEffect, useMemo, useRef, useState } from "react"

import { formatPortalCurrency, formatPortalDate, toCsv } from "../utils/portal-format.js"

const PAGE_SIZE = 8

function exportCsv(rows, columns, title) {
  const contents = toCsv(rows, columns)
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}-demo.csv`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function PortalRecordTable({
  title,
  description,
  rows,
  columns,
  filterOptions = [],
  filterKey,
  allFilterLabel = "All statuses",
  dateKey,
  emptyMessage = "No matching demo records.",
  onSelect,
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("ALL")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [sortKey, setSortKey] = useState(dateKey || columns[0]?.key)
  const [sortDirection, setSortDirection] = useState("desc")
  const [page, setPage] = useState(1)

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return rows.filter((row) => {
      const matchesQuery = !normalizedQuery || columns.some((column) =>
        String(column.searchValue ? column.searchValue(row) : row[column.key] ?? "")
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      )
      const matchesFilter = filter === "ALL" || row[filterKey] === filter
      const recordDate = dateKey ? row[dateKey] : ""
      const matchesFrom = !fromDate || (recordDate && recordDate >= fromDate)
      const matchesTo = !toDate || (recordDate && recordDate <= toDate)
      return matchesQuery && matchesFilter && matchesFrom && matchesTo
    }).sort((left, right) => {
      const a = left[sortKey] ?? ""
      const b = right[sortKey] ?? ""
      const order = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b), undefined, { numeric: true })
      return sortDirection === "asc" ? order : -order
    })
  }, [columns, dateKey, filter, filterKey, fromDate, query, rows, sortDirection, sortKey, toDate])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function sortBy(key) {
    if (sortKey === key) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
    setPage(1)
  }

  return (
    <section className="portal-card portal-table-card">
      <div className="portal-card-heading">
        <div>
          <div className="portal-kicker">DEMO RECORDS</div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          className="portal-export-button"
          type="button"
          onClick={() => exportCsv(filteredRows, columns, title)}
          disabled={filteredRows.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className="portal-table-tools">
        <label className="portal-search">
          <span aria-hidden="true">⌕</span>
          <span className="portal-visually-hidden">Search {title.toLocaleLowerCase()}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1) }}
            placeholder="Search displayed records"
          />
        </label>
        {filterOptions.length > 0 && (
          <label className="portal-select-label">
            <span className="portal-visually-hidden">Filter {title.toLocaleLowerCase()}</span>
            <select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }}>
              <option value="ALL">{allFilterLabel}</option>
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
        {dateKey && (
          <div className="portal-date-range">
            <label>From <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => { setFromDate(event.target.value); setPage(1) }} /></label>
            <label>To <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => { setToDate(event.target.value); setPage(1) }} /></label>
          </div>
        )}
        <span className="portal-row-count" aria-live="polite">{filteredRows.length} records</span>
      </div>

      <div className="portal-table-scroll">
        <table className="portal-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th scope="col" key={column.key}>
                  <button
                    className="portal-sort-button"
                    type="button"
                    onClick={() => sortBy(column.key)}
                    aria-label={`Sort by ${column.label} ${sortKey === column.key && sortDirection === "asc" ? "descending" : "ascending"}`}
                  >
                    {column.label}
                    {sortKey === column.key && <span aria-hidden="true">{sortDirection === "asc" ? " ↑" : " ↓"}</span>}
                  </button>
                </th>
              ))}
              {onSelect && <th scope="col">Details</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id ?? row.groupCode ?? row.requestId ?? row.groupName}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render ? column.render(row) : row[column.key] ?? "—"}
                  </td>
                ))}
                {onSelect && (
                  <td>
                    <button className="portal-row-action" type="button" onClick={() => onSelect(row)}>
                      View
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 && <p className="portal-empty">{emptyMessage}</p>}
      </div>

      <div className="portal-pagination">
        <span>Page {page} of {pageCount}</span>
        <div>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Next</button>
        </div>
      </div>
    </section>
  )
}

export function PortalRecordDetails({ record, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    if (!record) return undefined
    const previousFocus = document.activeElement
    closeRef.current?.focus()

    function keepFocusInside(event) {
      if (event.key === "Escape") {
        onClose()
        return
      }
      if (event.key !== "Tab") return
      const focusable = Array.from(document.querySelectorAll(
        ".portal-detail-dialog button:not(:disabled), .portal-detail-dialog a[href], .portal-detail-dialog input:not(:disabled), .portal-detail-dialog select:not(:disabled)"
      ))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", keepFocusInside)
    return () => {
      document.removeEventListener("keydown", keepFocusInside)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onClose, record])

  if (!record) return null
  const entries = Object.entries(record).filter(([key]) =>
    !["id", "members", "schedule", "note"].includes(key)
  )

  return (
    <div className="portal-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section
        aria-labelledby="portal-detail-title"
        aria-modal="true"
        className="portal-detail-dialog"
        role="dialog"
      >
        <div className="portal-card-heading">
          <div>
            <div className="portal-kicker">ILLUSTRATIVE DETAILS</div>
            <h2 id="portal-detail-title">{record.groupName || record.name || record.borrower || record.applicant || record.id}</h2>
          </div>
          <button ref={closeRef} type="button" className="portal-dialog-close" onClick={onClose} aria-label="Close details">×</button>
        </div>
        <dl className="portal-detail-list">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toLocaleUpperCase())}</dt>
              <dd>{key.toLowerCase().includes("minor") && Number.isSafeInteger(value)
                ? formatPortalCurrency(value)
                    : ["date", "joinedon", "submittedon", "createdon", "nextdue", "dueon"].includes(key.toLowerCase())
                  ? formatPortalDate(value)
                  : value === null ? "Not available in the approved demo contract" : String(value)}
              </dd>
            </div>
          ))}
        </dl>
        {record.members?.length > 0 && (
          <section className="portal-detail-members">
            <h3>Sample member records</h3>
            <ul>
              {record.members.map((member) => (
                <li key={`${record.groupCode}-${member.name}`}>
                  <span>{member.name}</span><small>{member.role}</small>
                </li>
              ))}
            </ul>
            <p>This list contains illustrative roster entries, not a complete membership directory.</p>
          </section>
        )}
        {record.note && <p className="portal-detail-note">{record.note}</p>}
        {record.termsAvailable === false && (
          <p className="portal-detail-note">Loan terms, interest calculation, and a complete repayment schedule are not defined by the project contracts.</p>
        )}
        <button className="portal-primary-button" type="button" onClick={onClose}>Close</button>
      </section>
    </div>
  )
}

export default PortalRecordTable
