import { useEffect, useRef, useState } from "react"

import { apiRequest } from "../../../services/api"
import { createGroupService } from "../../../services/group.service"

const groupService = createGroupService({ apiRequest })

function isRequestList(response) {
  return response?.success === true &&
    Array.isArray(response.requests) &&
    response.requests.every((request) =>
      request &&
      typeof request.requestId === "string" &&
      typeof request.groupCode === "string" &&
      ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"].includes(request.status)
    )
}

function getErrorMessage(error, operation) {
  if (error?.status === 503) {
    return "Membership workflow persistence is unavailable; this request was not saved."
  }
  if (error?.status === 403) {
    return "Your active group role does not authorize reviewing membership requests."
  }
  if (error?.status === 409) {
    return error.message ||
      "The request conflicts with an existing membership or workflow state."
  }
  if (error?.status === 401) {
    return "Your session may have expired. Sign in again to continue."
  }
  return `Unable to ${operation}. Please try again.`
}

function MembershipWorkflowPanel({ getAccessToken }) {
  const [groupCode, setGroupCode] = useState("")
  const [requests, setRequests] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [simulated, setSimulated] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [reasons, setReasons] = useState({})
  const idempotencyRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function loadRequests() {
      setLoading(true)
      setError("")
      try {
        const token = await getAccessToken()
        if (!token) {
          throw Object.assign(new Error("Access token unavailable."), {
            status: 401,
          })
        }
        const response = await groupService.getOwnMembershipRequests(token, {
          signal: controller.signal,
        })
        if (!isRequestList(response)) {
          throw new Error("Membership request response is invalid.")
        }
        if (active) {
          setRequests(response.requests)
          setSimulated(response.simulated === true)
        }
      } catch (requestError) {
        if (active && requestError?.name !== "AbortError") {
          setRequests([])
          setError(getErrorMessage(requestError, "load your membership requests"))
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

  async function submitRequest(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const token = await getAccessToken()
      if (!token) {
        throw Object.assign(new Error("Access token unavailable."), {
          status: 401,
        })
      }
      let key = idempotencyRef.current
      if (!key || key.groupCode !== groupCode.trim()) {
        const createKey = globalThis.crypto?.randomUUID
        if (typeof createKey !== "function") {
          throw new Error("Secure idempotency key generation is unavailable.")
        }
        key = { groupCode: groupCode.trim(), value: createKey.call(globalThis.crypto) }
        idempotencyRef.current = key
      }
      const response = await groupService.submitMembershipRequest(
        token,
        key.groupCode,
        { idempotencyKey: key.value },
      )
      if (response?.success !== true || !response.request) {
        throw new Error("Membership request response is invalid.")
      }
      idempotencyRef.current = null
      setSimulated(response.simulated === true)
      setMessage(response.replayed
        ? (response.simulated
          ? "Test-only simulation: this request remains in memory and is not persisted."
          : "This membership application was already submitted.")
        : (response.simulated
          ? "Test-only simulation: this request is in memory and is not persisted."
          : "Membership application submitted."))
      setRefreshKey((value) => value + 1)
    } catch (requestError) {
      setError(getErrorMessage(requestError, "submit the membership application"))
    } finally {
      setBusy(false)
    }
  }

  async function loadPending(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const token = await getAccessToken()
      if (!token) {
        throw Object.assign(new Error("Access token unavailable."), {
          status: 401,
        })
      }
      const response = await groupService.getPendingMembershipRequests(
        token,
        groupCode.trim(),
      )
      if (!isRequestList(response)) {
        throw new Error("Pending membership request response is invalid.")
      }
      setPendingRequests(response.requests)
      setSimulated(response.simulated === true)
    } catch (requestError) {
      setPendingRequests([])
      setError(getErrorMessage(requestError, "load pending group applications"))
    } finally {
      setBusy(false)
    }
  }

  async function decideRequest(requestId, decision) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const token = await getAccessToken()
      if (!token) {
        throw Object.assign(new Error("Access token unavailable."), {
          status: 401,
        })
      }
      const response = await groupService.decideMembershipRequest(
        token,
        requestId,
        decision,
        { reason: reasons[requestId] },
      )
      if (response?.success !== true || !response.request) {
        throw new Error("Membership decision response is invalid.")
      }
      setSimulated(response.simulated === true)
      setMessage(`Membership application ${decision.toLowerCase()}.`)
      setPendingRequests((current) =>
        current.filter((request) => request.requestId !== requestId)
      )
      setRefreshKey((value) => value + 1)
    } catch (requestError) {
      setError(getErrorMessage(requestError, "decide the membership application"))
    } finally {
      setBusy(false)
    }
  }

  async function withdrawRequest(requestId) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const token = await getAccessToken()
      if (!token) {
        throw Object.assign(new Error("Access token unavailable."), {
          status: 401,
        })
      }
      const response = await groupService.withdrawMembershipRequest(
        token,
        requestId,
      )
      if (response?.success !== true || !response.request) {
        throw new Error("Membership withdrawal response is invalid.")
      }
      setSimulated(response.simulated === true)
      setMessage("Membership application withdrawn.")
      setRefreshKey((value) => value + 1)
    } catch (requestError) {
      setError(getErrorMessage(requestError, "withdraw the membership application"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dashboard-panel" aria-labelledby="membership-workflow-title">
      <div className="panel-heading">
        <div>
          <h2 id="membership-workflow-title">Membership applications</h2>
          <p>Applications are reviewed by an authorized group officer.</p>
        </div>
      </div>

      <form onSubmit={submitRequest}>
        <label htmlFor="membership-group-code">Group code</label>
        <input
          id="membership-group-code"
          value={groupCode}
          onChange={(event) => {
            setGroupCode(event.target.value)
            setPendingRequests([])
          }}
          required
          maxLength={50}
          pattern="[A-Za-z0-9][A-Za-z0-9-]{0,49}"
          autoComplete="off"
        />
        <button className="primary-button" type="submit" disabled={busy}>
          Apply to join
        </button>
      </form>

      <form onSubmit={loadPending}>
        <button className="secondary-button" type="submit" disabled={busy}>
          Load applications to review
        </button>
      </form>

      <p className="workflow-disclaimer">
        Production persistence is disabled until the database workflow is
        approved and configured.
      </p>
      {simulated && (
        <p role="note">
          TEST-ONLY SIMULATION — data is held in memory and will not persist.
        </p>
      )}

      {loading && <p role="status">Loading your applications...</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {!loading && requests.length === 0 && !error && (
        <p>You have no membership applications.</p>
      )}
      {requests.length > 0 && (
        <ul className="group-request-list">
          {requests.map((request) => (
            <li key={request.requestId}>
              <strong>{request.groupCode}</strong>
              <span>{request.status}</span>
              {request.status === "REJECTED" && request.decision?.reason && (
                <p>{request.decision.reason}</p>
              )}
              {request.status === "PENDING" && (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => withdrawRequest(request.requestId)}
                >
                  Withdraw
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {pendingRequests.length > 0 && (
        <ul className="group-request-list">
          {pendingRequests.map((request) => (
            <li key={request.requestId}>
              <strong>Application {request.requestId.slice(0, 8)}</strong>
              {typeof request.requesterDisplayName === "string" ? (
                <>
                  <span>{request.requesterDisplayName}</span>
                  <label htmlFor={`membership-reason-${request.requestId}`}>
                    Rejection reason (required to reject)
                  </label>
                  <input
                    id={`membership-reason-${request.requestId}`}
                    value={reasons[request.requestId] || ""}
                    onChange={(event) =>
                      setReasons((current) => ({
                        ...current,
                        [request.requestId]: event.target.value,
                      }))
                    }
                    maxLength={500}
                  />
                  <button
                    className="primary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => decideRequest(request.requestId, "APPROVED")}
                  >
                    Approve
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={
                      busy ||
                      (reasons[request.requestId] || "").trim().length < 10
                    }
                    onClick={() => decideRequest(request.requestId, "REJECTED")}
                  >
                    Reject
                  </button>
                </>
              ) : (
                <p>
                  Decisions are disabled until an approved applicant identity
                  projection is available.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default MembershipWorkflowPanel
