import React from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Package,
  Wrench,
  Car,
  Receipt,
  BarChart3,
  Settings,
  LogOut
} from 'lucide-react'
import { canAccessModule } from '../utils/permissions'

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'jobcards', label: 'Job Cards', icon: ClipboardList },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'mechanics', label: 'Mechanics', icon: Wrench },
  { id: 'customers', label: 'Customers', icon: Car },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings }
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
    return role
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const userRole = currentUser?.role || ''
  const visibleNavItems = NAV_ITEMS.filter((item) => canAccessModule(userRole, item.id))

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
        {visibleNavItems.map((item) => {
          const IconComponent = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              <span className="nav-item-icon">
                <IconComponent size={18} />
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
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
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
