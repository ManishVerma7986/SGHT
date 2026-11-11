const groups = Object.freeze([
  Object.freeze({
    groupCode: "SHG-NORTH-014",
    groupName: "Sahaya Women’s Group",
    district: "North District",
    status: "ACTIVE",
    memberCount: 18,
    savingsBalanceMinor: 1845000,
    monthlyContributionsMinor: 250000,
    presidentName: "Anita Rao",
    members: Object.freeze([
      { name: "Anita Rao", role: "PRESIDENT", joinedOn: "2022-04-12" },
      { name: "Meera Shah", role: "SECRETARY", joinedOn: "2022-04-12" },
      { name: "Kavita Das", role: "TREASURER", joinedOn: "2022-04-12" },
      { name: "Lata Nair", role: "MEMBER", joinedOn: "2022-06-03" },
      { name: "Farah Khan", role: "MEMBER", joinedOn: "2022-07-18" },
    ]),
  }),
  Object.freeze({
    groupCode: "SHG-CENTRAL-027",
    groupName: "New Dawn Collective",
    district: "Central District",
    status: "ACTIVE",
    memberCount: 15,
    savingsBalanceMinor: 1282000,
    monthlyContributionsMinor: 220000,
    presidentName: "Sunita Patel",
    members: Object.freeze([
      { name: "Sunita Patel", role: "PRESIDENT", joinedOn: "2023-02-08" },
      { name: "Rupa Iyer", role: "SECRETARY", joinedOn: "2023-02-08" },
      { name: "Nisha Roy", role: "TREASURER", joinedOn: "2023-02-08" },
      { name: "Pooja Menon", role: "MEMBER", joinedOn: "2023-03-20" },
      { name: "Asha Reddy", role: "MEMBER", joinedOn: "2023-05-01" },
    ]),
  }),
  Object.freeze({
    groupCode: "SHG-EAST-031",
    groupName: "Udaan Community Fund",
    district: "East District",
    status: "ACTIVE",
    memberCount: 12,
    savingsBalanceMinor: 965000,
    monthlyContributionsMinor: 150000,
    presidentName: "Leela Joseph",
    members: Object.freeze([
      { name: "Leela Joseph", role: "PRESIDENT", joinedOn: "2023-08-16" },
      { name: "Rekha Sen", role: "SECRETARY", joinedOn: "2023-08-16" },
      { name: "Maya Paul", role: "TREASURER", joinedOn: "2023-08-16" },
      { name: "Saira Ali", role: "MEMBER", joinedOn: "2023-09-10" },
      { name: "Tara Bose", role: "MEMBER", joinedOn: "2023-10-04" },
    ]),
  }),
])

const contributions = Object.freeze([
  { id: "DEMO-C-101", memberName: "Lata Nair", groupCode: "SHG-NORTH-014", amountMinor: 120000, date: "2026-11-10", status: "DEMO" },
  { id: "DEMO-C-102", memberName: "Farah Khan", groupCode: "SHG-NORTH-014", amountMinor: 130000, date: "2026-11-09", status: "DEMO" },
  { id: "DEMO-C-103", memberName: "Pooja Menon", groupCode: "SHG-CENTRAL-027", amountMinor: 115000, date: "2026-11-08", status: "DEMO" },
  { id: "DEMO-C-104", memberName: "Asha Reddy", groupCode: "SHG-CENTRAL-027", amountMinor: 105000, date: "2026-11-07", status: "DEMO" },
  { id: "DEMO-C-105", memberName: "Saira Ali", groupCode: "SHG-EAST-031", amountMinor: 100000, date: "2026-11-06", status: "DEMO" },
  { id: "DEMO-C-106", memberName: "Tara Bose", groupCode: "SHG-EAST-031", amountMinor: 50000, date: "2026-11-05", status: "DEMO" },
])

const activeLoans = Object.freeze([
  { id: "DEMO-L-201", borrower: "Rupa Iyer", groupCode: "SHG-NORTH-014", principalMinor: 3000000, outstandingMinor: 2500000, overdueMinor: 0, nextDue: "2026-11-20", status: "ON_TRACK" },
  { id: "DEMO-L-202", borrower: "Pooja Menon", groupCode: "SHG-CENTRAL-027", principalMinor: 2400000, outstandingMinor: 1800000, overdueMinor: 25000, nextDue: "2026-11-12", status: "PAYMENT_DUE" },
  { id: "DEMO-L-203", borrower: "Maya Paul", groupCode: "SHG-EAST-031", principalMinor: 1500000, outstandingMinor: 1200000, overdueMinor: 0, nextDue: "2026-11-25", status: "ON_TRACK" },
])

const loanApplications = Object.freeze([
  { id: "DEMO-A-301", applicant: "Meera Shah", groupCode: "SHG-NORTH-014", requestedMinor: 750000, submittedOn: "2026-11-09", status: "PENDING_REVIEW" },
  { id: "DEMO-A-302", applicant: "Saira Ali", groupCode: "SHG-EAST-031", requestedMinor: 500000, submittedOn: "2026-11-07", status: "PENDING_REVIEW" },
])

const repayments = Object.freeze([
  { id: "DEMO-R-401", borrower: "Rupa Iyer", groupCode: "SHG-NORTH-014", amountMinor: 100000, date: "2026-11-10", status: "DEMO" },
  { id: "DEMO-R-402", borrower: "Pooja Menon", groupCode: "SHG-CENTRAL-027", amountMinor: 85000, date: "2026-11-09", status: "DEMO" },
  { id: "DEMO-R-403", borrower: "Maya Paul", groupCode: "SHG-EAST-031", amountMinor: 75000, date: "2026-11-08", status: "DEMO" },
  { id: "DEMO-R-404", borrower: "Leela Joseph", groupCode: "SHG-EAST-031", amountMinor: 90000, date: "2026-11-06", status: "DEMO" },
])

const membershipApplications = Object.freeze([
  { id: "DEMO-M-501", applicant: "Zoya Fernandes", groupCode: "SHG-NORTH-014", submittedOn: "2026-11-10", status: "PENDING_REVIEW" },
  { id: "DEMO-M-502", applicant: "Isha Kulkarni", groupCode: "SHG-CENTRAL-027", submittedOn: "2026-11-08", status: "PENDING_REVIEW" },
  { id: "DEMO-M-503", applicant: "Neha Thomas", groupCode: "SHG-EAST-031", submittedOn: "2026-11-05", status: "PENDING_REVIEW" },
])

const groupApplications = Object.freeze([
  { id: "DEMO-G-601", groupName: "Greenfield Savings Circle", district: "West District", submittedOn: "2026-11-10", status: "PENDING_REVIEW" },
  { id: "DEMO-G-602", groupName: "Rising Stars Collective", district: "South District", submittedOn: "2026-11-08", status: "PENDING_REVIEW" },
  { id: "DEMO-G-603", groupName: "Harbor Light Circle", district: "Coastal District", submittedOn: "2026-11-02", status: "REJECTED" },
])

const activity = Object.freeze([
  { id: "DEMO-E-701", title: "Contribution recorded (demo)", detail: "Sahaya Women’s Group · Lata Nair", groupCode: "SHG-NORTH-014", date: "2026-11-10", amountMinor: 120000, kind: "CONTRIBUTION" },
  { id: "DEMO-E-702", title: "Repayment recorded (demo)", detail: "New Dawn Collective · Pooja Menon", groupCode: "SHG-CENTRAL-027", date: "2026-11-09", amountMinor: 85000, kind: "REPAYMENT" },
  { id: "DEMO-E-703", title: "Membership application received", detail: "Sahaya Women’s Group · Zoya Fernandes", groupCode: "SHG-NORTH-014", date: "2026-11-10", amountMinor: null, kind: "MEMBERSHIP" },
  { id: "DEMO-E-704", title: "Loan application received", detail: "Udaan Community Fund · Saira Ali", groupCode: "SHG-EAST-031", date: "2026-11-07", amountMinor: null, kind: "LOAN_APPLICATION" },
])

const notifications = Object.freeze([
  { id: "DEMO-N-801", title: "Membership queue", detail: "Three sample applications await review.", tone: "info" },
  { id: "DEMO-N-802", title: "Repayment reminder", detail: "One sample loan has an overdue amount.", tone: "warning" },
  { id: "DEMO-N-803", title: "Demo data", detail: "All dashboard figures are illustrative only.", tone: "neutral" },
])

const savingsTrend = Object.freeze([
  { month: "Jun", amountMinor: 3050000 },
  { month: "Jul", amountMinor: 3250000 },
  { month: "Aug", amountMinor: 3430000 },
  { month: "Sep", amountMinor: 3650000 },
  { month: "Oct", amountMinor: 3870000 },
  { month: "Nov", amountMinor: 4092000 },
])

export const demoDashboardData = Object.freeze({
  groups,
  contributions,
  activeLoans,
  loanApplications,
  repayments,
  membershipApplications,
  groupApplications,
  activity,
  notifications,
  savingsTrend,
})

const supportedDashboardRoles = new Set([
  "PLATFORM_ADMIN",
  "PRESIDENT",
  "SECRETARY",
  "TREASURER",
])

function sum(items, field) {
  return items.reduce((total, item) => total + item[field], 0)
}

function createSummary() {
  return {
    activeGroups: groups.filter((group) => group.status === "ACTIVE").length,
    activeMemberships: sum(groups, "memberCount"),
    savingsBalanceMinor: sum(groups, "savingsBalanceMinor"),
    monthlyContributionsMinor: sum(groups, "monthlyContributionsMinor"),
    outstandingLoansMinor: sum(activeLoans, "outstandingMinor"),
    overdueRepaymentsMinor: sum(activeLoans, "overdueMinor"),
    pendingLoanApplications: loanApplications.length,
    pendingMembershipApplications: membershipApplications.length,
    pendingGroupApplications: groupApplications.filter((application) => application.status === "PENDING_REVIEW").length,
    recentContributionsMinor: sum(contributions, "amountMinor"),
    recentRepaymentsMinor: sum(repayments, "amountMinor"),
  }
}

function createGroupSavingsTrends() {
  const totalSavings = sum(groups, "savingsBalanceMinor")
  return Object.fromEntries(groups.map((group) => [
    group.groupCode,
    savingsTrend.map((point) => ({
      month: point.month,
      amountMinor: Math.round(
        (group.savingsBalanceMinor * point.amountMinor) / totalSavings
      ),
    })),
  ]))
}

export function getDemoDashboardSnapshot(role) {
  if (!supportedDashboardRoles.has(role)) {
    throw new TypeError("Unsupported SHGT dashboard role.")
  }

  return {
    role,
    generatedAt: "2026-11-11T09:00:00.000Z",
    summary: createSummary(),
    groups,
    contributions,
    activeLoans,
    loanApplications,
    repayments,
    membershipApplications,
    groupApplications,
    activity,
    notifications,
    savingsTrend,
    groupSavingsTrends: createGroupSavingsTrends(),
    demoOnly: true,
  }
}
