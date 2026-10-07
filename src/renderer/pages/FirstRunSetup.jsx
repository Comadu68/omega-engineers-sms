import React, { useState } from 'react'

export const FirstRunSetup = ({ onSetupComplete }) => {
  const [displayName, setDisplayName] = useState('Service Station Manager')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!displayName.trim() || !username.trim() || !password) {
      setError('Please fill in all required fields.')
      return
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setIsSubmitting(true)
      const user = await window.omega.auth.setupAdmin({
        displayName: displayName.trim(),
        username: username.trim(),
        password
      })
      onSetupComplete(user)
    } catch (err) {
      setError(err.message || 'Failed to complete initial setup.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, #1C3150 0%, #000A31 100%)',
        padding: '24px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#FFFFFF',
          borderRadius: '18px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.28)',
          padding: '36px 32px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'var(--primary)',
              color: 'white',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              marginBottom: '12px'
            }}
          >
            🛡️
          </div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', color: 'var(--text-main)' }}>
            Initial System Setup
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            Create your primary Owner / Administrator account to initialize Omega Engineers Service Station.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              border: '1px solid rgba(227, 87, 87, 0.3)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              marginBottom: '16px'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Full Name / Display Name <span className="req">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Service Station Owner"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Username <span className="req">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Password <span className="req">*</span>
            </label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter secure password"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Confirm Password <span className="req">*</span>
            </label>
            <input
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: '42px', marginTop: '10px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Configuring System...' : 'Initialize & Launch System →'}
          </button>
        </form>
      </div>
    </div>
  )
}
