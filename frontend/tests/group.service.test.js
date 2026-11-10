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
