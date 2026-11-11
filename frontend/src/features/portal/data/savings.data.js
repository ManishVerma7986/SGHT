import { demoDashboardData } from "../../dashboard/data/demo-dashboard-data.js"

export const demoContributions = Object.freeze(demoDashboardData.contributions.map((contribution) => ({
  ...contribution,
  category: "Member contribution",
  reference: contribution.id,
})))

export const demoWithdrawals = Object.freeze([
  {
    id: "DEMO-W-901",
    groupCode: "SHG-NORTH-014",
    requester: "Lata Nair",
    amountMinor: 25000,
    submittedOn: "2026-11-03",
    status: "PENDING_REVIEW",
    note: "Illustrative request only; no money was paid.",
  },
  {
    id: "DEMO-W-902",
    groupCode: "SHG-CENTRAL-027",
    requester: "Pooja Menon",
    amountMinor: 15000,
    submittedOn: "2026-10-28",
    status: "WITHDRAWN",
    note: "Illustrative history only; no money was paid.",
  },
])
