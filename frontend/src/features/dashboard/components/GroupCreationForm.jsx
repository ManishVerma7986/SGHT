import { useRef, useState } from "react"

import { apiRequest } from "../../../services/api"
import { createGroupService } from "../../../services/group.service"
import { evaluateGroupCreation } from "./group-creation-form"

const groupService = createGroupService({ apiRequest })
const INITIAL_VALUES = {
  groupName: "",
  description: "",
  location: "",
}

function GroupCreationForm({ getAccessToken, onSubmitted }) {
  const [values, setValues] = useState(INITIAL_VALUES)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const idempotencyKey = useRef(null)

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    idempotencyKey.current = null
    setErrors((current) => {
      if (!current[name]) {
        return current
      }

      const next = { ...current }
      delete next[name]
      return next
    })
    setMessage("")
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const result = evaluateGroupCreation(values)
    setErrors(result.errors)
    setMessage("")
    if (Object.keys(result.errors).length > 0) {
      return
    }

    if (!idempotencyKey.current) {
      if (typeof globalThis.crypto?.randomUUID !== "function") {
        setMessage("Secure request submission is unavailable in this browser.")
        return
      }
      idempotencyKey.current = crypto.randomUUID()
    }

    setSubmitting(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setMessage("Your sign-in session is unavailable. Sign in again to submit.")
        return
      }

      const response = await groupService.submitGroupRequest(
        token,
        {
          groupName: values.groupName.trim(),
          description: values.description.trim(),
          village: values.location.trim(),
        },
        { idempotencyKey: idempotencyKey.current }
      )

      if (
        response?.success !== true ||
        response.request?.status !== "PENDING" ||
        typeof response.request.requestId !== "string"
      ) {
        throw new Error("The group request response could not be verified.")
      }

      setMessage("Group request submitted for review. It is not an active group.")
      idempotencyKey.current = null
      onSubmitted?.()
    } catch (error) {
      setMessage(error?.status === 503
        ? "Creation workflow not yet available. Your request was not confirmed as saved."
        : "Unable to confirm the group request. Retry with the same details to safely check its status.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="dashboard-panel group-creation-panel">
      <div className="panel-heading">
        <div>
          <h2>Start a group</h2>
          <p>Submit a request for review. Approval and activation are separate.</p>
        </div>
        <span className="workflow-status-badge">Coming soon</span>
      </div>

      <form className="group-creation-form" onSubmit={handleSubmit} noValidate>
        <div className="group-form-field">
          <label htmlFor="group-name">Group name <span>(required)</span></label>
          <input
            id="group-name"
            name="groupName"
            type="text"
            autoComplete="organization"
            maxLength={150}
            value={values.groupName}
            onChange={handleChange}
            aria-invalid={Boolean(errors.groupName)}
            aria-describedby={errors.groupName ? "group-name-error" : undefined}
          />
          {errors.groupName && (
            <p className="group-form-error" id="group-name-error" role="alert">
              {errors.groupName}
            </p>
          )}
        </div>

        <div className="group-form-field">
          <label htmlFor="group-description">Description <span>(optional)</span></label>
          <textarea
            id="group-description"
            name="description"
            rows={4}
            maxLength={500}
            value={values.description}
            onChange={handleChange}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description ? "group-description-error" : undefined
            }
          />
          {errors.description && (
            <p
              className="group-form-error"
              id="group-description-error"
              role="alert"
            >
              {errors.description}
            </p>
          )}
        </div>

        <div className="group-form-field">
          <label htmlFor="group-location">Village / location <span>(optional)</span></label>
          <input
            id="group-location"
            name="location"
            type="text"
            autoComplete="address-level2"
            maxLength={100}
            value={values.location}
            onChange={handleChange}
            aria-invalid={Boolean(errors.location)}
            aria-describedby={errors.location ? "group-location-error" : undefined}
          />
          {errors.location && (
            <p
              className="group-form-error"
              id="group-location-error"
              role="alert"
            >
              {errors.location}
            </p>
          )}
        </div>

        <div className="group-form-submit">
          <button className="secondary-button" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit group request"}
          </button>
          {message && <p role="status" aria-busy={submitting}>{message}</p>}
        </div>
      </form>
    </section>
  )
}

export default GroupCreationForm
