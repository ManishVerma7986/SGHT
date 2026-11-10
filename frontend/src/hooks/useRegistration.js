
import { useRef, useState } from "react"
import { registerMember } from "../services/auth.service"

function normalizePhoneNumber(value) {
  if (typeof value !== "string") {
    throw new Error("Phone number is required.")
  }

  const normalized = value.trim().replace(/[\s()-]/g, "")

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error(
      "Enter a valid international phone number with country code."
    )
  }

  return normalized
}

export function useRegistration({ getAccessToken, refreshIdentity }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const inFlightRef = useRef(false)

  const submitRegistration = async (memberData) => {
    // Prevent concurrent registration requests.
    if (inFlightRef.current) {
      throw new Error("Registration is already in progress.")
    }

    inFlightRef.current = true
    setLoading(true)
    setError("")

    try {
      if (!memberData || typeof memberData !== "object") {
        throw new Error("Invalid registration details.")
      }

      const fullName = memberData.fullName?.trim()

      if (!fullName || fullName.length < 2) {
        throw new Error("Enter your full name.")
      }

      // Enforce the same international phone policy as the backend.
      const phoneNumber = normalizePhoneNumber(memberData.phoneNumber)

      const email = memberData.email?.trim() || null

      // Check whether registration already exists.
      const existingIdentity = await refreshIdentity()

      if (
        !existingIdentity ||
        typeof existingIdentity.registered !== "boolean"
      ) {
        throw new Error(
          "Unable to confirm your SHGT registration status. Please retry."
        )
      }

      if (existingIdentity.registered) {
        return existingIdentity
      }

      const token = await getAccessToken()

      if (!token) {
        throw new Error("Privy authentication token unavailable.")
      }

      try {
        await registerMember(token, {
          fullName,
          phoneNumber,
          email,
        })
      } catch (registrationError) {
        // The database may have committed even if the response was lost.
        try {
          const reconciledIdentity = await refreshIdentity()

          if (reconciledIdentity?.registered) {
            return reconciledIdentity
          }
        } catch {
          throw new Error(
            "Your registration may already be saved, but SHGT could not verify it. Please retry before submitting again."
          )
        }

        // Preserve original errors, including HTTP 409.
        throw registrationError
      }

      // Verify the actual backend registration state.
      let identity

      try {
        identity = await refreshIdentity()
      } catch {
        throw new Error(
          "Your registration request was submitted, but its final status could not be verified. Please retry."
        )
      }

      if (!identity?.registered) {
        throw new Error(
          "SHGT registration could not be confirmed. Please contact support before trying again."
        )
      }

      return identity

    } catch (err) {
      setError(err.message || "SHGT registration failed.")
      throw err

    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    submitRegistration,
  }
}
