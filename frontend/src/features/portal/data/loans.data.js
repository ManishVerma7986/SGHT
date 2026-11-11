import { demoDashboardData } from "../../dashboard/data/demo-dashboard-data.js"

export const demoLoans = Object.freeze(demoDashboardData.activeLoans.map((loan) => ({
  ...loan,
  principalRepaidMinor: loan.principalMinor - loan.outstandingMinor,
  interestMinor: null,
  schedule: Object.freeze([{ dueOn: loan.nextDue, status: loan.status }]),
  termsAvailable: false,
})))

export const demoLoanApplications = Object.freeze(demoDashboardData.loanApplications)
