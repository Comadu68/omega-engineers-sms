import React, { useEffect, useState } from 'react'
import { canAccessModule, getDefaultTabForRole } from './utils/permissions'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { FirstRunSetup } from './pages/FirstRunSetup'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { JobCards } from './pages/JobCards'
import { Appointments } from './pages/Appointments'
import { Inventory } from './pages/Inventory'
import { Suppliers } from './pages/Suppliers'
import { Mechanics } from './pages/Mechanics'
import { Customers } from './pages/Customers'
import { Invoices } from './pages/Invoices'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'

export default function App() {
  const [isFirstRun, setIsFirstRun] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')

  // Cross-screen contextual state
  const [jobCardPrefill, setJobCardPrefill] = useState(null)
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)
  const [inventoryPrefillReceive, setInventoryPrefillReceive] = useState(null)

  const checkInitialStatus = async () => {
    try {
      const firstRun = await window.omega.auth.isFirstRun()
      setIsFirstRun(firstRun)
    } catch (err) {
      console.error('Failed to check first run:', err)
      setIsFirstRun(false)
    }
  }

  useEffect(() => {
    checkInitialStatus()
  }, [])

  const userRole = currentUser?.role || ''

  // Fallback if current activeTab is unauthorized for the logged-in user
  useEffect(() => {
    if (currentUser && !canAccessModule(currentUser.role, activeTab)) {
      setActiveTab(getDefaultTabForRole(currentUser.role))
    }
  }, [currentUser, activeTab])

  const handleLogout = async () => {
    try {
      if (window.omega?.auth?.logout) {
        await window.omega.auth.logout()
      }
    } catch (err) {
      console.error('Failed to logout:', err)
    } finally {
      setCurrentUser(null)
      setActiveTab('dashboard')
      setSelectedJobId(null)
      setSelectedInvoiceId(null)
      setJobCardPrefill(null)
    }
  }

  const handleNavigate = (tabId, params = {}) => {
    if (currentUser && !canAccessModule(currentUser.role, tabId)) {
      return
    }
    setActiveTab(tabId)
    if (params.selectedJobId) {
      setSelectedJobId(params.selectedJobId)
    }
    if (params.selectedInvoiceId) {
      setSelectedInvoiceId(params.selectedInvoiceId)
    }
    if (params.receiveItem) {
      setInventoryPrefillReceive(params.receiveItem)
    }
  }

  const handleOpenJobWithPrefill = (prefill) => {
    if (currentUser && !canAccessModule(currentUser.role, 'jobcards')) {
      return
    }
    setJobCardPrefill(prefill)
    setSelectedJobId(null)
    setActiveTab('jobcards')
  }

  const handleQuickAction = (actionType) => {
    if (actionType === 'new_job') {
      if (!canAccessModule(userRole, 'jobcards')) return
      setSelectedJobId(null)
      setJobCardPrefill({
        customerId: '',
        vehicleId: '',
        complaint: ''
      })
      setActiveTab('jobcards')
    } else if (actionType === 'new_appointment') {
      if (!canAccessModule(userRole, 'appointments')) return
      setActiveTab('appointments')
    }
  }

  // 1. First run setup wizard if database is empty
  if (isFirstRun === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Initializing Omega Engineers Desktop Application...</p>
      </div>
    )
  }

  if (isFirstRun) {
    return (
      <FirstRunSetup
        onSetupComplete={(user) => {
          setIsFirstRun(false)
          setCurrentUser(user)
          setActiveTab(getDefaultTabForRole(user?.role))
        }}
      />
    )
  }

  // 2. Login screen if not authenticated
  if (!currentUser) {
    return (
      <Login
        onLoginSuccess={(user) => {
          setCurrentUser(user)
          setActiveTab(getDefaultTabForRole(user?.role))
        }}
      />
    )
  }

  // 3. Main App Layout & Screen Routing
  const getScreenTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard Overview'
      case 'jobcards': return 'Digital Job Cards & Repair Tasks'
      case 'appointments': return 'Service Appointments & Capacity Calendar'
      case 'inventory': return 'Spare Parts Inventory & Stock Batches'
      case 'suppliers': return 'Spare Parts Suppliers & Vendor Directory'
      case 'mechanics': return 'Technicians & Workshop Workload Roster'
      case 'customers': return 'Customer & Vehicle Records'
      case 'invoices': return 'Billing, Invoices & Reminder Stickers'
      case 'reports': return 'Financial & Management Performance Reports'
      case 'settings': return 'System Settings & Maintenance'
      default: return 'Omega Engineers'
    }
  }

  const getScreenSubtitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Real-time operational summary of workshop activities'
      case 'jobcards': return 'Track repair stages, technician allocation, and FIFO parts consumption'
      case 'appointments': return 'Monthly calendar booking view with capacity control and slot conflict prevention'
      case 'inventory': return 'Batch-based stock receiving, low-stock threshold alerts, and valuation'
      case 'suppliers': return 'Maintain supplier contact records, credit/supply notes, and review purchase volume'
      case 'mechanics': return 'Technician availability, specialties, and active job assignments'
      case 'customers': return 'Owner records, registered vehicles, and service history'
      case 'invoices': return 'Itemized bills, partial/full payments, and printable service windshield stickers'
      case 'reports': return 'Daily revenue, FIFO parts COGS, expenses, and net profit analytics'
      case 'settings': return 'Workshop configuration, local database backups, disaster recovery, and staff accounts'
      default: return ''
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab)
          setSelectedJobId(null)
          setSelectedInvoiceId(null)
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="main-area">
        <Topbar
          title={getScreenTitle()}
          subtitle={getScreenSubtitle()}
          onQuickAction={handleQuickAction}
          currentUser={currentUser}
        />

        {!canAccessModule(userRole, activeTab) ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>Access Restricted</h2>
            <p style={{ fontSize: '14px', maxWidth: '480px', margin: '0 auto' }}>
              Your user role (<strong>{userRole ? userRole.replace(/_/g, ' ') : 'Guest'}</strong>) does not have permission to view the <strong>{getScreenTitle()}</strong> module.
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                onNavigate={handleNavigate}
                onOpenNewJob={handleOpenJobWithPrefill}
                onOpenNewAppointment={() => {
                  if (canAccessModule(userRole, 'appointments')) {
                    setActiveTab('appointments')
                  }
                }}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'jobcards' && (
              <JobCards
                initialSelectedJobId={selectedJobId}
                prefillData={jobCardPrefill}
                onNavigateToInvoice={(invId) => {
                  if (canAccessModule(userRole, 'invoices')) {
                    setSelectedInvoiceId(invId)
                    setActiveTab('invoices')
                  }
                }}
              />
            )}

            {activeTab === 'appointments' && (
              <Appointments
                onOpenJobCardWithDetails={handleOpenJobWithPrefill}
              />
            )}

            {activeTab === 'inventory' && (
              <Inventory
                prefillReceiveItem={inventoryPrefillReceive}
              />
            )}

            {activeTab === 'suppliers' && (
              <Suppliers />
            )}

            {activeTab === 'mechanics' && (
              <Mechanics
                onNavigateToJob={(jId) => {
                  setSelectedJobId(jId)
                  setActiveTab('jobcards')
                }}
              />
            )}

            {activeTab === 'customers' && (
              <Customers
                onNavigateToJob={(jId) => {
                  setSelectedJobId(jId)
                  setActiveTab('jobcards')
                }}
              />
            )}

            {activeTab === 'invoices' && (
              <Invoices
                initialSelectedInvoiceId={selectedInvoiceId}
              />
            )}

            {activeTab === 'reports' && (
              <Reports />
            )}

            {activeTab === 'settings' && (
              <Settings
                currentUser={currentUser}
                onDatabaseRestored={() => {
                  checkInitialStatus()
                  setActiveTab('dashboard')
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
