import { useMemo, useState } from "react"

function DemoDataTable({
  title,
  description,
  rows,
  columns,
  searchPlaceholder = "Search records",
  filterOptions = [],
  filterKey,
  emptyMessage = "No matching demo records.",
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("ALL")

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return rows.filter((row) => {
      const matchesQuery = !normalizedQuery ||
        columns.some((column) =>
          String(column.searchValue ? column.searchValue(row) : row[column.key] ?? "")
            .toLocaleLowerCase()
            .includes(normalizedQuery)
        )
      const matchesFilter = filter === "ALL" ||
        (filterKey && row[filterKey] === filter)
      return matchesQuery && matchesFilter
    })
  }, [columns, filter, filterKey, query, rows])

  return (
    <section className="demo-card demo-table-card">
      <div className="demo-card-heading">
        <div>
          <div className="demo-card-kicker">ILLUSTRATIVE RECORDS</div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <span className="demo-record-count">{filteredRows.length} shown</span>
      </div>
      <div className="demo-table-controls">
        <label className="demo-search">
          <span className="sr-only">Search {title.toLowerCase()}</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
        {filterOptions.length > 0 && (
          <label className="demo-filter">
            <span className="sr-only">Filter {title.toLowerCase()}</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="demo-table-scroll">
        <table className="demo-table">
          <thead>
            <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id ?? row.groupCode ?? row.requestId ?? row.groupName}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && <p className="demo-empty">{emptyMessage}</p>}
      </div>
    </section>
  )
}

export default DemoDataTable
