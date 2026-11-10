import test from "node:test"
import assert from "node:assert/strict"

import { createProfileService } from "../src/services/profile.service.js"

test("loads the current profile through the authenticated API", async () => {
  const calls = []
  const service = createProfileService({
    apiRequest: async (...args) => {
      calls.push(args)
      return { success: true, profile: { fullName: "Example Member" } }
    },
  })
  const signal = new AbortController().signal

  assert.deepEqual(await service.getOwnProfile("privy-token", { signal }), {
    success: true,
    profile: { fullName: "Example Member" },
  })
  assert.deepEqual(calls, [[
    "/api/v1/profile/me",
    { method: "GET", token: "privy-token", signal },
  ]])
})

test("rejects profile requests without an access token", () => {
  const service = createProfileService({ apiRequest: async () => ({}) })
  assert.throws(() => service.getOwnProfile(" "), /access token/)
})
