import React from 'react'

export const Badge = ({ status, text = null }) => {
  const normalized = status ? String(status).toLowerCase().replace(/\s+/g, '_') : 'unknown'
  const displayText = text || (status ? String(status).replace(/_/g, ' ') : '—')

  return (
    <span className={`badge badge-${normalized}`}>
      {displayText}
    </span>
  )
}
