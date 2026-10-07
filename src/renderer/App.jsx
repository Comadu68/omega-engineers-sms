import React, { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { FirstRunSetup } from './pages/FirstRunSetup'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { JobCards } from './pages/JobCards'
import { Appointments } from './pages/Appointments'
import { Inventory } from './pages/Inventory'
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

  const handleLogout = () => {
    setCurrentUser(null)
    setActiveTab('dashboard')
    setSelectedJobId(null)
    setSelectedInvoiceId(null)
    setJobCardPrefill(null)
  }

  const handleNavigate = (tabId, params = {}) => {
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
    setJobCardPrefill(prefill)
    setSelectedJobId(null)
    setActiveTab('jobcards')
  }

  const handleQuickAction = (actionType) => {
    if (actionType === 'new_job') {
      setSelectedJobId(null)
      setJobCardPrefill({
        customerId: '',
        vehicleId: '',
        complaint: ''
      })
      setActiveTab('jobcards')
    } else if (actionType === 'new_appointment') {
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
        />

        {activeTab === 'dashboard' && (
          <Dashboard
            onNavigate={handleNavigate}
            onOpenNewJob={handleOpenJobWithPrefill}
            onOpenNewAppointment={() => setActiveTab('appointments')}
          />
        )}

        {activeTab === 'jobcards' && (
          <JobCards
            initialSelectedJobId={selectedJobId}
            prefillData={jobCardPrefill}
            onNavigateToInvoice={(invId) => {
              setSelectedInvoiceId(invId)
              setActiveTab('invoices')
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
      </main>
    </div>
  )
}
