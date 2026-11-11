import { useCallback, useEffect, useMemo, useState } from "react"

import DemoDashboardFrame from "../../dashboard/components/demo/DemoDashboardFrame.jsx"
import DemoSavingsChart from "../../dashboard/components/demo/DemoSavingsChart.jsx"
import DemoStatusBadge from "../../dashboard/components/demo/DemoStatusBadge.jsx"
import { formatDemoCurrency, formatDemoDate } from "../../dashboard/components/demo/demo-format.js"
import { portalDataService } from "../services/portal-data.service.js"
import { normalizePortalError } from "../services/portal-data.error.js"
import { formatPortalCurrency, formatPortalDate } from "../utils/portal-format.js"
import PortalRecordTable, { PortalRecordDetails } from "./PortalRecordTable.jsx"
import "./portal-workspace.css"

const moduleLabels = Object.freeze({
  groups: "Group directory",
  membership: "Membership",
  savings: "Savings",
  loans: "Loans",
  repayments: "Repayments",
  transactions: "Transactions & ledger",
  notifications: "Notifications",
  reports: "Reports & analytics",
})

const moduleIcons = Object.freeze({
  groups: "⌂",
  membership: "♧",
  savings: "◈",
  loans: "↗",
  repayments: "↙",
  transactions: "▤",
  notifications: "◌",
  reports: "▥",
})

function sum(records, field) {
  return records.reduce((total, record) => total + (Number.isSafeInteger(record[field]) ? record[field] : 0), 0)
}

function currencyCell(value) {
  return <strong className="portal-money">{formatPortalCurrency(value)}</strong>
}

function dateCell(value) {
  return formatPortalDate(value)
}

function statusCell(value) {
  return <DemoStatusBadge status={value} />
}

function moduleHref(role, moduleName) {
  return role === "MEMBER"
    ? `?memberWorkspace=${encodeURIComponent(moduleName)}`
    : `?dashboardDemo=${encodeURIComponent(role)}&portal=${encodeURIComponent(moduleName)}`
}

function getScopedActivity(role, snapshot) {
  if (role === "MEMBER") return snapshot.transactions.filter((item) => item.person === "Lata Nair")
  if (role === "PRESIDENT") return snapshot.transactions.filter((item) => item.groupCode === "SHG-NORTH-014")
  return snapshot.transactions
}

function MetricCards({ metrics }) {
  return (
    <div className="portal-metrics">
      {metrics.map((item) => (
        <article className="portal-metric" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.note}</small>
        </article>
      ))}
    </div>
  )
}

function ModuleHeading({ name, description, mode = "demo" }) {
  return (
    <div className="portal-module-heading">
      <div>
        <div className="portal-kicker">STATIC WORKSPACE · {name.toLocaleUpperCase()}</div>
        <h2>{name}</h2>
        <p>{description}</p>
      </div>
      <span className={`portal-demo-pill${mode === "api" ? " portal-api-pill" : ""}`}>
        <span /> {mode === "api" ? "Authenticated API" : "Demo data"}
      </span>
    </div>
  )
}

function Notice({ title, children, tone = "info" }) {
  return (
    <aside className={`portal-notice portal-notice-${tone}`} role="note">
      <span aria-hidden="true">{tone === "warning" ? "!" : "i"}</span>
      <div><strong>{title}</strong><p>{children}</p></div>
    </aside>
  )
}

function ApiResource({ title, resource, columns, onSelect }) {
  if (resource.status === "unavailable") {
    return <Notice title={`${title} unavailable`} tone="warning">{resource.message}</Notice>
  }
  return (
    <PortalRecordTable
      title={title}
      description="Records returned by the authenticated backend for the current identity."
      rows={resource.records}
      columns={columns}
      onSelect={onSelect}
      emptyMessage="No records were returned for this authenticated account."
    />
  )
}

function ApiModuleContent({ moduleName, snapshot, onSelect }) {
  if (moduleName === "groups") {
    const { groups, requests } = snapshot.resources
    return (
      <>
        <ModuleHeading name="My groups" mode="api" description="Memberships and group requests returned for the verified account." />
        <Notice title="Authenticated account data">
          These values come from the backend API. A resource reported unavailable is not replaced with sample data.
        </Notice>
        <ApiResource
          title="Active group memberships"
          resource={groups}
          columns={[
            { key: "groupName", label: "Group" },
            { key: "groupCode", label: "Reference" },
            { key: "role", label: "Group role" },
            { key: "status", label: "Membership status" },
          ]}
          onSelect={onSelect}
        />
        <ApiResource
          title="My group requests"
          resource={requests}
          columns={[
            { key: "groupName", label: "Requested group" },
            { key: "requestId", label: "Request reference" },
            { key: "status", label: "Request status", render: (row) => statusCell(row.status) },
          ]}
          onSelect={onSelect}
        />
      </>
    )
  }

  const { groups, applications } = snapshot.resources
  return (
    <>
      <ModuleHeading name="My membership" mode="api" description="Current memberships and application history from authenticated endpoints." />
      <Notice title="Reviewer and lifecycle actions are unavailable" tone="warning">
        The API exposes only the current account’s memberships and requests. Reviewer display data, approvals, and membership lifecycle writes are not enabled.
      </Notice>
      <ApiResource
        title="Current group memberships"
        resource={groups}
        columns={[
          { key: "groupName", label: "Group" },
          { key: "groupCode", label: "Reference" },
          { key: "role", label: "Group role" },
          { key: "status", label: "Membership status" },
        ]}
        onSelect={onSelect}
      />
      <ApiResource
        title="My membership applications"
        resource={applications}
        columns={[
          { key: "groupCode", label: "Group reference" },
          { key: "requestId", label: "Request reference" },
          { key: "status", label: "Application status", render: (row) => statusCell(row.status) },
        ]}
        onSelect={onSelect}
      />
    </>
  )
}

function ModuleContent({ role, moduleName, snapshot, onSelect, onNavigate }) {
  const [membershipTab, setMembershipTab] = useState("members")
  const [reportType, setReportType] = useState("savings")
  const [notificationRows, setNotificationRows] = useState(snapshot.notifications)
  const [notificationCategory, setNotificationCategory] = useState("ALL")
  const [notificationSearch, setNotificationSearch] = useState("")
  const groups = snapshot.groups
  const loans = snapshot.loans

  const activity = useMemo(() => getScopedActivity(role, snapshot), [role, snapshot])

  if (moduleName === "groups") {
    const columns = [
      { key: "groupName", label: "Group", csvValue: (row) => row.groupName },
      { key: "groupCode", label: "Reference" },
      { key: "district", label: "District" },
      { key: "memberCount", label: "Members" },
      { key: "openingBalanceMinor", label: "Opening balance", render: (row) => currencyCell(row.openingBalanceMinor), csvValue: (row) => formatPortalCurrency(row.openingBalanceMinor) },
      { key: "savingsBalanceMinor", label: "Savings", render: (row) => currencyCell(row.savingsBalanceMinor), csvValue: (row) => formatPortalCurrency(row.savingsBalanceMinor) },
      { key: "status", label: "Status", render: (row) => statusCell(row.status) },
    ]
    return (
      <>
        <ModuleHeading name={moduleLabels.groups} description="Browse the illustrative groups in this role's demo scope." />
        <MetricCards metrics={[
          { label: "Groups in view", value: groups.length, note: "Static preview records" },
          { label: "Members in view", value: groups.reduce((total, group) => total + group.memberCount, 0), note: "Illustrative roster count" },
          { label: "Savings in view", value: formatPortalCurrency(sum(groups, "savingsBalanceMinor")), note: "Demo snapshot only" },
        ]} />
        <Notice title="Group changes are not available here">
          The authenticated group-request form remains on the Member Dashboard. This directory is read-only and does not change group status.
        </Notice>
        <PortalRecordTable
          title="Group directory"
          description="Select a record for group overview details. Search, sort, and export operate on displayed demo records."
          rows={groups}
          columns={columns}
          filterOptions={[{ value: "ACTIVE", label: "Active" }]}
          filterKey="status"
          onSelect={onSelect}
        />
      </>
    )
  }

  if (moduleName === "membership") {
    const members = snapshot.memberships
    const rows = membershipTab === "members" ? members : snapshot.membershipApplications
    const columns = membershipTab === "members"
      ? [
          { key: "name", label: "Member" },
          { key: "groupName", label: "Group" },
          { key: "role", label: "Group role" },
          { key: "joinedOn", label: "Joined", render: (row) => dateCell(row.joinedOn) },
          { key: "membershipStatus", label: "Status", render: (row) => statusCell(row.membershipStatus) },
        ]
      : [
          { key: "applicant", label: "Applicant" },
          { key: "groupCode", label: "Group reference" },
          { key: "submittedOn", label: "Applied", render: (row) => dateCell(row.submittedOn) },
          { key: "status", label: "Status", render: (row) => statusCell(row.status) },
        ]
    return (
      <>
        <ModuleHeading name={moduleLabels.membership} description="Membership roster and sample application history; reviewer authority is not simulated." />
        <MetricCards metrics={[
          { label: "Active memberships", value: members.length, note: "Records in this view" },
          { label: "Applications", value: snapshot.membershipApplications.length, note: "Illustrative requests" },
          { label: "Group officers", value: members.filter((member) => member.role !== "MEMBER").length, note: "Roles shown as data, not permission" },
        ]} />
        <div className="portal-tabs" role="tablist" aria-label="Membership lists">
          <button type="button" role="tab" aria-selected={membershipTab === "members"} onClick={() => setMembershipTab("members")}>Members</button>
          <button type="button" role="tab" aria-selected={membershipTab === "applications"} onClick={() => setMembershipTab("applications")}>Applications</button>
        </div>
        <Notice title={role === "MEMBER" ? "Membership actions remain in the authenticated workflow" : "Membership decisions are unavailable"}>
          {role === "MEMBER"
            ? "Use the existing application controls on your authenticated Member Dashboard. Demo records shown here are not linked to your SHGT identity."
            : "No reviewer display contract or role authorization is available for this static preview. No application can be approved, rejected, suspended, or terminated here."}
        </Notice>
        <PortalRecordTable
          title={membershipTab === "members" ? "Membership directory" : "Application history"}
          rows={rows}
          columns={columns}
          dateKey={membershipTab === "members" ? "joinedOn" : "submittedOn"}
          filterKey={membershipTab === "members" ? "membershipStatus" : "status"}
          filterOptions={membershipTab === "members"
            ? [{ value: "ACTIVE", label: "Active" }]
            : [{ value: "PENDING_REVIEW", label: "Pending review" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }]}
          emptyMessage="No matching records in this role's demo scope."
          onSelect={onSelect}
        />
      </>
    )
  }

  if (moduleName === "savings") {
    const contributions = snapshot.contributions
    const withdrawals = snapshot.withdrawals
    return (
      <>
        <ModuleHeading name={moduleLabels.savings} description="Group balances, sample contribution history, and withdrawal-request status." />
        <MetricCards metrics={[
          { label: "Group savings", value: formatPortalCurrency(sum(groups, "savingsBalanceMinor")), note: "Illustrative balance" },
          { label: "Monthly contributions", value: formatPortalCurrency(sum(contributions, "amountMinor")), note: "Matches the displayed contribution records in the sample period" },
          { label: "Prior-period balance", value: formatPortalCurrency(sum(groups, "openingBalanceMinor")), note: "Opening balance plus shown contributions equals demo savings" },
          { label: "Contributions shown", value: contributions.length, note: "Demo entries only" },
          { label: "Withdrawal requests", value: withdrawals.length, note: "No payment is implied" },
        ]} />
        <DemoSavingsChart data={snapshot.savingsTrend} title="Savings trend · illustrative" />
        <Notice title="No savings posting or withdrawal workflow is enabled" tone="warning">
          Contribution records and withdrawal requests are static examples. No funds moved, no balance was updated, and no approval can be made from this page.
        </Notice>
        <PortalRecordTable
          title="Contribution history"
          description="Individual contribution examples in the demo data."
          rows={contributions}
          columns={[
            { key: "memberName", label: "Member" },
            { key: "groupCode", label: "Group reference" },
            { key: "date", label: "Date", render: (row) => dateCell(row.date) },
            { key: "amountMinor", label: "Amount", render: (row) => currencyCell(row.amountMinor), csvValue: (row) => formatPortalCurrency(row.amountMinor) },
            { key: "status", label: "Status", render: (row) => statusCell(row.status) },
          ]}
          dateKey="date"
        />
        <PortalRecordTable
          title="Withdrawal request history"
          description="Request status examples only; not a transfer or cash disbursement."
          rows={withdrawals}
          columns={[
            { key: "requester", label: "Requester" },
            { key: "groupCode", label: "Group reference" },
            { key: "submittedOn", label: "Submitted", render: (row) => dateCell(row.submittedOn) },
            { key: "amountMinor", label: "Requested", render: (row) => currencyCell(row.amountMinor), csvValue: (row) => formatPortalCurrency(row.amountMinor) },
            { key: "status", label: "Status", render: (row) => statusCell(row.status) },
          ]}
          dateKey="submittedOn"
          filterKey="status"
          filterOptions={[{ value: "PENDING_REVIEW", label: "Pending" }, { value: "WITHDRAWN", label: "Withdrawn" }]}
          onSelect={onSelect}
        />
      </>
    )
  }

  if (moduleName === "loans") {
    return (
      <>
        <ModuleHeading name={moduleLabels.loans} description="Loan records and application states shown without underwriting or financial assumptions." />
        <MetricCards metrics={[
          { label: "Loans in view", value: loans.length, note: "Illustrative records" },
          { label: "Outstanding principal", value: formatPortalCurrency(sum(loans, "outstandingMinor")), note: "Static recorded demo value" },
          { label: "Overdue amount", value: formatPortalCurrency(sum(loans, "overdueMinor")), note: "Illustrative status data" },
          { label: "Applications", value: snapshot.loanApplications.length, note: "No decision is made here" },
        ]} />
        <Notice title="Terms, interest, eligibility, and full schedules are not defined" tone="warning">
          No interest amount, installment schedule, or eligibility result is calculated. Only the sample principal/outstanding values and next due dates are shown.
        </Notice>
        <PortalRecordTable
          title="Loan records"
          description="Open a record to see the fields available in the demo contract."
          rows={loans}
          columns={[
            { key: "borrower", label: "Borrower" },
            { key: "groupCode", label: "Group reference" },
            { key: "principalMinor", label: "Principal", render: (row) => currencyCell(row.principalMinor), csvValue: (row) => formatPortalCurrency(row.principalMinor) },
            { key: "outstandingMinor", label: "Outstanding", render: (row) => currencyCell(row.outstandingMinor), csvValue: (row) => formatPortalCurrency(row.outstandingMinor) },
            { key: "overdueMinor", label: "Overdue", render: (row) => currencyCell(row.overdueMinor), csvValue: (row) => formatPortalCurrency(row.overdueMinor) },
            { key: "interestMinor", label: "Interest", render: () => "Not calculated", csvValue: () => "Not calculated" },
            { key: "nextDue", label: "Next due", render: (row) => dateCell(row.nextDue) },
            { key: "status", label: "Status", render: (row) => statusCell(row.status) },
          ]}
          filterKey="status"
          filterOptions={[{ value: "ON_TRACK", label: "On track" }, { value: "PAYMENT_DUE", label: "Payment due" }]}
          dateKey="nextDue"
          onSelect={onSelect}
        />
        <PortalRecordTable
          title="Loan application history"
          rows={snapshot.loanApplications}
          columns={[
            { key: "applicant", label: "Applicant" },
            { key: "groupCode", label: "Group reference" },
            { key: "requestedMinor", label: "Requested amount", render: (row) => currencyCell(row.requestedMinor), csvValue: (row) => formatPortalCurrency(row.requestedMinor) },
            { key: "submittedOn", label: "Submitted", render: (row) => dateCell(row.submittedOn) },
            { key: "status", label: "Status", render: (row) => statusCell(row.status) },
          ]}
          dateKey="submittedOn"
          filterKey="status"
          filterOptions={[{ value: "PENDING_REVIEW", label: "Pending review" }]}
          emptyMessage="No loan applications are available for this role's demo scope."
        />
      </>
    )
  }

  if (moduleName === "repayments") {
    return (
      <>
        <ModuleHeading name={moduleLabels.repayments} description="Historical demo records and next-due dates; no payment collection is connected." />
        <MetricCards metrics={[
          { label: "Repayment entries", value: snapshot.repayments.length, note: "Sample history" },
          { label: "Repayment amounts listed", value: formatPortalCurrency(sum(snapshot.repayments, "amountMinor")), note: "Not verified receipts" },
          { label: "Upcoming due dates", value: snapshot.upcomingRepayments.length, note: "Dates only where no installment amount is defined" },
          { label: "Overdue amount", value: formatPortalCurrency(sum(snapshot.upcomingRepayments, "overdueMinor")), note: "Illustrative status data" },
        ]} />
        <Notice title="A listed repayment is not money received" tone="warning">
          Every repayment row is marked demo-only. Payment status verification and reconciliation are unavailable; amounts are not receipts.
        </Notice>
        <PortalRecordTable
          title="Repayment history"
          rows={snapshot.repayments}
          columns={[
            { key: "borrower", label: "Borrower" },
            { key: "groupCode", label: "Group reference" },
            { key: "date", label: "Date", render: (row) => dateCell(row.date) },
            { key: "amountMinor", label: "Listed amount", render: (row) => currencyCell(row.amountMinor), csvValue: (row) => formatPortalCurrency(row.amountMinor) },
            { key: "paymentStatus", label: "Payment status", render: () => <DemoStatusBadge status="DEMO" /> },
          ]}
          dateKey="date"
          emptyMessage="No repayment history is linked to this demo persona."
          onSelect={onSelect}
        />
        <PortalRecordTable
          title="Upcoming due dates"
          description="Only next due date is present; no contractual installment is fabricated."
          rows={snapshot.upcomingRepayments}
          columns={[
            { key: "borrower", label: "Borrower" },
            { key: "groupCode", label: "Group reference" },
            { key: "dueOn", label: "Next due", render: (row) => dateCell(row.dueOn) },
            { key: "amountDueMinor", label: "Installment", render: () => "Not defined", csvValue: () => "Not defined" },
            { key: "overdueMinor", label: "Overdue (demo)", render: (row) => currencyCell(row.overdueMinor), csvValue: (row) => formatPortalCurrency(row.overdueMinor) },
            { key: "status", label: "Status", render: (row) => statusCell(row.status) },
          ]}
          dateKey="dueOn"
          filterKey="status"
          filterOptions={[{ value: "PAYMENT_DUE", label: "Payment due" }, { value: "ON_TRACK", label: "On track" }]}
          emptyMessage="No due dates are linked to this demo persona."
          onSelect={onSelect}
        />
      </>
    )
  }

  if (moduleName === "transactions") {
    return (
      <>
        <ModuleHeading name={moduleLabels.transactions} description="Searchable event history built from the sample contribution and repayment records." />
        <MetricCards metrics={[
          { label: "Events in view", value: activity.length, note: "All marked demo" },
          { label: "Contribution samples", value: formatPortalCurrency(sum(activity.filter((item) => item.category === "Contribution"), "amountMinor")), note: "Listed event values" },
          { label: "Repayment samples", value: formatPortalCurrency(sum(activity.filter((item) => item.category === "Repayment"), "amountMinor")), note: "Not posted receipts" },
          { label: "Ledger status", value: "Unavailable", note: "No posted journal data" },
        ]} />
        <Notice title="This is event history, not a double-entry ledger" tone="warning">
          The demo contract does not define authoritative account-level debits or credits. Event categories and amounts are shown as examples only; no ledger posting is implied.
        </Notice>
        <PortalRecordTable
          title="Transaction event history"
          description="The date, group, category and sample amount are taken from the centralized demo dataset."
          rows={activity}
          columns={[
            { key: "date", label: "Date", render: (row) => dateCell(row.date) },
            { key: "person", label: "Member" },
            { key: "groupCode", label: "Group reference" },
            { key: "category", label: "Event category" },
            { key: "direction", label: "Demo event note" },
            { key: "amountMinor", label: "Sample amount", render: (row) => currencyCell(row.amountMinor), csvValue: (row) => formatPortalCurrency(row.amountMinor) },
            { key: "status", label: "Status", render: (row) => statusCell(row.status) },
          ]}
          dateKey="date"
          filterKey="category"
          allFilterLabel="All categories"
          filterOptions={[{ value: "Contribution", label: "Contribution" }, { value: "Repayment", label: "Repayment" }]}
          onSelect={onSelect}
        />
      </>
    )
  }

  if (moduleName === "notifications") {
    const unreadCount = notificationRows.filter((item) => !item.read).length
    const visibleNotifications = notificationRows.filter((item) =>
      (notificationCategory === "ALL" || item.category === notificationCategory) &&
      `${item.title} ${item.detail}`.toLocaleLowerCase().includes(notificationSearch.trim().toLocaleLowerCase())
    )
    const notificationCategories = [...new Set(snapshot.notifications.map((item) => item.category))]
    return (
      <>
        <ModuleHeading name={moduleLabels.notifications} description="Local-only read state and dismissal for illustrative messages." />
        <MetricCards metrics={[
          { label: "In this inbox", value: notificationRows.length, note: "Static demo notices" },
          { label: "Unread", value: unreadCount, note: "State remains in this page only" },
          { label: "Categories", value: new Set(notificationRows.map((item) => item.category)).size, note: "Membership, repayment, system" },
        ]} />
        <section className="portal-card portal-inbox">
          <div className="portal-card-heading"><div><div className="portal-kicker">DEMO INBOX</div><h2>Recent notifications</h2></div></div>
          <div className="portal-table-tools">
            <label className="portal-search">
              <span aria-hidden="true">⌕</span>
              <span className="portal-visually-hidden">Search notifications</span>
              <input type="search" value={notificationSearch} onChange={(event) => setNotificationSearch(event.target.value)} placeholder="Search notifications" />
            </label>
            <label className="portal-select-label">
              <span className="portal-visually-hidden">Filter notification category</span>
              <select value={notificationCategory} onChange={(event) => setNotificationCategory(event.target.value)}>
                <option value="ALL">All categories</option>
                {notificationCategories.map((category) => <option value={category} key={category}>{category}</option>)}
              </select>
            </label>
          </div>
          {notificationRows.length === 0 ? (
            <p className="portal-empty">All sample notices are dismissed.</p>
          ) : visibleNotifications.length === 0 ? (
            <p className="portal-empty">No notifications match this search or category.</p>
          ) : visibleNotifications.map((item) => (
            <article className={`portal-inbox-row${item.read ? " is-read" : ""}`} key={item.id}>
              <span className={`portal-notification-mark tone-${item.tone}`} aria-hidden="true">●</span>
              <div className="portal-inbox-copy">
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                <small>{item.category} · {formatPortalDate(item.date)}</small>
              </div>
              <div className="portal-inbox-actions">
                <a href={moduleHref(role, item.href)} onClick={(event) => {
                  if (item.href === moduleName) {
                    event.preventDefault()
                    onNavigate(item.href)
                  }
                }}>Open</a>
                {!item.read && <button type="button" onClick={() => setNotificationRows((current) => current.map((notice) => notice.id === item.id ? { ...notice, read: true } : notice))}>Mark read</button>}
                <button type="button" onClick={() => setNotificationRows((current) => current.filter((notice) => notice.id !== item.id))}>Dismiss</button>
              </div>
            </article>
          ))}
          <p className="portal-inline-note">Read and dismissed state is local to this demo page and is not saved to SHGT.</p>
        </section>
      </>
    )
  }

  const reports = snapshot.reports
  const reportOptions = role === "SECRETARY"
    ? ["memberships"]
    : role === "TREASURER"
      ? ["savings", "loans", "repayments", "groups"]
      : ["savings", "loans", "repayments", "groups", "memberships"]
  const reportRowsByType = {
    savings: groups.map((group) => ({
      id: group.groupCode,
      groupName: group.groupName,
      groupCode: group.groupCode,
      balanceMinor: group.savingsBalanceMinor,
      openingBalanceMinor: group.openingBalanceMinor,
      contributionMinor: group.monthlyContributionsMinor,
      date: "2026-11-10",
    })),
    loans: loans.map((loan) => ({
      ...loan,
      date: loan.nextDue,
    })),
    repayments: snapshot.repayments.map((repayment) => ({
      ...repayment,
      groupName: groups.find((group) => group.groupCode === repayment.groupCode)?.groupName || repayment.groupCode,
      date: repayment.date,
    })),
    groups: groups.map((group) => ({
      id: group.groupCode,
      groupName: group.groupName,
      district: group.district,
      memberCount: group.memberCount,
      status: group.status,
      date: group.createdOn,
    })),
    memberships: snapshot.memberships.map((member) => ({
      ...member,
      date: member.joinedOn,
    })),
  }
  const selectedReport = reportOptions.includes(reportType) ? reportType : reportOptions[0]
  const reportColumns = {
    savings: [
      { key: "groupName", label: "Group" },
      { key: "groupCode", label: "Reference" },
      { key: "openingBalanceMinor", label: "Opening balance", render: (row) => currencyCell(row.openingBalanceMinor), csvValue: (row) => formatPortalCurrency(row.openingBalanceMinor) },
      { key: "balanceMinor", label: "Savings balance", render: (row) => currencyCell(row.balanceMinor), csvValue: (row) => formatPortalCurrency(row.balanceMinor) },
      { key: "contributionMinor", label: "Monthly contributions", render: (row) => currencyCell(row.contributionMinor), csvValue: (row) => formatPortalCurrency(row.contributionMinor) },
      { key: "date", label: "As of", render: (row) => dateCell(row.date) },
    ],
    loans: [
      { key: "borrower", label: "Borrower" },
      { key: "groupCode", label: "Group reference" },
      { key: "principalMinor", label: "Principal", render: (row) => currencyCell(row.principalMinor), csvValue: (row) => formatPortalCurrency(row.principalMinor) },
      { key: "outstandingMinor", label: "Outstanding", render: (row) => currencyCell(row.outstandingMinor), csvValue: (row) => formatPortalCurrency(row.outstandingMinor) },
      { key: "date", label: "Next due", render: (row) => dateCell(row.date) },
    ],
    repayments: [
      { key: "borrower", label: "Borrower" },
      { key: "groupCode", label: "Group reference" },
      { key: "date", label: "Date", render: (row) => dateCell(row.date) },
      { key: "amountMinor", label: "Listed amount", render: (row) => currencyCell(row.amountMinor), csvValue: (row) => formatPortalCurrency(row.amountMinor) },
      { key: "paymentStatus", label: "Status", render: () => statusCell("DEMO_ONLY") },
    ],
    groups: [
      { key: "groupName", label: "Group" },
      { key: "district", label: "District" },
      { key: "memberCount", label: "Members" },
      { key: "status", label: "Status" },
      { key: "date", label: "Formed (demo)", render: (row) => dateCell(row.date) },
    ],
    memberships: [
      { key: "name", label: "Member" },
      { key: "groupName", label: "Group" },
      { key: "role", label: "Role" },
      { key: "membershipStatus", label: "Status" },
      { key: "date", label: "Joined", render: (row) => dateCell(row.date) },
    ],
  }
  const reportTitle = selectedReport === "memberships" ? "Membership report" : `${selectedReport[0].toLocaleUpperCase()}${selectedReport.slice(1)} report`
  return (
    <>
      <ModuleHeading name={moduleLabels.reports} description="Exportable summaries derived from the currently displayed demo records." />
      <MetricCards metrics={[
        { label: "Groups", value: reports.groupCount, note: "In current demo scope" },
        { label: "Memberships", value: snapshot.memberships.length, note: "Visible roster records" },
        { label: "Savings", value: formatPortalCurrency(sum(groups, "savingsBalanceMinor")), note: "Static total" },
        { label: "Outstanding loans", value: formatPortalCurrency(sum(loans, "outstandingMinor")), note: "No interest calculated" },
      ]} />
      <section className="portal-card portal-report-selector">
        <label htmlFor="portal-report-type">Report type
          <select id="portal-report-type" value={selectedReport} onChange={(event) => setReportType(event.target.value)}>
            {reportOptions.map((option) => <option value={option} key={option}>{option[0].toLocaleUpperCase()}{option.slice(1)}</option>)}
          </select>
        </label>
        {selectedReport === "savings" && <DemoSavingsChart data={snapshot.savingsTrend} title="Savings report trend · demo" />}
      </section>
      <Notice title="Demo report">
        Totals and CSV exports are derived from the displayed static records. They are not verified financial statements or audit reports.
      </Notice>
      <PortalRecordTable
        title={reportTitle}
        description="Use date fields, sorting, and CSV export to work with the currently displayed dataset."
        rows={reportRowsByType[selectedReport]}
        columns={reportColumns[selectedReport]}
        dateKey="date"
        filterKey={selectedReport === "groups" ? "status" : selectedReport === "memberships" ? "membershipStatus" : selectedReport === "loans" ? "status" : selectedReport === "repayments" ? "paymentStatus" : undefined}
        filterOptions={selectedReport === "groups"
          ? [{ value: "ACTIVE", label: "Active" }]
          : selectedReport === "memberships"
            ? [{ value: "ACTIVE", label: "Active" }]
            : selectedReport === "loans"
              ? [{ value: "ON_TRACK", label: "On track" }, { value: "PAYMENT_DUE", label: "Payment due" }]
              : selectedReport === "repayments"
                ? [{ value: "DEMO_ONLY", label: "Demo only" }]
                : []}
        onSelect={onSelect}
      />
      <p className="portal-inline-note">
        Report totals: {formatDemoCurrency(reports.savingsBalanceMinor)} savings · {formatDemoCurrency(reports.repaymentsMinor)} repayments listed · {formatDemoDate("2026-11-10")} demo snapshot.
      </p>
    </>
  )
}

function PortalWorkspace({
  role,
  moduleName,
  mode = "demo",
  getAccessToken,
  dataService = portalDataService,
}) {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState("")
  const [selectedRecord, setSelectedRecord] = useState(null)
  const availableModules = dataService.getAvailableModules(role)
  const closeRecordDetails = useCallback(() => setSelectedRecord(null), [])
  const moduleItems = availableModules.map((name) => ({
    id: name,
    label: moduleLabels[name],
    icon: moduleIcons[name],
    href: moduleHref(role, name),
  }))

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    Promise.resolve().then(async () => {
      const token = mode === "api"
        ? await getAccessToken?.()
        : undefined
      return dataService.getModuleSnapshot(role, moduleName, {
        mode,
        token,
        signal: controller.signal,
      })
    }).then(
      (data) => { if (active) setSnapshot(data) },
      (loadError) => {
        if (active && !controller.signal.aborted) {
          setError(normalizePortalError(loadError).message)
        }
      }
    )
    return () => {
      active = false
      controller.abort()
    }
  }, [dataService, getAccessToken, mode, moduleName, role])

  if (!availableModules.includes(moduleName)) {
    return <main className="portal-access-error" role="alert">This module is not available in the selected demo workspace.</main>
  }
  if (error) return <main className="portal-access-error" role="alert">{error}</main>
  if (!snapshot) return <main className="portal-loading" role="status">
    {mode === "api" ? "Loading authenticated records…" : "Loading static workspace records…"}
  </main>
  if (snapshot.mode === "api" && role !== "MEMBER") {
    return <main className="portal-access-error" role="alert">API mode is restricted to verified current-account endpoints.</main>
  }

  return (
    <DemoDashboardFrame
      role={role}
      navigation={moduleItems}
      activeSection={moduleName}
      workspaceHref={role === "MEMBER" ? "?" : `?dashboardDemo=${encodeURIComponent(role)}`}
      workspaceLabel="Return to dashboard"
    >
      <div className="portal-module-page">
        <div className="portal-static-banner">
          <span aria-hidden="true">i</span>
          <p><strong>{mode === "api" ? "Authenticated API workspace" : "Static demo workspace"}</strong> {mode === "api" ? "Data is returned for the verified identity. Unsupported resources remain unavailable." : "Illustrative data only. Role selection does not grant authorization; no live API, database, or financial action is connected."}</p>
        </div>
        {snapshot.mode === "api"
          ? <ApiModuleContent moduleName={moduleName} snapshot={snapshot} onSelect={setSelectedRecord} />
          : <ModuleContent
              key={moduleName}
              role={role}
              moduleName={moduleName}
              snapshot={snapshot}
              onSelect={setSelectedRecord}
              onNavigate={(target) => { window.location.assign(moduleHref(role, target)) }}
            />}
      </div>
      <PortalRecordDetails record={selectedRecord} onClose={closeRecordDetails} />
    </DemoDashboardFrame>
  )
}

export default PortalWorkspace
