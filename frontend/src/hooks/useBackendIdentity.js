import { useCallback, useEffect, useState } from "react"
import { getBackendIdentity } from "../services/auth.service"

export function useBackendIdentity({
  ready,
  authenticated,
  getAccessToken,
}) {
  const [identity, setIdentity] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [accessDenied, setAccessDenied] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const refreshIdentity = useCallback(async () => {
    if (!ready || !authenticated) {
      setIdentity(null)
      setError("")
      setAccessDenied(false)
      return
    }

    setLoading(true)
    setError("")
    setAccessDenied(false)

    try {
      const token = await getAccessToken()

      if (!token) {
        throw new Error("Privy access token unavailable.")
      }

      const data = await getBackendIdentity(token)

      setIdentity(data)
      setError("")
      setAccessDenied(false)

      return data
    } catch (err) {
      if (err.status === 403) {
        setIdentity(err.data || null)
        setAccessDenied(true)
      } else {
        setError(err.message || "Unable to verify backend identity.")
      }
      throw err
    } finally {
      setLoading(false)
    }
  }, [ready, authenticated, getAccessToken])

  useEffect(() => {
    let cancelled = false

    async function verify() {
      if (!ready || !authenticated) {
        setIdentity(null)
        setError("")
        setAccessDenied(false)
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const token = await getAccessToken()

        if (!token) {
          throw new Error("Privy access token unavailable.")
        }

        const data = await getBackendIdentity(token)

        if (!cancelled) {
          setIdentity(data)
          setAccessDenied(false)
        }
      } catch (err) {
        if (!cancelled) {
          if (err.status === 403) {
            setIdentity(err.data || null)
            setAccessDenied(true)
          } else {
            setError(err.message || "Unable to verify backend identity.")
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    verify()

    return () => {
      cancelled = true
    }
  }, [ready, authenticated, getAccessToken, retryCount])

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1)
  }, [])

  return {
    identity,
    loading,
    error,
    accessDenied,
    refreshIdentity,
    retry,
  }
}
