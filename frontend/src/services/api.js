const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not configured.")
}

export async function apiRequest(path, options = {}) {
  const {
    token,
    headers = {},
    ...requestOptions
  } = options

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...requestOptions,
      headers: {
        ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  )

  let data

  try {
    data = await response.json()
  } catch {
    const error = new Error(
      `API returned an invalid JSON response (${response.status}).`
    )
    error.status = response.status
    throw error
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`API returned an invalid response (${response.status}).`)
  }

  if (!response.ok) {
    const error = new Error(
      (typeof data.message === "string" && data.message) ||
        `API request failed (${response.status}).`
    )

    error.status = response.status
    error.data = data

    throw error
  }

  return data
}
