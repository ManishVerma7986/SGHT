import { demoDashboardData } from "../../dashboard/data/demo-dashboard-data.js"

export const demoMemberships = Object.freeze(demoDashboardData.groups.flatMap((group) =>
  group.members.map((member, index) => ({
    id: `${group.groupCode}-MEM-${index + 1}`,
    name: member.name,
    role: member.role,
    groupCode: group.groupCode,
    groupName: group.groupName,
    membershipStatus: "ACTIVE",
    joinedOn: member.joinedOn,
  }))
))

export const demoMembershipApplications = Object.freeze(demoDashboardData.membershipApplications)
