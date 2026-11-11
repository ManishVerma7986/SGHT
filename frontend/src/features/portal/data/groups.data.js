import { demoDashboardData } from "../../dashboard/data/demo-dashboard-data.js"

export const demoGroups = Object.freeze(demoDashboardData.groups.map((group) => ({
  ...group,
  groupCode: group.groupCode,
  openingBalanceMinor: group.savingsBalanceMinor - group.monthlyContributionsMinor,
  village: `${group.district} Community`,
  state: "Illustrative state",
  createdOn: group.members[0]?.joinedOn,
})))
