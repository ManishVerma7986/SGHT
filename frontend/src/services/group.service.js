function createGroupService({ apiRequest }) {
  if (typeof apiRequest !== "function") {
    throw new Error("An authenticated API request function is required.")
  }

  function getCurrentGroups(token, { signal } = {}) {
    return apiRequest("/api/v1/groups/mine", {
      method: "GET",
      token,
      signal,
    })
  }

  function getOwnGroupRequests(token, { signal } = {}) {
    if (typeof token !== "string" || !token.trim()) {
      throw new TypeError("An authenticated access token is required.")
    }

    return apiRequest("/api/v1/group-workflow/requests/mine", {
      method: "GET",
      token,
      signal,
    })
  }

  function getOwnMembershipRequests(token, { signal } = {}) {
    if (typeof token !== "string" || !token.trim()) {
      throw new TypeError("An authenticated access token is required.")
    }

    return apiRequest("/api/v1/group-workflow/membership-requests/mine", {
      method: "GET",
      token,
      signal,
    })
  }

  function submitMembershipRequest(
    token,
    groupCode,
    { idempotencyKey, signal } = {},
  ) {
    if (typeof token !== "string" || !token.trim()) {
      throw new TypeError("An authenticated access token is required.")
    }
    if (
      typeof groupCode !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9-]{0,49}$/.test(groupCode)
    ) {
      throw new TypeError("A valid group code is required.")
    }
    if (
      typeof idempotencyKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(idempotencyKey)
    ) {
      throw new TypeError("A valid membership request idempotency key is required.")
    }

    return apiRequest("/api/v1/group-workflow/membership-requests", {
      method: "POST",
      token,
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ groupCode }),
    })
  }

  function getPendingMembershipRequests(token, groupCode, { signal } = {}) {
    if (typeof token !== "string" || !token.trim()) {
      throw new TypeError("An authenticated access token is required.")
    }
    if (
      typeof groupCode !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9-]{0,49}$/.test(groupCode)
    ) {
      throw new TypeError("A valid group code is required.")
    }

    return apiRequest(
      `/api/v1/group-workflow/groups/${encodeURIComponent(groupCode)}/membership-requests`,
      { method: "GET", token, signal },
    )
  }

  function decideMembershipRequest(
    token,
    requestId,
    decision,
    { reason, signal } = {},
  ) {
    if (typeof token !== "string" || !token.trim()) {
      throw new TypeError("An authenticated access token is required.")
    }
    if (typeof requestId !== "string" || !/^[0-9a-f]{32}$/i.test(requestId)) {
      throw new TypeError("A valid membership request reference is required.")
    }
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      throw new TypeError("A valid membership decision is required.")
    }

    return apiRequest(
      `/api/v1/group-workflow/membership-requests/${requestId}/decision`,
      {
        method: "POST",
        token,
        signal,
        body: JSON.stringify({ decision, reason }),
      },
    )
  }

  function withdrawMembershipRequest(token, requestId, { signal } = {}) {
    if (typeof token !== "string" || !token.trim()) {
      throw new TypeError("An authenticated access token is required.")
    }
    if (typeof requestId !== "string" || !/^[0-9a-f]{32}$/i.test(requestId)) {
      throw new TypeError("A valid membership request reference is required.")
    }

    return apiRequest(
      `/api/v1/group-workflow/membership-requests/${requestId}/withdraw`,
      { method: "POST", token, signal },
    )
  }

  function submitGroupRequest(token, payload, { idempotencyKey, signal } = {}) {
    if (typeof token !== "string" || !token.trim()) {
      throw new TypeError("An authenticated access token is required.")
    }
    if (
      typeof idempotencyKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(idempotencyKey)
    ) {
      throw new TypeError("A valid request idempotency key is required.")
    }

    return apiRequest("/api/v1/group-workflow/requests", {
      method: "POST",
      token,
      signal,
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    })
  }

  function getSelectedGroupData(token, groupId, { signal } = {}) {
    if (
      !Number.isSafeInteger(Number(groupId)) ||
      Number(groupId) <= 0
    ) {
      throw new TypeError("A valid selected group is required.")
    }

    const groupPath = `/api/v1/groups/${encodeURIComponent(groupId)}`

    return Promise.all([
      apiRequest(groupPath, { method: "GET", token, signal }),
      apiRequest(`${groupPath}/membership`, { method: "GET", token, signal }),
      apiRequest(`${groupPath}/members/me`, { method: "GET", token, signal }),
    ])
  }

  function getGroupMembers(token, groupId, page, limit, { signal } = {}) {
    if (
      !Number.isSafeInteger(Number(groupId)) ||
      Number(groupId) <= 0
    ) {
      throw new TypeError("A valid selected group is required.")
    }
    const offset = (page - 1) * limit
    if (
      !Number.isSafeInteger(page) ||
      page <= 0 ||
      !Number.isSafeInteger(limit) ||
      limit <= 0 ||
      limit > 100 ||
      !Number.isSafeInteger(offset) ||
      offset > 100000
    ) {
      throw new TypeError("Valid directory pagination is required.")
    }

    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })

    return apiRequest(
      `/api/v1/groups/${encodeURIComponent(groupId)}/members?${query}`,
      {
        method: "GET",
        token,
        signal,
      }
    )
  }

  return {
    getCurrentGroups,
    submitGroupRequest,
    getOwnGroupRequests,
    getOwnMembershipRequests,
    submitMembershipRequest,
    getPendingMembershipRequests,
    decideMembershipRequest,
    withdrawMembershipRequest,
    getSelectedGroupData,
    getGroupMembers,
  }
}

export { createGroupService }
