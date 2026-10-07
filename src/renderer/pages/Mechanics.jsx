import React, { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { Badge } from '../components/Badge'

export const Mechanics = ({ onNavigateToJob }) => {
  const [mechanics, setMechanics] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMechanic, setSelectedMechanic] = useState(null)

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingMechanic, setEditingMechanic] = useState(null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    specialty: 'Engine & Transmission',
    availabilityStatus: 'available'
  })
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadMechanics = async () => {
    try {
      setLoading(true)
      const list = await window.omega.mechanics.list()
      setMechanics(list)
    } catch (err) {
      console.error('Failed to load mechanics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMechanics()
  }, [])

  const openMechanicDetail = async (id) => {
    try {
      const data = await window.omega.mechanics.get(id)
      setSelectedMechanic(data)
    } catch (err) {
      console.error('Failed to load mechanic detail:', err)
    }
  }

  const handleCreateMechanic = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) {
      setFormError('Mechanic name is required.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.mechanics.create(form)
      setIsAddModalOpen(false)
      setForm({ name: '', phone: '', specialty: 'Engine & Transmission', availabilityStatus: 'available' })
      loadMechanics()
    } catch (err) {
      setFormError(err.message || 'Failed to create mechanic.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateMechanic = async (e) => {
    e.preventDefault()
    setFormError('')
    try {
      setIsSubmitting(true)
      await window.omega.mechanics.update(editingMechanic.id, form)
      setEditingMechanic(null)
      loadMechanics()
      if (selectedMechanic && selectedMechanic.id === editingMechanic.id) {
        openMechanicDetail(editingMechanic.id)
      }
    } catch (err) {
      setFormError(err.message || 'Failed to update mechanic.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickStatusChange = async (id, newStatus) => {
    try {
      await window.omega.mechanics.updateStatus(id, newStatus)
      loadMechanics()
      if (selectedMechanic && selectedMechanic.id === id) {
        openMechanicDetail(id)
      }
    } catch (err) {
      alert(err.message || 'Failed to update status.')
    }
  }

  return (
    <div className="content-scrollable">
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Mechanic Workshop Roster</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Track technician availability, current active assignments, and workload capacity.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setFormError('')
            setForm({ name: '', phone: '', specialty: 'Engine & Transmission', availabilityStatus: 'available' })
            setIsAddModalOpen(true)
          }}
        >
          + Register New Mechanic
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading mechanics roster...
        </div>
      ) : mechanics.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No mechanics registered yet. Click "+ Register New Mechanic" to add workshop staff.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {mechanics.map((m) => {
            const isBusy = m.activeWorkload >= 2
            return (
              <div
                key={m.id}
                className="card"
                style={{
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${
                    m.availabilityStatus === 'available'
                      ? 'var(--success)'
                      : m.availabilityStatus === 'busy'
                      ? 'var(--warning)'
                      : '#9CA3AF'
                  }`
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: 800 }}>
                        {m.name}
                      </h3>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
                        {m.specialty}
                      </div>
                    </div>
                    <Badge status={m.availabilityStatus} />
                  </div>

                  <div style={{ margin: '14px 0', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>📞 Phone: <strong>{m.phone || '—'}</strong></div>
                    <div>
                      ⚡ Current Workload:{' '}
                      <strong style={{ color: isBusy ? 'var(--warning)' : 'var(--text-main)' }}>
                        {m.activeWorkload} {m.activeWorkload === 1 ? 'active job' : 'active jobs'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <select
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '11px', width: 'auto' }}
                      value={m.availabilityStatus}
                      onChange={(e) => handleQuickStatusChange(m.id, e.target.value)}
                    >
                      <option value="available">🟢 Available</option>
                      <option value="busy">🟡 Busy</option>
                      <option value="off_duty">⚪ Off Duty</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openMechanicDetail(m.id)}
                    >
                      View Assigned Jobs →
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingMechanic(m)
                        setForm({
                          name: m.name,
                          phone: m.phone || '',
                          specialty: m.specialty || '',
                          availabilityStatus: m.availabilityStatus
                        })
                      }}
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Mechanic Detail Modal */}
      {selectedMechanic && (
        <Modal
          isOpen={true}
          title={`Technician Profile: ${selectedMechanic.name}`}
          size="lg"
          onClose={() => setSelectedMechanic(null)}
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedMechanic(null)}
            >
              Close
            </button>
          }
        >
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px', padding: '14px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>SPECIALTY</div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{selectedMechanic.specialty}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>PHONE</div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{selectedMechanic.phone || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>STATUS</div>
                <div><Badge status={selectedMechanic.availabilityStatus} /></div>
              </div>
            </div>

            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700 }}>
              Active Assigned Job Cards ({selectedMechanic.assignedJobs?.length || 0})
            </h4>

            {selectedMechanic.assignedJobs?.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', background: '#FAFBFD', padding: '16px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                No active jobs currently assigned to this mechanic.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Vehicle</th>
                    <th>Customer</th>
                    <th>Complaint / Issue</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMechanic.assignedJobs.map((j) => (
                    <tr key={j.id}>
                      <td style={{ fontWeight: 700 }}>{j.jobNo}</td>
                      <td style={{ fontWeight: 600 }}>{j.registrationNo} ({j.vehicleModel})</td>
                      <td>{j.customerName}</td>
                      <td>{j.complaint}</td>
                      <td><Badge status={j.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}

      {/* Add / Edit Mechanic Modal */}
      {(isAddModalOpen || editingMechanic) && (
        <Modal
          isOpen={true}
          title={editingMechanic ? 'Edit Mechanic Information' : 'Register New Mechanic'}
          onClose={() => {
            setIsAddModalOpen(false)
            setEditingMechanic(null)
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsAddModalOpen(false)
                  setEditingMechanic(null)
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={editingMechanic ? handleUpdateMechanic : handleCreateMechanic}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (editingMechanic ? 'Update Mechanic' : 'Register Mechanic')}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={editingMechanic ? handleUpdateMechanic : handleCreateMechanic}>
            <div className="form-group">
              <label className="form-label">Mechanic Name <span className="req">*</span></label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. S. Kumara, R. Bandara"
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 071 234 5678"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Specialty / Skill Area</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  placeholder="e.g. Engine Overhaul, Brake Specialist, Auto Electrical"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Current Availability Status</label>
              <select
                className="form-select"
                value={form.availabilityStatus}
                onChange={(e) => setForm({ ...form, availabilityStatus: e.target.value })}
              >
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="off_duty">Off Duty</option>
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
