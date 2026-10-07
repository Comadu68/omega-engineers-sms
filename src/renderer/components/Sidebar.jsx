import React from 'react'

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'jobcards', label: 'Job Cards', icon: '📋' },
  { id: 'appointments', label: 'Appointments', icon: '📅' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'mechanics', label: 'Mechanics', icon: '🔧' },
  { id: 'customers', label: 'Customers', icon: '👥' },
  { id: 'invoices', label: 'Invoices', icon: '💳' },
  { id: 'reports', label: 'Reports', icon: '📈' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
]

export const Sidebar = ({ activeTab, onSelectTab, currentUser, onLogout }) => {
  const getInitials = (name) => {
    if (!name) return 'OE'
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  const formatRole = (role) => {
    if (!role) return ''
    return role.replace(/_/g, ' ')
  }

  return (
    <aside className="sidebar">
      <div className="brand-section">
        <img
          src="/assets/logo/sidebar-logo.png"
          alt="Omega Engineers"
          className="brand-logo-img"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            if (e.currentTarget.nextSibling) {
              e.currentTarget.nextSibling.style.display = 'block'
            }
          }}
        />
        <div className="brand-text-fallback" style={{ display: 'none' }}>
          <div className="brand-text-title">OMEGA ENGINEERS</div>
          <div className="brand-text-subtitle">SERVICE STATION</div>
        </div>
      </div>

      <nav>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onSelectTab(item.id)}
          >
            <span className="nav-item-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {currentUser && (
          <div className="user-badge">
            <div className="user-avatar">{getInitials(currentUser.displayName)}</div>
            <div className="user-info">
              <div className="user-name">{currentUser.displayName}</div>
              <div className="user-role">{formatRole(currentUser.role)}</div>
            </div>
          </div>
        )}
        <button type="button" className="logout-btn" onClick={onLogout}>
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
