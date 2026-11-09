import { apiRequest } from "./api"

export function getBackendIdentity(token) {
  return apiRequest("/api/v1/auth/me", {
    method: "GET",
    token,
  })
}

export function registerMember(token, memberData) {
  return apiRequest("/api/v1/auth/register", {
    method: "POST",
    token,
    body: JSON.stringify(memberData),
  })
}
