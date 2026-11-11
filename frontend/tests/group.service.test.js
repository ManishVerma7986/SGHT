import test from "node:test"
import assert from "node:assert/strict"

import { createGroupService } from "../src/services/group.service.js"

function createHarness({ responses = [], error } = {}) {
  const calls = []
  const apiRequest = async (path, options) => {
    calls.push({ path, options })

    if (error) {
      throw error
    }

    return responses.shift()
  }

  return {
    calls,
    service: createGroupService({ apiRequest }),
  }
}

test("loads the authenticated user's group list", async () => {
  const groupResponse = {
    success: true,
    groups: [{
      groupId: 23,
      groupCode: "GRP-023",
      groupName: "Hillview Group",
      memberRole: "MEMBER",
      membershipStatus: "ACTIVE",
    }],
  }
  const harness = createHarness({ responses: [groupResponse] })

  assert.deepEqual(
    await harness.service.getCurrentGroups("privy-token"),
    groupResponse
  )
  assert.deepEqual(harness.calls, [{
    path: "/api/v1/groups/mine",
    options: {
      method: "GET",
      token: "privy-token",
      signal: undefined,
    },
  }])
})

test("submits a group request with bearer token and stable idempotency key", async () => {
  const response = {
    success: true,
    replayed: false,
    request: { requestId: "request-id", status: "PENDING" },
  }
  const harness = createHarness({ responses: [response] })

  assert.deepEqual(
    await harness.service.submitGroupRequest(
      "privy-token",
      { groupName: "Hillview Group" },
      { idempotencyKey: "2eb80bc1-45c8-4f20-a888-7757a8819975" }
    ),
    response
  )
  assert.deepEqual(harness.calls[0], {
    path: "/api/v1/group-workflow/requests",
    options: {
      method: "POST",
      token: "privy-token",
      signal: undefined,
      headers: {
        "Idempotency-Key": "2eb80bc1-45c8-4f20-a888-7757a8819975",
      },
      body: JSON.stringify({ groupName: "Hillview Group" }),
    },
  })
})

test("loads only the authenticated user's group request history", async () => {
  const response = {
    success: true,
    requests: [{ requestId: "request-1", status: "PENDING" }],
  }
  const controller = new AbortController()
  const harness = createHarness({ responses: [response] })

  assert.deepEqual(
    await harness.service.getOwnGroupRequests(
      "privy-token",
      { signal: controller.signal }
    ),
    response
  )
  assert.deepEqual(harness.calls, [{
    path: "/api/v1/group-workflow/requests/mine",
    options: {
      method: "GET",
      token: "privy-token",
      signal: controller.signal,
    },
  }])
})

test("submits a membership application with a stable idempotency key", async () => {
  const response = {
    success: true,
    simulated: true,
    replayed: false,
    request: { requestId: "a".repeat(32), groupCode: "ACTIVE-01" },
  }
  const harness = createHarness({ responses: [response] })

  assert.deepEqual(
    await harness.service.submitMembershipRequest(
      "privy-token",
      "ACTIVE-01",
      { idempotencyKey: "2eb80bc1-45c8-4f20-a888-7757a8819975" }
    ),
    response
  )
  assert.deepEqual(harness.calls[0], {
    path: "/api/v1/group-workflow/membership-requests",
    options: {
      method: "POST",
      token: "privy-token",
      signal: undefined,
      headers: {
        "Idempotency-Key": "2eb80bc1-45c8-4f20-a888-7757a8819975",
      },
      body: JSON.stringify({ groupCode: "ACTIVE-01" }),
    },
  })
})

test("loads own and group-scoped membership requests", async () => {
  const ownResponse = { success: true, requests: [] }
  const pendingResponse = { success: true, requests: [] }
  const harness = createHarness({ responses: [ownResponse, pendingResponse] })

  assert.deepEqual(
    await harness.service.getOwnMembershipRequests("privy-token"),
    ownResponse
  )
  assert.deepEqual(
    await harness.service.getPendingMembershipRequests(
      "privy-token",
      "ACTIVE-01"
    ),
    pendingResponse
  )
  assert.equal(
    harness.calls[0].path,
    "/api/v1/group-workflow/membership-requests/mine"
  )
  assert.equal(
    harness.calls[1].path,
    "/api/v1/group-workflow/groups/ACTIVE-01/membership-requests"
  )
})

test("membership decisions and withdrawals use public request references", async () => {
  const requestId = "a".repeat(32)
  const decisionResponse = { success: true, request: { requestId } }
  const withdrawalResponse = { success: true, request: { requestId } }
  const harness = createHarness({
    responses: [decisionResponse, withdrawalResponse],
  })

  await harness.service.decideMembershipRequest(
    "privy-token",
    requestId,
    "APPROVED"
  )
  await harness.service.withdrawMembershipRequest("privy-token", requestId)
  assert.equal(
    harness.calls[0].path,
    `/api/v1/group-workflow/membership-requests/${requestId}/decision`
  )
  assert.deepEqual(JSON.parse(harness.calls[0].options.body), {
    decision: "APPROVED",
  })
  assert.equal(
    harness.calls[1].path,
    `/api/v1/group-workflow/membership-requests/${requestId}/withdraw`
  )
})

test("rejects group request submission without authentication or idempotency key", async () => {
  const harness = createHarness()
  assert.throws(
    () => harness.service.submitGroupRequest("", {}, {
      idempotencyKey: "2eb80bc1-45c8-4f20-a888-7757a8819975",
    }),
    /authenticated access token/
  )
  assert.throws(
    () => harness.service.submitGroupRequest("privy-token", {}, {}),
    /idempotency key/
  )
  assert.throws(
    () => harness.service.submitMembershipRequest(
      "privy-token",
      "ACTIVE-01",
      {}
    ),
    /idempotency key/
  )
  assert.throws(
    () => harness.service.submitMembershipRequest(
      "privy-token",
      "bad group code",
      { idempotencyKey: "2eb80bc1-45c8-4f20-a888-7757a8819975" }
    ),
    /group code/
  )
  assert.deepEqual(harness.calls, [])
})

test("returns an empty group list without inventing a fallback group", async () => {
  const harness = createHarness({
    responses: [{ success: true, groups: [] }],
  })

  assert.deepEqual(
    await harness.service.getCurrentGroups("privy-token"),
    { success: true, groups: [] }
  )
})

test("loads group overview, membership, and own profile in parallel", async () => {
  const expected = [
    { success: true, group: { groupId: 23 } },
    { success: true, membership: { groupId: 23 } },
    { success: true, profile: { fullName: "Member Example" } },
  ]
  const controller = new AbortController()
  const harness = createHarness({ responses: [...expected] })

  assert.deepEqual(
    await harness.service.getSelectedGroupData(
      "privy-token",
      23,
      { signal: controller.signal }
    ),
    expected
  )
  assert.deepEqual(
    harness.calls.map(({ path }) => path),
    [
      "/api/v1/groups/23",
      "/api/v1/groups/23/membership",
      "/api/v1/groups/23/members/me",
    ]
  )
  for (const { options } of harness.calls) {
    assert.equal(options.method, "GET")
    assert.equal(options.token, "privy-token")
    assert.equal(options.signal, controller.signal)
  }
})

test("loads a paginated member directory using the shared API client", async () => {
  const directoryResponse = {
    success: true,
    members: [],
    pagination: { page: 2, limit: 25, hasMore: false },
  }
  const harness = createHarness({ responses: [directoryResponse] })

  assert.deepEqual(
    await harness.service.getGroupMembers("privy-token", 23, 2, 25),
    directoryResponse
  )
  assert.equal(
    harness.calls[0].path,
    "/api/v1/groups/23/members?page=2&limit=25"
  )
  assert.equal(harness.calls[0].options.token, "privy-token")
  assert.equal(harness.calls[0].options.method, "GET")
})

test("preserves an empty member directory response", async () => {
  const response = {
    success: true,
    members: [],
    pagination: { page: 1, limit: 25, hasMore: false },
  }
  const harness = createHarness({ responses: [response] })

  assert.deepEqual(
    await harness.service.getGroupMembers("privy-token", 23, 1, 25),
    response
  )
})

test("rejects missing group context before making API requests", async () => {
  const harness = createHarness()

  assert.throws(
    () => harness.service.getSelectedGroupData("privy-token", null),
    /valid selected group/
  )
  assert.throws(
    () => harness.service.getGroupMembers("privy-token", undefined, 1, 25),
    /valid selected group/
  )
  assert.deepEqual(harness.calls, [])
})

test("propagates authentication failures for dashboard error handling", async () => {
  const authError = Object.assign(new Error("Session expired"), {
    status: 401,
  })
  const harness = createHarness({ error: authError })

  await assert.rejects(
    harness.service.getCurrentGroups("expired-token"),
    (error) => error === authError && error.status === 401
  )
})

test("propagates service failures without exposing a success-shaped fallback", async () => {
  const serviceError = Object.assign(new Error("Service unavailable"), {
    status: 503,
  })
  const harness = createHarness({ error: serviceError })

  await assert.rejects(
    harness.service.getCurrentGroups("privy-token"),
    (error) => error === serviceError && error.status === 503
  )
})

test("rejects invalid directory pagination before making API requests", async () => {
  const harness = createHarness()

  for (const [page, limit] of [
    [0, 25],
    [1, 0],
    [1, 101],
    [4002, 25],
  ]) {
    assert.throws(
      () => harness.service.getGroupMembers("privy-token", 23, page, limit),
      /valid directory pagination/i
    )
  }

  assert.deepEqual(harness.calls, [])
})

test("accepts the maximum permitted directory offset", async () => {
  const harness = createHarness({
    responses: [{
      success: true,
      members: [],
      pagination: { page: 4001, limit: 25, hasMore: false },
    }],
  })

  await harness.service.getGroupMembers("privy-token", 23, 4001, 25)
  assert.match(harness.calls[0].path, /\?page=4001&limit=25$/)
})
