import { demoContributions } from "./savings.data.js"
import { demoRepayments } from "./repayments.data.js"

export const demoTransactions = Object.freeze([
  ...demoContributions.map((contribution) => ({
    id: contribution.id,
    date: contribution.date,
    groupCode: contribution.groupCode,
    person: contribution.memberName,
    category: "Contribution",
    amountMinor: contribution.amountMinor,
    eventType: "Contribution sample",
    status: "DEMO",
    direction: "Contribution recorded in demo data",
  })),
  ...demoRepayments.map((repayment) => ({
    id: repayment.id,
    date: repayment.date,
    groupCode: repayment.groupCode,
    person: repayment.borrower,
    category: "Repayment",
    amountMinor: repayment.amountMinor,
    eventType: "Repayment sample",
    status: "DEMO",
    direction: "Repayment listed in demo data",
  })),
].sort((a, b) => b.date.localeCompare(a.date)))
