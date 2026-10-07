import React, { useState } from 'react'

export const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }

    try {
      setIsSubmitting(true)
      const user = await window.omega.auth.login({
        username: username.trim(),
        password
      })
      onLoginSuccess(user)
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
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
          maxWidth: '400px',
          background: '#FFFFFF',
          borderRadius: '18px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.28)',
          padding: '38px 32px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/assets/logo/sidebar-logo.png"
            alt="Omega Engineers"
            style={{ maxWidth: '180px', maxHeight: '56px', objectFit: 'contain', marginBottom: '12px' }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: 'var(--text-main)', fontWeight: 800 }}>
            OMEGA ENGINEERS
          </h2>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '1px' }}>
            SERVICE STATION MANAGEMENT SYSTEM
          </div>
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
              marginBottom: '18px'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: '42px', marginTop: '12px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '22px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}
        >
          <span>Offline Desktop Edition</span>
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  )
}
