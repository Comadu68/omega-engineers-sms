export const MODULE_PERMISSIONS = {
  dashboard: ['admin_owner', 'receptionist_service_advisor', 'mechanic', 'inventory_billing'],
  jobcards: ['admin_owner', 'receptionist_service_advisor', 'mechanic', 'inventory_billing'],
  appointments: ['admin_owner', 'receptionist_service_advisor'],
  customers: ['admin_owner', 'receptionist_service_advisor', 'inventory_billing'],
  inventory: ['admin_owner', 'inventory_billing'],
  mechanics: ['admin_owner', 'receptionist_service_advisor', 'mechanic'],
  invoices: ['admin_owner', 'inventory_billing'],
  reports: ['admin_owner'],
  settings: ['admin_owner', 'receptionist_service_advisor', 'mechanic', 'inventory_billing'] // Non-admins only see "Change Password"
}

export const canAccessModule = (role, moduleId) => {
  if (!role) return false
  if (role === 'admin_owner') return true
  const allowed = MODULE_PERMISSIONS[moduleId] || []
  return allowed.includes(role)
}

export const getDefaultTabForRole = (role) => {
  switch (role) {
    case 'mechanic':
      return 'jobcards'
    case 'inventory_billing':
      return 'inventory'
    case 'receptionist_service_advisor':
      return 'appointments'
    default:
      return 'dashboard'
  }
}
