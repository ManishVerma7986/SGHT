function createProfileService({ apiRequest }) {
  if (typeof apiRequest !== "function") {
    throw new Error("An authenticated API request function is required.")
  }

  function getOwnProfile(token, { signal } = {}) {
    if (typeof token !== "string" || !token.trim()) {
      throw new TypeError("An authenticated access token is required.")
    }

    return apiRequest("/api/v1/profile/me", {
      method: "GET",
      token,
      signal,
    })
  }

  return Object.freeze({ getOwnProfile })
}

export { createProfileService }
