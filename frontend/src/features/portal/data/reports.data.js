import { demoDashboardData } from "../../dashboard/data/demo-dashboard-data.js"

export function getDemoReportSummary() {
  const sum = (records, field) =>
    records.reduce((total, record) => total + record[field], 0)
  return Object.freeze({
    groupCount: demoDashboardData.groups.length,
    memberCount: sum(demoDashboardData.groups, "memberCount"),
    savingsBalanceMinor: sum(demoDashboardData.groups, "savingsBalanceMinor"),
    monthlyContributionsMinor: sum(demoDashboardData.contributions, "amountMinor"),
    outstandingLoansMinor: sum(demoDashboardData.activeLoans, "outstandingMinor"),
    repaymentsMinor: sum(demoDashboardData.repayments, "amountMinor"),
  })
}
