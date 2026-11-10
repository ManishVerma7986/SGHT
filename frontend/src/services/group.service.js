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
    getSelectedGroupData,
    getGroupMembers,
  }
}

export { createGroupService }
