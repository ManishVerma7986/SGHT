import { getDemoDashboardSnapshot } from "../data/demo-dashboard-data.js"

const dashboardRoles = new Set([
  "PLATFORM_ADMIN",
  "PRESIDENT",
  "SECRETARY",
  "TREASURER",
])

export function createDashboardDataService({
  provider = {
    getDashboardSnapshot: async (role) => getDemoDashboardSnapshot(role),
  },
} = {}) {
  if (!provider || typeof provider.getDashboardSnapshot !== "function") {
    throw new TypeError("A dashboard data provider is required.")
  }

  async function getDashboardSnapshot(role) {
    if (!dashboardRoles.has(role)) {
      throw new TypeError("Unsupported SHGT dashboard role.")
    }

    const snapshot = await provider.getDashboardSnapshot(role)
    if (
      !snapshot ||
      snapshot.role !== role ||
      snapshot.demoOnly !== true ||
      !snapshot.summary ||
      !Array.isArray(snapshot.groups)
    ) {
      throw new Error("Dashboard provider returned an invalid snapshot.")
    }
    return snapshot
  }

  return Object.freeze({ getDashboardSnapshot })
}

export const dashboardDataService = createDashboardDataService()
