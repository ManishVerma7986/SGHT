import test from "node:test"
import assert from "node:assert/strict"

import { createPortalApiProvider } from "../src/features/portal/services/portal-api.provider.js"
import {
  normalizePortalError,
  PortalWorkflowUnavailableError,
} from "../src/features/portal/services/portal-data.error.js"
import {
  createPortalDataService,
  createPortalDemoProvider,
} from "../src/features/portal/services/portal-data.service.js"

const groupMemberships = {
  success: true,
  groups: [{
    groupId: 7,
    groupCode: "SHG-7",
    groupName: "Example Group",
    memberRole: "MEMBER",
    membershipStatus: "ACTIVE",
  }],
}

function providerWithResponses(responses) {
  const calls = []
  const provider = createPortalApiProvider({
    apiRequest: async (path, options) => {
      calls.push({ path, options })
      const response = responses[path]
      if (response instanceof Error) throw response
      return response
    },
  })
  return { provider, calls }
}

test("API provider loads and validates the authenticated member's group resources", async () => {
  const { provider, calls } = providerWithResponses({
    "/api/v1/groups/mine": groupMemberships,
    "/api/v1/group-workflow/requests/mine": {
      success: true,
      requests: [{
        requestId: "a".repeat(32),
        status: "PENDING",
        payload: { groupName: "Requested Group" },
      }],
    },
  })
  const controller = new AbortController()
  const snapshot = await provider.getPortalSnapshot("groups", "MEMBER", {
    token: "verified-access-token",
    signal: controller.signal,
  })

  assert.equal(snapshot.mode, "api")
  assert.equal(snapshot.demoOnly, false)
  assert.deepEqual(snapshot.resources.groups.records[0], {
    id: 7,
    groupId: 7,
    groupCode: "SHG-7",
    groupName: "Example Group",
    role: "MEMBER",
    status: "ACTIVE",
  })
  assert.equal(snapshot.resources.requests.records[0].groupName, "Requested Group")
  assert.equal(calls.length, 2)
  assert.ok(calls.every(({ options }) => options.token === "verified-access-token"))
  assert.ok(calls.every(({ options }) => options.signal === controller.signal))
})

test("membership API results are scoped to current memberships and own request references", async () => {
  const { provider } = providerWithResponses({
    "/api/v1/groups/mine": groupMemberships,
    "/api/v1/group-workflow/membership-requests/mine": {
      success: true,
      requests: [{
        requestId: "b".repeat(32),
        groupCode: "SHG-8",
        status: "PENDING",
        decision: null,
      }],
    },
  })
  const snapshot = await provider.getPortalSnapshot("membership", "MEMBER", {
    token: "verified-access-token",
  })
  assert.equal(snapshot.resources.groups.records[0].groupCode, "SHG-7")
  assert.equal(snapshot.resources.applications.records[0].requestId, "b".repeat(32))
})

test("unconfigured backend resources are explicit and never replaced with demo records", async () => {
  const unavailable = new Error("not configured")
  unavailable.status = 503
  const { provider } = providerWithResponses({
    "/api/v1/groups/mine": groupMemberships,
    "/api/v1/group-workflow/requests/mine": unavailable,
  })
  const snapshot = await provider.getPortalSnapshot("groups", "MEMBER", {
    token: "verified-access-token",
  })
  assert.equal(snapshot.resources.groups.status, "available")
  assert.equal(snapshot.resources.requests.status, "unavailable")
  assert.equal(snapshot.resources.requests.records, undefined)
})

test("API provider rejects missing authentication, unverified role previews, and unsupported modules", async () => {
  const { provider } = providerWithResponses({})
  await assert.rejects(
    provider.getPortalSnapshot("groups", "MEMBER"),
    /access token is required/
  )
  await assert.rejects(
    provider.getPortalSnapshot("groups", "PRESIDENT", { token: "token" }),
    PortalWorkflowUnavailableError
  )
  await assert.rejects(
    provider.getPortalSnapshot("savings", "MEMBER", { token: "token" }),
    PortalWorkflowUnavailableError
  )
})

test("API provider rejects malformed backend payloads rather than returning success-shaped data", async () => {
  const { provider } = providerWithResponses({
    "/api/v1/groups/mine": { success: true, groups: [{ groupId: "7" }] },
    "/api/v1/group-workflow/requests/mine": { success: true, requests: [] },
  })
  await assert.rejects(
    provider.getPortalSnapshot("groups", "MEMBER", { token: "token" }),
    /invalid shape/
  )
})

test("portal service selects an explicit provider mode and does not fallback after API errors", async () => {
  const error = new Error("API failed")
  const service = createPortalDataService({
    providers: {
      demo: createPortalDemoProvider(),
      api: { getPortalSnapshot: async () => { throw error } },
    },
  })
  await assert.rejects(
    service.getModuleSnapshot("MEMBER", "groups", { mode: "api", token: "token" }),
    (received) => received === error
  )
  assert.equal(
    (await service.getModuleSnapshot("MEMBER", "groups", { mode: "demo" })).demoOnly,
    true
  )
})

test("API error normalization preserves authorization and cancellation semantics", () => {
  const forbidden = new Error("backend detail")
  forbidden.status = 403
  assert.match(normalizePortalError(forbidden).message, /not permitted/)

  const aborted = new DOMException("cancelled", "AbortError")
  assert.equal(normalizePortalError(aborted), aborted)
})
