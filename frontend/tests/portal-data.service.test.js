import test from "node:test"
import assert from "node:assert/strict"

import { getPortalModuleData } from "../src/features/portal/data/portal-demo-data.js"
import { createPortalDataService } from "../src/features/portal/services/portal-data.service.js"
import { toCsv } from "../src/features/portal/utils/portal-format.js"

const roles = ["MEMBER", "PRESIDENT", "SECRETARY", "TREASURER", "PLATFORM_ADMIN"]
const modules = ["groups", "membership", "savings", "loans", "repayments", "transactions", "notifications", "reports"]

test("provides demo-only snapshots for modules each role is allowed to view", async () => {
  const service = createPortalDataService()
  for (const role of roles) {
    for (const moduleName of service.getAvailableModules(role)) {
      const snapshot = await service.getModuleSnapshot(role, moduleName)
      assert.equal(snapshot.demoOnly, true)
      assert.equal(snapshot.moduleName, moduleName)
    }
  }
})

test("rejects unknown modules, unsupported roles, and disallowed role-module pairs", async () => {
  const service = createPortalDataService()
  await assert.rejects(service.getModuleSnapshot("MEMBER", "admin"), TypeError)
  await assert.rejects(service.getModuleSnapshot("LOAN_OFFICER", "loans"), TypeError)
  await assert.rejects(service.getModuleSnapshot("SECRETARY", "transactions"), TypeError)
  assert.throws(() => getPortalModuleData("transactions", "LOAN_OFFICER"), TypeError)
  assert.ok(modules.length > 0)
})

test("demo contributions and balances reconcile by group", () => {
  const snapshot = getPortalModuleData("savings", "PLATFORM_ADMIN")
  for (const group of snapshot.groups) {
    const listedContributions = snapshot.contributions
      .filter((record) => record.groupCode === group.groupCode)
      .reduce((total, record) => total + record.amountMinor, 0)
    assert.equal(listedContributions, group.monthlyContributionsMinor)
    assert.equal(
      group.openingBalanceMinor + listedContributions,
      group.savingsBalanceMinor
    )
    const trend = getPortalModuleData("reports", "PRESIDENT").savingsTrend
    assert.ok(trend.every((point) => Number.isSafeInteger(point.amountMinor)))
  }
})

test("loan principal, outstanding, repayments, and event totals remain integer-minor-unit data", () => {
  const loans = getPortalModuleData("loans", "PLATFORM_ADMIN").loans
  for (const loan of loans) {
    assert.equal(loan.principalMinor - loan.principalRepaidMinor, loan.outstandingMinor)
    assert.equal(loan.termsAvailable, false)
  }

  const snapshot = getPortalModuleData("transactions", "PLATFORM_ADMIN")
  const listedRepayments = snapshot.transactions
    .filter((transaction) => transaction.category === "Repayment")
    .reduce((total, transaction) => total + transaction.amountMinor, 0)
  const repaymentHistory = snapshot.repayments
    .reduce((total, repayment) => total + repayment.amountMinor, 0)
  assert.equal(listedRepayments, repaymentHistory)
  for (const transaction of snapshot.transactions) {
    assert.ok(Number.isSafeInteger(transaction.amountMinor))
  }
})

test("member demo scope is limited and does not invent a linked loan or repayment", () => {
  const groups = getPortalModuleData("groups", "MEMBER")
  const membership = getPortalModuleData("membership", "MEMBER")
  const loans = getPortalModuleData("loans", "MEMBER")
  const repayments = getPortalModuleData("repayments", "MEMBER")
  assert.deepEqual(groups.groups.map((group) => group.groupCode), ["SHG-NORTH-014"])
  assert.deepEqual(membership.memberships.map((record) => record.name), ["Lata Nair"])
  assert.deepEqual(loans.loans, [])
  assert.deepEqual(repayments.repayments, [])
})

test("secretary report scope excludes financial records", () => {
  const snapshot = getPortalModuleData("reports", "SECRETARY")
  assert.deepEqual(snapshot.loans, [])
  assert.deepEqual(snapshot.transactions, [])
  assert.equal(snapshot.reports.savingsBalanceMinor, 0)
})

test("CSV escaping prevents formula injection and quotes delimiters", () => {
  assert.equal(
    toCsv([{ name: "=HYPERLINK(\"bad\")", value: -1200 }], [
      { key: "name", label: "Name" },
      { key: "value", label: "Minor units" },
    ]),
    '"Name","Minor units"\r\n"\'=HYPERLINK(""bad"")","-1200"'
  )
})
