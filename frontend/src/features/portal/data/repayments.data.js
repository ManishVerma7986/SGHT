import { demoDashboardData } from "../../dashboard/data/demo-dashboard-data.js"

export const demoRepayments = Object.freeze(demoDashboardData.repayments.map((repayment) => ({
  ...repayment,
  paymentStatus: "DEMO_ONLY",
  receivedMinor: null,
})))

export const demoUpcomingRepayments = Object.freeze(demoDashboardData.activeLoans.map((loan) => ({
  id: `${loan.id}-DUE`,
  loanId: loan.id,
  borrower: loan.borrower,
  groupCode: loan.groupCode,
  dueOn: loan.nextDue,
  overdueMinor: loan.overdueMinor,
  status: loan.status,
  amountDueMinor: null,
})))
