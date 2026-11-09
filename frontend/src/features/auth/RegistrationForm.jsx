import { useState } from "react"
import "./RegistrationForm.css"
function RegistrationForm({
  initialEmail = "",
  loading,
  error,
  onSubmit,
  onLogout,
}) {
  const [fullName, setFullName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [email, setEmail] = useState(initialEmail)

  const handleSubmit = async (event) => {
    event.preventDefault()
    console.log("REGISTRATION FORM SUBMITTED")

    await onSubmit({
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      email: email.trim(),
    })
  }

  return (
    <main className="registration-shell">
      <div className="registration-card">
        <div className="brand">
          <span className="brand-symbol">S</span>
          <span>
            SHGT<span className="brand-dot">.</span>
          </span>
        </div>

        <div className="card-eyebrow">MEMBER REGISTRATION</div>

        <h1>Complete your SHGT profile</h1>

        <p>
          Your Privy identity has been authenticated. Add your basic
          details to create your SHGT member account.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="fullName">Full name *</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            minLength={2}
            maxLength={150}
            autoComplete="name"
            required
            disabled={loading}
          />

          <label htmlFor="phoneNumber">Phone number *</label>
          <input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+919876543210"
            autoComplete="tel"
            minLength={10}
            required
            disabled={loading}
          />

          <label htmlFor="email">Contact email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Optional"
            maxLength={254}
            autoComplete="email"
            disabled={loading}
          />

          {error && (
            <p className="registration-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={
              loading ||
              fullName.trim().length < 2 ||
              phoneNumber.trim().length < 10 ||
              (email.trim() !== "" &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))

            }
          >
            {loading ? "Creating your account..." : "Complete registration"}
          </button>
        </form>

        <div className="registration-notice">
          <strong>What happens next?</strong>
          <p>
            Your SHGT account will be created as ACTIVE, while your
            identity verification starts as PENDING.
          </p>
          <p>
            Financial services requiring KYC or SHG membership
            authorization remain unavailable until their respective
            requirements are satisfied.
          </p>
        </div>

        <button className="logout-button" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </main>
  )
}

console.log("RegistrationForm rendered")
export default RegistrationForm
