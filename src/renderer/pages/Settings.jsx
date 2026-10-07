import React, { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { Badge } from '../components/Badge'

export const Settings = ({ currentUser, onDatabaseRestored }) => {
  const [settings, setSettings] = useState({
    station_name: 'Omega Engineers Service Station',
    company_name: 'Solotrade Company',
    station_address: '123 Galle Road, Colombo',
    station_phone: '011 234 5678',
    currency_symbol: 'Rs.',
    appointment_daily_capacity: '8',
    auto_backup_on_exit: 'false'
  })

  const [backups, setBackups] = useState([])
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')

  // User Management Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({
    username: '',
    displayName: '',
    role: 'receptionist_service_advisor',
    password: ''
  })
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null)

  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadSettingsData = async () => {
    try {
      setLoading(true)
      const [allSettings, allBackups, allUsers, logs] = await Promise.all([
        window.omega.settings.getAll(),
        window.omega.backup.list(),
        window.omega.auth.getUsers(),
        window.omega.settings.getAuditLogs({ limit: 30 })
      ])
      setSettings(allSettings)
      setBackups(allBackups)
      setUsers(allUsers)
      setAuditLogs(logs)
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettingsData()
  }, [])

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSaveSuccess(false)
    try {
      await window.omega.settings.updateMultiple(settings)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      alert(err.message || 'Failed to save settings.')
    }
  }

  const handleCreateBackup = async () => {
    setBackupMessage('')
    try {
      const res = await window.omega.backup.create()
      setBackupMessage(`✓ Backup successfully created: ${res.fileName}`)
      const updatedBackups = await window.omega.backup.list()
      setBackups(updatedBackups)
    } catch (err) {
      alert(err.message || 'Failed to create database backup.')
    }
  }

  const handleOpenBackupFolder = async () => {
    try {
      await window.omega.backup.openFolder()
    } catch (err) {
      alert(err.message || 'Failed to open backup folder.')
    }
  }

  const handleRestoreFromFile = async (filePath = null) => {
    try {
      let targetPath = filePath
      if (!targetPath) {
        targetPath = await window.omega.backup.selectFile()
      }
      if (!targetPath) return

      if (window.confirm(`Restore database from "${targetPath}"? A safety backup of your current database will be saved before restoring.`)) {
        const res = await window.omega.backup.restore(targetPath)
        if (res.success && res.integrityOk) {
          alert('✓ Database successfully restored and integrity verified! The application data will now refresh.')
          if (onDatabaseRestored) {
            onDatabaseRestored()
          } else {
            window.location.reload()
          }
        } else {
          alert('Database restored with warnings. Please verify data integrity.')
        }
      }
    } catch (err) {
      alert(`Restore failed: ${err.message}`)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!userForm.username.trim() || !userForm.displayName.trim() || !userForm.password) {
      setFormError('All fields are required.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.auth.createUser({
        username: userForm.username.trim(),
        displayName: userForm.displayName.trim(),
        role: userForm.role,
        password: userForm.password
      })
      setIsAddUserOpen(false)
      setUserForm({ username: '', displayName: '', role: 'receptionist_service_advisor', password: '' })
      const allUsers = await window.omega.auth.getUsers()
      setUsers(allUsers)
    } catch (err) {
      setFormError(err.message || 'Failed to create user.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    setFormError('')
    try {
      setIsSubmitting(true)
      await window.omega.auth.updateUser(editingUser.id, {
        displayName: userForm.displayName.trim(),
        role: userForm.role,
        isActive: userForm.isActive
      })
      setEditingUser(null)
      const allUsers = await window.omega.auth.getUsers()
      setUsers(allUsers)
    } catch (err) {
      setFormError(err.message || 'Failed to update user.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 4) {
      setFormError('Password must be at least 4 characters long.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.auth.changePassword(selectedUserForPassword.id, passwordForm.newPassword)
      setIsPasswordModalOpen(false)
      setSelectedUserForPassword(null)
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      alert('✓ Password updated successfully.')
    } catch (err) {
      setFormError(err.message || 'Failed to change password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  return (
    <div className="content-scrollable">
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>System Settings &amp; Maintenance</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Service station configuration, automated database backups, user accounts, and security audit log.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Left Column: Workshop Settings & Backups */}
        <div>
          {/* General Station Settings */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">General Service Station Information</h3>
            </div>

            {saveSuccess && (
              <div style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
                ✓ Settings saved successfully.
              </div>
            )}

            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label className="form-label">Service Station Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.station_name || ''}
                  onChange={(e) => setSettings({ ...settings, station_name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Company / Entity Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.company_name || ''}
                    onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Station Contact Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.station_phone || ''}
                    onChange={(e) => setSettings({ ...settings, station_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Station Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.station_address || ''}
                  onChange={(e) => setSettings({ ...settings, station_address: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Daily Appointment Capacity</label>
                  <input
                    type="number"
                    className="form-input"
                    value={settings.appointment_daily_capacity || '8'}
                    onChange={(e) => setSettings({ ...settings, appointment_daily_capacity: e.target.value })}
                  />
                  <div className="form-help">Maximum booking slots per day before date is marked full.</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Currency Symbol</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settings.currency_symbol || 'Rs.'}
                    onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={settings.auto_backup_on_exit === 'true' || settings.auto_backup_on_exit === true}
                    onChange={(e) => setSettings({ ...settings, auto_backup_on_exit: String(e.target.checked) })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>Create automatic database backup on application close</span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary">
                Save Station Settings
              </button>
            </form>
          </div>

          {/* Database Backup & Restore */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Database Backup &amp; Disaster Recovery</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Backups stored in: Documents/Omega Engineers Backups/
                </div>
              </div>
            </div>

            {backupMessage && (
              <div style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
                {backupMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={handleCreateBackup}>
                💾 Create Backup Now
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => handleRestoreFromFile()}>
                📂 Restore from File...
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleOpenBackupFolder}>
                🗀 Open Backups Folder
              </button>
            </div>

            {/* Backups List */}
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
              Available Snapshot Backups ({backups.length})
            </div>

            {backups.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', padding: '12px', background: 'var(--bg-main)', borderRadius: '6px' }}>
                No backups created yet. Click "Create Backup Now" to safeguard your data.
              </p>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Backup File</th>
                      <th>Size</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, fontSize: '12px' }}>{b.fileName}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{formatFileSize(b.sizeBytes)}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{b.createdAt.slice(0, 16).replace('T', ' ')}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '2px 6px' }}
                            onClick={() => handleRestoreFromFile(b.filePath)}
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: User Management & Security Log */}
        <div>
          {/* Staff User Accounts */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Staff User Management</h3>
              {currentUser?.role === 'admin_owner' && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setFormError('')
                    setUserForm({ username: '', displayName: '', role: 'receptionist_service_advisor', password: '' })
                    setIsAddUserOpen(true)
                  }}
                >
                  + Add User
                </button>
              )}
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{u.displayName}</div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.username}</td>
                    <td>
                      <span style={{ fontSize: '11px', textTransform: 'capitalize', fontWeight: 600, color: 'var(--primary)' }}>
                        {u.role ? u.role.replace(/_/g, ' ') : ''}
                      </span>
                    </td>
                    <td>
                      <Badge
                        status={u.isActive ? 'available' : 'off_duty'}
                        text={u.isActive ? 'Active' : 'Inactive'}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 6px', fontSize: '11px' }}
                          onClick={() => {
                            setSelectedUserForPassword(u)
                            setPasswordForm({ newPassword: '', confirmPassword: '' })
                            setIsPasswordModalOpen(true)
                          }}
                        >
                          🔑 Key
                        </button>
                        {currentUser?.role === 'admin_owner' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', fontSize: '11px' }}
                            onClick={() => {
                              setEditingUser(u)
                              setUserForm({
                                displayName: u.displayName,
                                role: u.role,
                                isActive: u.isActive
                              })
                            }}
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Audit Trail Log */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Security &amp; Action Audit Log</h3>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {auditLogs.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px' }}>
                  No recent audit log actions.
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                          {log.createdAt ? log.createdAt.slice(0, 16).replace('T', ' ') : ''}
                        </td>
                        <td style={{ fontWeight: 600, fontSize: '11px' }}>{log.displayName || log.username || 'System'}</td>
                        <td>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)' }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {log.entityType} #{log.entityId}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <Modal
          isOpen={true}
          title="Add Staff User Account"
          onClose={() => setIsAddUserOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddUserOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateUser}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateUser}>
            <div className="form-group">
              <label className="form-label">Full Display Name <span className="req">*</span></label>
              <input
                type="text"
                className="form-input"
                value={userForm.displayName}
                onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
                placeholder="e.g. Kasun Silva"
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username <span className="req">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="e.g. kasun"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role Access Level <span className="req">*</span></label>
                <select
                  className="form-select"
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="admin_owner">Administrator / Owner</option>
                  <option value="receptionist_service_advisor">Receptionist / Service Advisor</option>
                  <option value="mechanic">Mechanic</option>
                  <option value="inventory_billing">Inventory / Billing Staff</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Initial Password <span className="req">*</span></label>
              <input
                type="password"
                className="form-input"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="Enter account password"
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <Modal
          isOpen={true}
          title={`Edit User: ${editingUser.displayName}`}
          onClose={() => setEditingUser(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingUser(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpdateUser}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Update Account'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleUpdateUser}>
            <div className="form-group">
              <label className="form-label">Full Display Name <span className="req">*</span></label>
              <input
                type="text"
                className="form-input"
                value={userForm.displayName}
                onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Role Access Level</label>
                <select
                  className="form-select"
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="admin_owner">Administrator / Owner</option>
                  <option value="receptionist_service_advisor">Receptionist / Service Advisor</option>
                  <option value="mechanic">Mechanic</option>
                  <option value="inventory_billing">Inventory / Billing Staff</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Account Status</label>
                <select
                  className="form-select"
                  value={userForm.isActive}
                  onChange={(e) => setUserForm({ ...userForm, isActive: parseInt(e.target.value, 10) })}
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive / Suspended</option>
                </select>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Change Password Modal */}
      {isPasswordModalOpen && selectedUserForPassword && (
        <Modal
          isOpen={true}
          title={`Change Password for: ${selectedUserForPassword.displayName}`}
          onClose={() => {
            setIsPasswordModalOpen(false)
            setSelectedUserForPassword(null)
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsPasswordModalOpen(false)
                  setSelectedUserForPassword(null)
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleChangePassword}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">New Password <span className="req">*</span></label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Enter new password"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password <span className="req">*</span></label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Repeat new password"
                required
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
