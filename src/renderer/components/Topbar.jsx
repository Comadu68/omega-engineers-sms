import React from 'react'
import { Calendar, Plus } from 'lucide-react'
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
        <div className="topbar-date" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} />
          <span>{today}</span>
        </div>
        {onQuickAction && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {canAccessModule(userRole, 'jobcards') && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onQuickAction('new_job')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} />
                <span>New Job Card</span>
              </button>
            )}
            {canAccessModule(userRole, 'appointments') && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onQuickAction('new_appointment')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} />
                <span>New Appointment</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
