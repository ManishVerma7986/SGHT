export class PortalWorkflowUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = "PortalWorkflowUnavailableError"
  }
}

export function normalizePortalError(error) {
  if (error?.name === "AbortError") {
    return error
  }
  if (error instanceof PortalWorkflowUnavailableError) {
    return error
  }

  const status = Number.isInteger(error?.status) ? error.status : null
  const message = status === 401
    ? "Your authenticated session is no longer valid. Sign in again."
    : status === 403
      ? "Your account is not permitted to access this data."
      : status === 404 || status === 503
        ? "This backend workflow is currently unavailable."
        : "Unable to load data from the selected provider."

  const normalized = new Error(message, { cause: error })
  normalized.name = "PortalDataError"
  normalized.status = status
  return normalized
}
