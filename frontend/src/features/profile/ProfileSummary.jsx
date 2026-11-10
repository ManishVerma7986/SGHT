import { useEffect, useState } from "react"

import { apiRequest } from "../../services/api"
import { createProfileService } from "../../services/profile.service"

const profileService = createProfileService({ apiRequest })

function ProfileSummary({ getAccessToken }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function loadProfile() {
      setLoading(true)
      setError("")
      try {
        const token = await getAccessToken()
        if (!token) {
          throw new Error("An authenticated access token is unavailable.")
        }
        const response = await profileService.getOwnProfile(token, {
          signal: controller.signal,
        })
        if (
          !response?.success ||
          typeof response.profile?.fullName !== "string" ||
          !response.profile.fullName.trim()
        ) {
          throw new Error("The profile response is invalid.")
        }
        if (active) {
          setProfile(response.profile)
        }
      } catch (requestError) {
        if (active && requestError?.name !== "AbortError") {
          setError("Profile information is unavailable. Please try again.")
          setProfile(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadProfile()
    return () => {
      active = false
      controller.abort()
    }
  }, [getAccessToken, retry])

  return (
    <section className="dashboard-panel" aria-labelledby="profile-summary-title">
      <div className="panel-heading">
        <div>
          <h3 id="profile-summary-title">My profile</h3>
          <p>Verified SHGT profile information</p>
        </div>
      </div>
      {loading && <p role="status">Loading profile...</p>}
      {error && (
        <div>
          <p role="alert">{error}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {profile && (
        <dl>
          <dt>Full name</dt>
          <dd>{profile.fullName}</dd>
        </dl>
      )}
      <p className="muted-copy">
        Profile editing is not enabled until an approved persistence contract
        is available.
      </p>
    </section>
  )
}

export default ProfileSummary
