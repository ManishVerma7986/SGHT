import { demoGroups } from "./groups.data.js"
import { demoMemberships, demoMembershipApplications } from "./memberships.data.js"
import { demoContributions, demoWithdrawals } from "./savings.data.js"
import { demoLoans, demoLoanApplications } from "./loans.data.js"
import { demoRepayments, demoUpcomingRepayments } from "./repayments.data.js"
import { demoTransactions } from "./transactions.data.js"
import { demoNotifications } from "./notifications.data.js"
import { getDemoReportSummary } from "./reports.data.js"
import { demoDashboardData, getDemoDashboardSnapshot } from "../../dashboard/data/demo-dashboard-data.js"

export const portalModuleNames = Object.freeze([
  "groups",
  "membership",
  "savings",
  "loans",
  "repayments",
  "transactions",
  "notifications",
  "reports",
])

export function getPortalModuleData(moduleName, role) {
  if (!portalModuleNames.includes(moduleName)) {
    throw new TypeError("Unsupported SHGT demo workspace module.")
  }
  if (!["MEMBER", "PRESIDENT", "SECRETARY", "TREASURER", "PLATFORM_ADMIN"].includes(role)) {
    throw new TypeError("Unsupported SHGT demo workspace role.")
  }

  const snapshot = {
    groups: demoGroups,
    memberships: demoMemberships,
    membershipApplications: demoMembershipApplications,
    contributions: demoContributions,
    withdrawals: demoWithdrawals,
    savingsTrend: demoDashboardData.savingsTrend,
    loans: demoLoans,
    loanApplications: demoLoanApplications,
    repayments: demoRepayments,
    upcomingRepayments: demoUpcomingRepayments,
    transactions: demoTransactions,
    notifications: demoNotifications,
    reports: getDemoReportSummary(),
    demoOnly: true,
  }

  const scopedGroupCode = role === "MEMBER" || role === "PRESIDENT"
    ? "SHG-NORTH-014"
    : null
  const withinGroup = (record) =>
    !scopedGroupCode || record.groupCode === scopedGroupCode
  const memberOnly = role === "MEMBER"
  const scoped = {
    ...snapshot,
    groups: snapshot.groups.filter((group) => !scopedGroupCode || group.groupCode === scopedGroupCode),
    memberships: snapshot.memberships.filter((member) =>
      withinGroup(member) && (!memberOnly || member.name === "Lata Nair")
    ),
    membershipApplications: snapshot.membershipApplications.filter((application) =>
      withinGroup(application) && !memberOnly
    ),
    contributions: snapshot.contributions.filter((record) =>
      withinGroup(record) && (!memberOnly || record.memberName === "Lata Nair")
    ),
    withdrawals: snapshot.withdrawals.filter((record) =>
      withinGroup(record) && (!memberOnly || record.requester === "Lata Nair")
    ),
    loans: snapshot.loans.filter((loan) => withinGroup(loan) && !memberOnly),
    loanApplications: snapshot.loanApplications.filter((application) =>
      withinGroup(application) && !memberOnly
    ),
    repayments: snapshot.repayments.filter((repayment) =>
      withinGroup(repayment) && (!memberOnly || repayment.borrower === "Lata Nair")
    ),
    upcomingRepayments: snapshot.upcomingRepayments.filter((repayment) =>
      withinGroup(repayment) && (!memberOnly || repayment.borrower === "Lata Nair")
    ),
    transactions: snapshot.transactions.filter((transaction) =>
      withinGroup(transaction) && (!memberOnly || transaction.person === "Lata Nair")
    ),
    savingsTrend: scopedGroupCode
      ? getDemoDashboardSnapshot("PRESIDENT").groupSavingsTrends[scopedGroupCode]
      : snapshot.savingsTrend,
    reports: scopedGroupCode
      ? {
          ...snapshot.reports,
          groupCount: 1,
          memberCount: snapshot.groups.find((group) => group.groupCode === scopedGroupCode).memberCount,
          savingsBalanceMinor: snapshot.groups.find((group) => group.groupCode === scopedGroupCode).savingsBalanceMinor,
          monthlyContributionsMinor: snapshot.groups.find((group) => group.groupCode === scopedGroupCode).monthlyContributionsMinor,
          outstandingLoansMinor: memberOnly ? 0 : snapshot.loans.filter(withinGroup).reduce((total, loan) => total + loan.outstandingMinor, 0),
          repaymentsMinor: memberOnly ? 0 : snapshot.repayments.filter(withinGroup).reduce((total, repayment) => total + repayment.amountMinor, 0),
        }
      : snapshot.reports,
  }
  if (role === "SECRETARY") {
    scoped.loans = []
    scoped.loanApplications = []
    scoped.contributions = []
    scoped.withdrawals = []
    scoped.repayments = []
    scoped.upcomingRepayments = []
    scoped.transactions = []
    scoped.reports = {
      groupCount: scoped.groups.length,
      memberCount: scoped.memberships.length,
      savingsBalanceMinor: 0,
      monthlyContributionsMinor: 0,
      outstandingLoansMinor: 0,
      repaymentsMinor: 0,
    }
  }
  return Object.freeze({ moduleName, ...scoped })
}

export { getDemoDashboardSnapshot }
