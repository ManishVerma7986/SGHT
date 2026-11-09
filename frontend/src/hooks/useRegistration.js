import { useState } from "react"
import { registerMember } from "../services/auth.service"

export function useRegistration({ getAccessToken, refreshIdentity }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false)

  const submitRegistration = async (memberData) => {
    setLoading(true)
    setError("")

    let registrationAccepted = registrationSubmitted

    try {
      console.log("REQUESTING PRIVY ACCESS TOKEN")
      const token = await getAccessToken()
      console.log("PRIVY ACCESS TOKEN RECEIVED:", Boolean(token))

      if (!token) {
        throw new Error("Privy authentication token unavailable.")
      }

      // Never submit registration again if Oracle may already have
      // committed the original request.
      if (!registrationAccepted) {
        try {
          await registerMember(token, {
            fullName: memberData.fullName,
            phoneNumber: memberData.phoneNumber || null,
            email: memberData.email || null,
          })

          registrationAccepted = true
          setRegistrationSubmitted(true)

        } catch (err) {
          // A 409 may mean another request already registered this identity.
          if (err.status !== 409) {
            throw err
          }

          registrationAccepted = true
          setRegistrationSubmitted(true)
        }
      }

      // Verify the actual backend state instead of trusting the POST response.
      const identity = await refreshIdentity()

      if (!identity?.registered) {

        throw new Error(
          "SHGT registration could not be confirmed. Please check your account status before trying again."
        )
      }

      return identity

    } catch (err) {
      const message = registrationAccepted
        ? "Your registration may already be saved. Retry identity verification instead of submitting another registration."
        : err.message || "SHGT registration failed."

      setError(message)
      throw err

    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    submitRegistration,
  }
}

