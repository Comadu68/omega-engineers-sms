import React from 'react'

export const Topbar = ({ title, subtitle, onQuickAction }) => {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div>
          <h1 className="topbar-title">{title}</h1>
          {subtitle && <div className="topbar-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="topbar-right">
        <div className="topbar-date">📅 {today}</div>
        {onQuickAction && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onQuickAction('new_job')}
            >
              + New Job Card
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onQuickAction('new_appointment')}
            >
              + New Appointment
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
