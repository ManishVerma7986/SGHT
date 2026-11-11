import test from "node:test"
import assert from "node:assert/strict"

import {
  demoDashboardData,
  getDemoDashboardSnapshot,
} from "../src/features/dashboard/data/demo-dashboard-data.js"
import { createDashboardDataService } from "../src/features/dashboard/services/dashboard-data.service.js"

const roles = ["PLATFORM_ADMIN", "PRESIDENT", "SECRETARY", "TREASURER"]

test("provides explicitly demo-only snapshots for supported dashboard roles", async () => {
  const service = createDashboardDataService()

  for (const role of roles) {
    const snapshot = await service.getDashboardSnapshot(role)
    assert.equal(snapshot.role, role)
    assert.equal(snapshot.demoOnly, true)
    assert.ok(Array.isArray(snapshot.groups))
    assert.ok(snapshot.summary)
  }
})

test("rejects unsupported roles before querying the provider", async () => {
  let providerCalls = 0
  const service = createDashboardDataService({
    provider: {
      getDashboardSnapshot: async () => {
        providerCalls += 1
        return null
      },
    },
  })

  await assert.rejects(service.getDashboardSnapshot("LOAN_OFFICER"), TypeError)
  assert.equal(providerCalls, 0)
})

test("rejects invalid provider snapshots instead of returning success-shaped data", async () => {
  const service = createDashboardDataService({
    provider: { getDashboardSnapshot: async () => ({}) },
  })

  await assert.rejects(
    service.getDashboardSnapshot("PRESIDENT"),
    /invalid snapshot/
  )
})

test("dashboard summary totals reconcile with the displayed demo records", () => {
  const snapshot = getDemoDashboardSnapshot("TREASURER")
  const sum = (records, field) =>
    records.reduce((total, record) => total + record[field], 0)

  assert.equal(
    snapshot.summary.savingsBalanceMinor,
    sum(snapshot.groups, "savingsBalanceMinor")
  )
  assert.equal(
    snapshot.summary.monthlyContributionsMinor,
    sum(snapshot.groups, "monthlyContributionsMinor")
  )
  assert.equal(
    snapshot.summary.monthlyContributionsMinor,
    sum(snapshot.contributions, "amountMinor")
  )
  assert.equal(
    snapshot.summary.outstandingLoansMinor,
    sum(snapshot.activeLoans, "outstandingMinor")
  )
  assert.equal(
    snapshot.summary.overdueRepaymentsMinor,
    sum(snapshot.activeLoans, "overdueMinor")
  )
  assert.equal(
    snapshot.summary.recentRepaymentsMinor,
    sum(snapshot.repayments, "amountMinor")
  )
  assert.equal(
    snapshot.summary.pendingGroupApplications,
    snapshot.groupApplications.filter((application) => application.status === "PENDING_REVIEW").length
  )
  assert.equal(
    snapshot.savingsTrend.at(-1).amountMinor,
    snapshot.summary.savingsBalanceMinor
  )

  for (const group of snapshot.groups) {
    const recordedContributions = snapshot.contributions
      .filter((record) => record.groupCode === group.groupCode)
      .reduce((total, record) => total + record.amountMinor, 0)
    assert.equal(recordedContributions, group.monthlyContributionsMinor)
    assert.equal(
      snapshot.groupSavingsTrends[group.groupCode].at(-1).amountMinor,
      group.savingsBalanceMinor
    )
  }

  for (const record of [
    ...demoDashboardData.contributions,
    ...demoDashboardData.activeLoans,
    ...demoDashboardData.repayments,
  ]) {
    for (const value of Object.values(record)) {
      if (typeof value === "number") assert.ok(Number.isSafeInteger(value))
    }
  }
})

test("default data builder rejects unsupported roles", () => {
  assert.throws(() => getDemoDashboardSnapshot("MEMBER"), TypeError)
})
