import { demoDashboardData } from "../../dashboard/data/demo-dashboard-data.js"

export const demoNotifications = Object.freeze(demoDashboardData.notifications.map((item, index) => ({
  ...item,
  category: index === 0 ? "Membership" : index === 1 ? "Repayments" : "System",
  date: ["2026-11-10", "2026-11-09", "2026-11-08"][index],
  read: index === 2,
  href: index === 0 ? "membership" : index === 1 ? "repayments" : "notifications",
})))
