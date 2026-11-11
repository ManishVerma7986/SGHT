import { PortalWorkflowUnavailableError } from "./portal-data.error.js"

function invalidResponse(resource) {
  throw new TypeError(`The ${resource} API response has an invalid shape.`)
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function validateEnvelope(value, resource, property) {
  if (!isObject(value) || value.success !== true || !Array.isArray(value[property])) {
    invalidResponse(resource)
  }
  return value[property]
}

function validateGroup(group) {
  return isObject(group) &&
    Number.isSafeInteger(group.groupId) && group.groupId > 0 &&
    typeof group.groupCode === "string" && group.groupCode.length > 0 &&
    typeof group.groupName === "string" && group.groupName.length > 0 &&
    ["PRESIDENT", "SECRETARY", "TREASURER", "MEMBER"].includes(group.memberRole) &&
    group.membershipStatus === "ACTIVE"
}

function validateGroupRequest(request) {
  return isObject(request) &&
    typeof request.requestId === "string" && request.requestId.length > 0 &&
    ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"].includes(request.status) &&
    isObject(request.payload) &&
    typeof request.payload.groupName === "string"
}

function validateMembershipRequest(request) {
  return isObject(request) &&
    typeof request.requestId === "string" && /^[0-9a-f]{32}$/i.test(request.requestId) &&
    typeof request.groupCode === "string" &&
    ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"].includes(request.status)
}

function mapGroup(group) {
  return {
    id: group.groupId,
    groupId: group.groupId,
    groupCode: group.groupCode,
    groupName: group.groupName,
    role: group.memberRole,
    status: group.membershipStatus,
  }
}

function mapGroupRequest(request) {
  return {
    id: request.requestId,
    requestId: request.requestId,
    groupName: request.payload.groupName,
    status: request.status,
    decisionReason: request.decision?.reason ?? null,
    resultingGroupCode: request.decision?.groupCode ?? null,
  }
}

function mapMembershipRequest(request) {
  return {
    id: request.requestId,
    requestId: request.requestId,
    groupCode: request.groupCode,
    status: request.status,
    decisionReason: request.decision?.reason ?? null,
  }
}

async function loadResource(apiRequest, path, token, signal, resource, property, validateItem) {
  try {
    const response = await apiRequest(path, { method: "GET", token, signal })
    const records = validateEnvelope(response, resource, property)
    if (records.some((record) => !validateItem(record))) {
      invalidResponse(resource)
    }
    return Object.freeze({ status: "available", records })
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") {
      throw error
    }
    if (error?.status === 503 || error?.status === 404) {
      return Object.freeze({
        status: "unavailable",
        message: "This protected resource is unavailable. Demo data was not substituted.",
      })
    }
    throw error
  }
}

export function createPortalApiProvider({ apiRequest } = {}) {
  if (typeof apiRequest !== "function") {
    throw new TypeError("An authenticated API request function is required.")
  }

  async function getPortalSnapshot(moduleName, role, { token, signal } = {}) {
    if (role !== "MEMBER") {
      throw new PortalWorkflowUnavailableError(
        "API mode is restricted to endpoints that derive the current member from the verified session."
      )
    }
    if (typeof token !== "string" || !token.trim()) {
      throw new TypeError("An authenticated access token is required for API mode.")
    }

    if (moduleName === "groups") {
      const [groups, requests] = await Promise.all([
        loadResource(
          apiRequest,
          "/api/v1/groups/mine",
          token,
          signal,
          "group memberships",
          "groups",
          validateGroup
        ),
        loadResource(
          apiRequest,
          "/api/v1/group-workflow/requests/mine",
          token,
          signal,
          "group requests",
          "requests",
          validateGroupRequest
        ),
      ])
      if (groups.status === "unavailable" && requests.status === "unavailable") {
        throw new PortalWorkflowUnavailableError(
          "Authenticated group memberships and group requests are unavailable."
        )
      }
      return Object.freeze({
        mode: "api",
        demoOnly: false,
        moduleName,
        resources: Object.freeze({
          groups: groups.status === "available"
            ? Object.freeze({ ...groups, records: groups.records.map(mapGroup) })
            : groups,
          requests: requests.status === "available"
            ? Object.freeze({ ...requests, records: requests.records.map(mapGroupRequest) })
            : requests,
        }),
      })
    }

    if (moduleName === "membership") {
      const [groups, applications] = await Promise.all([
        loadResource(
          apiRequest,
          "/api/v1/groups/mine",
          token,
          signal,
          "group memberships",
          "groups",
          validateGroup
        ),
        loadResource(
          apiRequest,
          "/api/v1/group-workflow/membership-requests/mine",
          token,
          signal,
          "membership applications",
          "requests",
          validateMembershipRequest
        ),
      ])
      if (groups.status === "unavailable" && applications.status === "unavailable") {
        throw new PortalWorkflowUnavailableError(
          "Authenticated group memberships and membership applications are unavailable."
        )
      }
      return Object.freeze({
        mode: "api",
        demoOnly: false,
        moduleName,
        resources: Object.freeze({
          groups: groups.status === "available"
            ? Object.freeze({ ...groups, records: groups.records.map(mapGroup) })
            : groups,
          applications: applications.status === "available"
            ? Object.freeze({
                ...applications,
                records: applications.records.map(mapMembershipRequest),
              })
            : applications,
        }),
      })
    }

    throw new PortalWorkflowUnavailableError(
      `The ${moduleName} API workflow is not implemented.`
    )
  }

  return Object.freeze({ getPortalSnapshot })
}
