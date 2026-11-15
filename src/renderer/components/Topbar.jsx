import React from 'react'
import { canAccessModule } from '../utils/permissions'

export const Topbar = ({ title, subtitle, onQuickAction, currentUser }) => {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const userRole = currentUser?.role || ''

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
            {canAccessModule(userRole, 'jobcards') && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onQuickAction('new_job')}
              >
                + New Job Card
              </button>
            )}
            {canAccessModule(userRole, 'appointments') && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onQuickAction('new_appointment')}
              >
                + New Appointment
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
