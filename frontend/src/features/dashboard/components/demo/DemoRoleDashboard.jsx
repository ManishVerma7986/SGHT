import { useEffect, useState } from "react"

import {
  formatDemoCurrency,
  formatDemoDate,
} from "./demo-format.js"
import DemoDashboardFrame from "./DemoDashboardFrame.jsx"
import DemoActivityFeed from "./DemoActivityFeed.jsx"
import DemoDataTable from "./DemoDataTable.jsx"
import DemoMetricGrid from "./DemoMetricGrid.jsx"
import DemoNotificationList from "./DemoNotificationList.jsx"
import DemoSavingsChart from "./DemoSavingsChart.jsx"
import DemoStatusBadge from "./DemoStatusBadge.jsx"
import { dashboardDataService } from "../../services/dashboard-data.service.js"
import "./demo-dashboard.css"

const navigationByRole = {
  PLATFORM_ADMIN: [
    { id: "network", label: "Network overview", icon: "◈" },
    { id: "groups", label: "Groups", icon: "⌂" },
    { id: "requests", label: "Creation requests", icon: "▤" },
    { id: "activity", label: "Activity", icon: "◷" },
    { id: "notifications", label: "Updates", icon: "◌" },
  ],
  PRESIDENT: [
    { id: "overview", label: "Group overview", icon: "◈" },
    { id: "membership", label: "Membership queue", icon: "♧" },
    { id: "loans", label: "Loan watch", icon: "↗" },
    { id: "activity", label: "Activity", icon: "◷" },
    { id: "notifications", label: "Updates", icon: "◌" },
  ],
  SECRETARY: [
    { id: "directory", label: "Member directory", icon: "♧" },
    { id: "applications", label: "Applications", icon: "▤" },
    { id: "groups", label: "Group roster", icon: "⌂" },
    { id: "activity", label: "Activity", icon: "◷" },
    { id: "notifications", label: "Updates", icon: "◌" },
  ],
  TREASURER: [
    { id: "finance", label: "Financial overview", icon: "◈" },
    { id: "contributions", label: "Contributions", icon: "＋" },
    { id: "loans", label: "Loans & repayments", icon: "↗" },
    { id: "activity", label: "Activity", icon: "◷" },
    { id: "notifications", label: "Updates", icon: "◌" },
  ],
}

function metric(label, value, icon, note, format) {
  return { label, value, icon, note, format }
}

function StatusCell({ status }) {
  return <DemoStatusBadge status={status} />
}

function CurrencyCell({ value }) {
  return <span className="demo-currency-cell">{formatDemoCurrency(value)}</span>
}

function DateCell({ value }) {
  return formatDemoDate(value)
}

function PageSection({ id, className = "", children }) {
  return <section id={id} className={`demo-section ${className}`}>{children}</section>
}

function RoleDashboardContent({ snapshot, role }) {
  const { summary, groups, membershipApplications, activeLoans } = snapshot
  const firstGroup = groups[0]

  if (role === "PLATFORM_ADMIN") {
    const groupColumns = [
      { key: "groupName", label: "Group" },
      { key: "district", label: "District" },
      { key: "memberCount", label: "Members" },
      { key: "savingsBalanceMinor", label: "Savings", render: (row) => <CurrencyCell value={row.savingsBalanceMinor} /> },
      { key: "status", label: "Status", render: (row) => <StatusCell status={row.status} /> },
    ]
    const requestColumns = [
      { key: "groupName", label: "Proposed group" },
      { key: "district", label: "District" },
      { key: "submittedOn", label: "Submitted", render: (row) => <DateCell value={row.submittedOn} /> },
      { key: "status", label: "Status", render: (row) => <StatusCell status={row.status} /> },
    ]
    return (
      <>
        <PageSection id="network">
          <DemoMetricGrid metrics={[
            metric("Active groups", summary.activeGroups, "⌂", "Across the demo network"),
            metric("Active memberships", summary.activeMemberships, "♧", "Illustrative roster total"),
            metric("Savings held", summary.savingsBalanceMinor, "◈", "Snapshot total · demo", "currency"),
            metric("Requests to review", summary.pendingGroupApplications, "▤", "No live admin action available"),
          ]} />
          <DemoSavingsChart data={snapshot.savingsTrend} title="Savings across the network" />
        </PageSection>
        <PageSection id="groups">
          <DemoDataTable
            title="Group directory"
            description="High-level view of active demo groups and their reported savings."
            rows={groups}
            columns={groupColumns}
            searchPlaceholder="Search group or district"
          />
        </PageSection>
        <PageSection id="requests">
          <div className="demo-action-notice">
            <span aria-hidden="true">⌁</span>
            <div><strong>Approval tools are unavailable</strong><p>Platform-admin identity and production workflow authorization are not configured. These sample requests are view-only.</p></div>
          </div>
          <DemoDataTable
            title="Group creation requests"
            description="Illustrative submissions awaiting a future authorized review workflow."
            rows={snapshot.groupApplications}
            columns={requestColumns}
            searchPlaceholder="Search requests"
            filterOptions={[{ value: "PENDING_REVIEW", label: "Pending review" }]}
            filterKey="status"
          />
        </PageSection>
      </>
    )
  }

  if (role === "PRESIDENT") {
    const groupMembershipApplications = membershipApplications.filter(
      (application) => application.groupCode === firstGroup.groupCode
    )
    const memberColumns = [
      { key: "applicant", label: "Applicant" },
      { key: "submittedOn", label: "Applied", render: (row) => <DateCell value={row.submittedOn} /> },
      { key: "status", label: "Status", render: (row) => <StatusCell status={row.status} /> },
    ]
    const loanColumns = [
      { key: "borrower", label: "Member" },
      { key: "outstandingMinor", label: "Outstanding", render: (row) => <CurrencyCell value={row.outstandingMinor} /> },
      { key: "overdueMinor", label: "Overdue", render: (row) => <CurrencyCell value={row.overdueMinor} /> },
      { key: "nextDue", label: "Next due", render: (row) => <DateCell value={row.nextDue} /> },
      { key: "status", label: "Status", render: (row) => <StatusCell status={row.status} /> },
    ]
    return (
      <>
        <PageSection id="overview">
          <div className="demo-group-banner">
            <div className="demo-group-monogram" aria-hidden="true">S</div>
            <div><span>YOUR DEMO GROUP</span><strong>{firstGroup.groupName}</strong><small>{firstGroup.district} · led by {firstGroup.presidentName}</small></div>
            <span className="demo-group-members">{firstGroup.memberCount} members</span>
          </div>
          <DemoMetricGrid metrics={[
            metric("Group savings", firstGroup.savingsBalanceMinor, "◈", "Illustrative balance", "currency"),
            metric("Monthly contributions", firstGroup.monthlyContributionsMinor, "＋", "Sample monthly total", "currency"),
            metric("Membership requests", groupMembershipApplications.length, "♧", "Read-only preview"),
            metric("Loans to monitor", activeLoans.filter((loan) => loan.groupCode === firstGroup.groupCode).length, "↗", "Sample loan records"),
          ]} />
          <DemoSavingsChart
            data={snapshot.groupSavingsTrends[firstGroup.groupCode]}
            title="Collective savings growth"
          />
        </PageSection>
        <PageSection id="membership">
          <div className="demo-action-notice">
            <span aria-hidden="true">♧</span>
            <div><strong>Membership decisions are not enabled here</strong><p>Officer permissions must be verified by the backend. No applicant can be approved or rejected from a static preview.</p></div>
          </div>
          <DemoDataTable
            title="Membership applications"
            description="Sample queue for this group; applicant details are fictional."
            rows={groupMembershipApplications}
            columns={memberColumns}
            searchPlaceholder="Search applicants"
            filterOptions={[{ value: "PENDING_REVIEW", label: "Pending review" }]}
            filterKey="status"
          />
        </PageSection>
        <PageSection id="loans">
          <DemoDataTable
            title="Loan watch"
            description="Outstanding and due figures are illustrative, not payment records."
            rows={activeLoans.filter((loan) => loan.groupCode === firstGroup.groupCode)}
            columns={loanColumns}
            searchPlaceholder="Search members"
            filterOptions={[
              { value: "ON_TRACK", label: "On track" },
              { value: "PAYMENT_DUE", label: "Payment due" },
            ]}
            filterKey="status"
          />
        </PageSection>
      </>
    )
  }

  if (role === "SECRETARY") {
    const roster = groups.flatMap((group) =>
      group.members.map((member, index) => ({
        id: `${group.groupCode}-${index}`,
        name: member.name,
        role: member.role,
        groupName: group.groupName,
        district: group.district,
        joinedOn: member.joinedOn,
      }))
    )
    const rosterColumns = [
      { key: "name", label: "Member" },
      { key: "groupName", label: "Group" },
      { key: "role", label: "Group role", render: (row) => <span className="demo-role-chip">{row.role.toLowerCase()}</span> },
      { key: "joinedOn", label: "Joined", render: (row) => <DateCell value={row.joinedOn} /> },
    ]
    const applicationColumns = [
      { key: "applicant", label: "Applicant" },
      { key: "groupCode", label: "Group reference" },
      { key: "submittedOn", label: "Applied", render: (row) => <DateCell value={row.submittedOn} /> },
      { key: "status", label: "Status", render: (row) => <StatusCell status={row.status} /> },
    ]
    return (
      <>
        <PageSection id="directory">
          <DemoMetricGrid metrics={[
            metric("Visible roster entries", roster.length, "♧", "Across the displayed sample groups"),
            metric("Active groups", summary.activeGroups, "⌂", "Within the demo workspace"),
            metric("Applications received", summary.pendingMembershipApplications, "▤", "Fictional applicants"),
            metric("Groups in district", groups.filter((group) => group.district === firstGroup.district).length, "⌖", "Example district count"),
          ]} />
          <DemoDataTable
            title="Member directory"
            description="Searchable sample roster; the data is not connected to member accounts."
            rows={roster}
            columns={rosterColumns}
            searchPlaceholder="Search names or groups"
          />
        </PageSection>
        <PageSection id="applications">
          <div className="demo-action-notice">
            <span aria-hidden="true">⌁</span>
            <div><strong>Review authority depends on server-verified delegation</strong><p>This static preview cannot validate officer tenure or perform membership decisions.</p></div>
          </div>
          <DemoDataTable
            title="Membership applications"
            description="Sample intake list shared across the demo groups."
            rows={membershipApplications}
            columns={applicationColumns}
            searchPlaceholder="Search applicants or group"
            filterOptions={[{ value: "PENDING_REVIEW", label: "Pending review" }]}
            filterKey="status"
          />
        </PageSection>
        <PageSection id="groups">
          <DemoDataTable
            title="Group roster"
            description="At-a-glance contact and membership counts."
            rows={groups}
            columns={[
              { key: "groupName", label: "Group" },
              { key: "presidentName", label: "President" },
              { key: "memberCount", label: "Members" },
              { key: "district", label: "District" },
            ]}
            searchPlaceholder="Search group names"
          />
        </PageSection>
      </>
    )
  }

  const contributionColumns = [
    { key: "memberName", label: "Member" },
    { key: "groupCode", label: "Group reference" },
    { key: "date", label: "Date", render: (row) => <DateCell value={row.date} /> },
    { key: "amountMinor", label: "Amount", render: (row) => <CurrencyCell value={row.amountMinor} /> },
    { key: "status", label: "Status", render: (row) => <StatusCell status={row.status} /> },
  ]
  const financialRows = [
    ...snapshot.repayments.map((repayment) => ({
      id: repayment.id,
      member: repayment.borrower,
      groupCode: repayment.groupCode,
      date: repayment.date,
      amountMinor: repayment.amountMinor,
      kind: "Repayment",
      status: repayment.status,
    })),
    ...snapshot.contributions.map((contribution) => ({
      id: contribution.id,
      member: contribution.memberName,
      groupCode: contribution.groupCode,
      date: contribution.date,
      amountMinor: contribution.amountMinor,
      kind: "Contribution",
      status: contribution.status,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const financeColumns = [
    { key: "member", label: "Member" },
    { key: "kind", label: "Record type" },
    { key: "groupCode", label: "Group reference" },
    { key: "date", label: "Date", render: (row) => <DateCell value={row.date} /> },
    { key: "amountMinor", label: "Amount", render: (row) => <CurrencyCell value={row.amountMinor} /> },
    { key: "status", label: "Status", render: (row) => <StatusCell status={row.status} /> },
  ]
  const loanColumns = [
    { key: "borrower", label: "Borrower" },
    { key: "outstandingMinor", label: "Outstanding", render: (row) => <CurrencyCell value={row.outstandingMinor} /> },
    { key: "overdueMinor", label: "Overdue", render: (row) => <CurrencyCell value={row.overdueMinor} /> },
    { key: "nextDue", label: "Next due", render: (row) => <DateCell value={row.nextDue} /> },
    { key: "status", label: "Status", render: (row) => <StatusCell status={row.status} /> },
  ]
  return (
    <>
      <PageSection id="finance">
        <DemoMetricGrid metrics={[
          metric("Savings balances", summary.savingsBalanceMinor, "◈", "Across demo groups", "currency"),
          metric("Contributions this month", summary.monthlyContributionsMinor, "＋", "Reconciles to sample records", "currency"),
          metric("Outstanding loans", summary.outstandingLoansMinor, "↗", "Illustrative principal balance", "currency"),
          metric("Overdue amount", summary.overdueRepaymentsMinor, "!", "Sample amount only", "currency"),
        ]} />
        <DemoSavingsChart data={snapshot.savingsTrend} title="Savings under stewardship" />
      </PageSection>
      <PageSection id="contributions">
        <div className="demo-action-notice">
          <span aria-hidden="true">◈</span>
          <div><strong>Financial posting is unavailable</strong><p>These are static examples, not ledger entries or receipts. No contribution, withdrawal, or repayment can be recorded here.</p></div>
        </div>
        <DemoDataTable
          title="Contributions"
          description="Illustrative monthly records; amounts use integer paise in the data source."
          rows={snapshot.contributions}
          columns={contributionColumns}
          searchPlaceholder="Search member or group"
        />
      </PageSection>
      <PageSection id="loans">
        <DemoDataTable
          title="Loans and repayments"
          description="Loan monitoring only; this view does not authorize or disburse funds."
          rows={activeLoans}
          columns={loanColumns}
          searchPlaceholder="Search borrowers"
          filterOptions={[
            { value: "ON_TRACK", label: "On track" },
            { value: "PAYMENT_DUE", label: "Payment due" },
          ]}
          filterKey="status"
        />
        <DemoDataTable
          title="Recent financial records"
          description="Repayments and contributions are listed separately and are all marked demo."
          rows={financialRows}
          columns={financeColumns}
          searchPlaceholder="Search financial records"
        />
      </PageSection>
    </>
  )
}

function DashboardDemoPage({ role }) {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState("")
  const [activeSection, setActiveSection] = useState(
    window.location.hash.slice(1) || navigationByRole[role][0].id
  )

  useEffect(() => {
    let active = true
    dashboardDataService.getDashboardSnapshot(role).then(
      (result) => {
        if (active) setSnapshot(result)
      },
      (loadError) => {
        if (active) setError(loadError.message || "Unable to load demo dashboard data.")
      }
    )
    return () => { active = false }
  }, [role])

  useEffect(() => {
    const updateActiveSection = () => {
      setActiveSection(window.location.hash.slice(1) || navigationByRole[role][0].id)
    }
    window.addEventListener("hashchange", updateActiveSection)
    return () => window.removeEventListener("hashchange", updateActiveSection)
  }, [role])

  if (error) {
    return <main className="demo-load-error" role="alert">{error}</main>
  }
  if (!snapshot) {
    return <main className="demo-load-state" aria-live="polite">Loading static dashboard preview…</main>
  }

  const activityItems = snapshot.activity.filter((item) => {
    if (role === "PRESIDENT") return item.groupCode === snapshot.groups[0].groupCode
    if (role === "SECRETARY") return item.kind === "MEMBERSHIP" || item.kind === "LOAN_APPLICATION"
    if (role === "TREASURER") return item.kind === "CONTRIBUTION" || item.kind === "REPAYMENT"
    return true
  })

  return (
    <DemoDashboardFrame
      role={role}
      navigation={navigationByRole[role]}
      activeSection={activeSection}
    >
      <RoleDashboardContent snapshot={snapshot} role={role} />
      <PageSection id="activity">
        <DemoActivityFeed items={activityItems} />
      </PageSection>
      <DemoNotificationList items={snapshot.notifications} />
    </DemoDashboardFrame>
  )
}

export default DashboardDemoPage
