import { useEffect, useState } from "react"

import { apiRequest } from "../../../services/api"
import { createGroupService } from "../../../services/group.service"

const groupService = createGroupService({ apiRequest })

function isValidRequestsResponse(response) {
  return response?.success === true &&
    Array.isArray(response.requests) &&
    response.requests.every((request) =>
      request &&
      typeof request.requestId === "string" &&
      typeof request.status === "string" &&
      ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"].includes(request.status) &&
      typeof request.payload?.groupName === "string"
    )
}

function GroupRequestList({ getAccessToken, refreshKey }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function loadRequests() {
      setLoading(true)
      setError("")
      try {
        const token = await getAccessToken()
        if (!token) {
          throw new Error("An authenticated access token is unavailable.")
        }
        const response = await groupService.getOwnGroupRequests(token, {
          signal: controller.signal,
        })
        if (!isValidRequestsResponse(response)) {
          throw new Error("Group request response is invalid.")
        }
        if (active) {
          setRequests(response.requests)
        }
      } catch (requestError) {
        if (active && requestError?.name !== "AbortError") {
          setRequests([])
          setError(requestError?.status === 503
            ? "Group request status is unavailable until workflow persistence is configured."
            : "Unable to retrieve your group requests.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadRequests()
    return () => {
      active = false
      controller.abort()
    }
  }, [getAccessToken, refreshKey])

  return (
    <section className="dashboard-panel" aria-labelledby="group-requests-title">
      <div className="panel-heading">
        <div>
          <h2 id="group-requests-title">My group requests</h2>
          <p>Request review and activation have separate statuses.</p>
        </div>
      </div>
      {loading && <p role="status">Loading group requests...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && requests.length === 0 && (
        <p>No group requests were found.</p>
      )}
      {!error && requests.length > 0 && (
        <ul className="group-request-list">
          {requests.map((request) => (
            <li key={request.requestId}>
              <strong>{request.payload.groupName}</strong>
              <span>{request.status}</span>
              {request.status === "REJECTED" &&
                typeof request.decision?.reason === "string" && (
                  <p>{request.decision.reason}</p>
                )}
              {request.status === "APPROVED" && (
                <p>Approved; group activation is a separate step.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default GroupRequestList
