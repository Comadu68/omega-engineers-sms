import React, { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { JobCardDetail } from './JobCardDetail'

export const JobCards = ({ initialSelectedJobId = null, prefillData = null, onNavigateToInvoice }) => {
  const [selectedJobId, setSelectedJobId] = useState(initialSelectedJobId)
  const [jobCards, setJobCards] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all') // 'all', 'pending', 'in_progress', 'completed', 'cancelled'

  // New Job Card Modal
  const [isNewJobModalOpen, setIsNewJobModalOpen] = useState(false)
  const [customers, setCustomers] = useState([])
  const [customerVehicles, setCustomerVehicles] = useState([])
  const [jobForm, setJobForm] = useState({
    customerId: '',
    vehicleId: '',
    appointmentId: null,
    complaint: '',
    serviceDetails: '',
    odometer: '',
    mechanicId: '',
    tasks: [{ description: '', serviceCharge: '' }]
  })
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const filters = { search }
      if (activeFilter !== 'all') {
        filters.status = activeFilter
      }

      const [jobsList, allMechs] = await Promise.all([
        window.omega.jobs.list(filters),
        window.omega.mechanics.list()
      ])
      setJobCards(jobsList)
      setMechanics(allMechs.filter((m) => m.isActive === 1))
    } catch (err) {
      console.error('Failed to load job cards:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedJobId) {
      loadData()
    }
  }, [activeFilter, search, selectedJobId])

  useEffect(() => {
    if (prefillData) {
      openNewJobModalWithPrefill(prefillData)
    }
  }, [prefillData])

  const openNewJobModalWithPrefill = async (prefill) => {
    setFormError('')
    try {
      const custList = await window.omega.customers.list()
      setCustomers(custList)

      let vehList = []
      if (prefill.customerId) {
        vehList = await window.omega.vehicles.list({ customerId: prefill.customerId })
        setCustomerVehicles(vehList)
      }

      setJobForm({
        customerId: prefill.customerId || (custList[0]?.id || ''),
        vehicleId: prefill.vehicleId || (vehList[0]?.id || ''),
        appointmentId: prefill.appointmentId || null,
        complaint: prefill.complaint || '',
        serviceDetails: '',
        odometer: '',
        mechanicId: '',
        tasks: [{ description: '', serviceCharge: '' }]
      })
      setIsNewJobModalOpen(true)
    } catch (err) {
      console.error('Failed to prepare prefilled job form:', err)
    }
  }

  const openNewJobModal = async () => {
    setFormError('')
    try {
      const custList = await window.omega.customers.list()
      setCustomers(custList)
      if (custList.length > 0) {
        const firstCust = custList[0]
        const vehList = await window.omega.vehicles.list({ customerId: firstCust.id })
        setCustomerVehicles(vehList)
        setJobForm({
          customerId: firstCust.id,
          vehicleId: vehList[0]?.id || '',
          appointmentId: null,
          complaint: '',
          serviceDetails: '',
          odometer: '',
          mechanicId: '',
          tasks: [{ description: '', serviceCharge: '' }]
        })
      }
      setIsNewJobModalOpen(true)
    } catch (err) {
      console.error('Failed to prepare new job modal:', err)
    }
  }

  const handleCustomerChange = async (customerId) => {
    setJobForm((prev) => ({ ...prev, customerId, vehicleId: '' }))
    try {
      const vehList = await window.omega.vehicles.list({ customerId })
      setCustomerVehicles(vehList)
      if (vehList.length > 0) {
        setJobForm((prev) => ({ ...prev, vehicleId: vehList[0].id }))
      }
    } catch (err) {
      console.error('Failed to load vehicles:', err)
    }
  }

  const handleAddTaskRow = () => {
    setJobForm((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { description: '', serviceCharge: '' }]
    }))
  }

  const handleTaskChange = (idx, field, val) => {
    setJobForm((prev) => {
      const updated = [...prev.tasks]
      updated[idx][field] = val
      return { ...prev, tasks: updated }
    })
  }

  const handleRemoveTaskRow = (idx) => {
    setJobForm((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== idx)
    }))
  }

  const handleCreateJobCard = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!jobForm.customerId || !jobForm.vehicleId || !jobForm.complaint.trim()) {
      setFormError('Customer, Registered Vehicle, and Complaint / Service Request are required.')
      return
    }

    try {
      setIsSubmitting(true)
      const validTasks = jobForm.tasks.filter((t) => t.description && t.description.trim())
      const newJob = await window.omega.jobs.create({
        ...jobForm,
        tasks: validTasks,
        mechanicId: jobForm.mechanicId ? parseInt(jobForm.mechanicId, 10) : null
      })
      setIsNewJobModalOpen(false)
      setSelectedJobId(newJob.id)
    } catch (err) {
      setFormError(err.message || 'Failed to open job card.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Count stats
  const allCount = jobCards.length
  const pendingCount = jobCards.filter((j) => j.status === 'pending').length
  const inProgressCount = jobCards.filter((j) => j.status === 'in_progress').length
  const completedCount = jobCards.filter((j) => j.status === 'completed').length
  const cancelledCount = jobCards.filter((j) => j.status === 'cancelled').length

  // If a specific job detail is opened
  if (selectedJobId) {
    return (
      <JobCardDetail
        jobId={selectedJobId}
        onBack={() => setSelectedJobId(null)}
        onNavigateToInvoice={onNavigateToInvoice}
      />
    )
  }

  return (
    <div className="content-scrollable">
      {/* Top Toolbar */}
      <div className="toolbar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Job ID, customer, vehicle no..."
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={openNewJobModal}>
          + New Job Card
        </button>
      </div>

      {/* Filter Chips */}
      <div className="toolbar" style={{ marginBottom: '14px' }}>
        <div className="filter-chips">
          <button
            type="button"
            className={`chip ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All Jobs <span className="chip-count">{allCount}</span>
          </button>
          <button
            type="button"
            className={`chip ${activeFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveFilter('pending')}
          >
            Pending <span className="chip-count">{pendingCount}</span>
          </button>
          <button
            type="button"
            className={`chip ${activeFilter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setActiveFilter('in_progress')}
          >
            In Progress <span className="chip-count">{inProgressCount}</span>
          </button>
          <button
            type="button"
            className={`chip ${activeFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveFilter('completed')}
          >
            Completed <span className="chip-count">{completedCount}</span>
          </button>
          <button
            type="button"
            className={`chip ${activeFilter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setActiveFilter('cancelled')}
          >
            Cancelled <span className="chip-count">{cancelledCount}</span>
          </button>
        </div>
      </div>

      {/* Main Job Cards Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading job cards...
          </div>
        ) : jobCards.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No job cards found for this filter. Click "+ New Job Card" to open one.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Job Card ID</th>
                <th>Customer</th>
                <th>Vehicle No &amp; Model</th>
                <th>Service / Issue</th>
                <th>Assigned Mechanic</th>
                <th>Date Opened</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobCards.map((j) => (
                <tr key={j.id}>
                  <td style={{ fontWeight: 800 }}>{j.jobNo}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{j.customerName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{j.customerPhone}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{j.registrationNo}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{j.vehicleMake} {j.vehicleModel}</div>
                  </td>
                  <td style={{ maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {j.complaint}
                  </td>
                  <td>
                    {j.mechanicName ? (
                      <span style={{ fontWeight: 600 }}>{j.mechanicName}</span>
                    ) : (
                      <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {j.openedAt ? j.openedAt.slice(0, 10) : '—'}
                  </td>
                  <td><Badge status={j.status} /></td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedJobId(j.id)}
                    >
                      View Details →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Available Mechanics Panel at Bottom (Master Guide Spec) */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Available Mechanics for Work Assignment</h3>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Quick overview of technicians ready for pending work allocation
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {mechanics.map((m) => (
            <div
              key={m.id}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.specialty}</div>
                <div style={{ fontSize: '11px', marginTop: '2px' }}>
                  Workload: <strong>{m.activeWorkload} active {m.activeWorkload === 1 ? 'job' : 'jobs'}</strong>
                </div>
              </div>
              <Badge status={m.availabilityStatus} />
            </div>
          ))}
        </div>
      </div>

      {/* New Job Card Modal */}
      {isNewJobModalOpen && (
        <Modal
          isOpen={true}
          title="Open New Job Card"
          size="lg"
          onClose={() => setIsNewJobModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsNewJobModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateJobCard}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Opening Job...' : 'Open Job Card →'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateJobCard}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Customer <span className="req">*</span></label>
                <select
                  className="form-select"
                  value={jobForm.customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  required
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Vehicle <span className="req">*</span></label>
                <select
                  className="form-select"
                  value={jobForm.vehicleId}
                  onChange={(e) => setJobForm({ ...jobForm, vehicleId: e.target.value })}
                  required
                  disabled={customerVehicles.length === 0}
                >
                  {customerVehicles.length === 0 ? (
                    <option value="">No vehicles found for customer</option>
                  ) : (
                    customerVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNo} — {v.make} {v.model}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Assign Mechanic</label>
                <select
                  className="form-select"
                  value={jobForm.mechanicId}
                  onChange={(e) => setJobForm({ ...jobForm, mechanicId: e.target.value })}
                >
                  <option value="">-- Assign Later / Unassigned --</option>
                  {mechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.specialty}) • {m.activeWorkload} active {m.activeWorkload === 1 ? 'job' : 'jobs'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Current Odometer (km)</label>
                <input
                  type="number"
                  className="form-input"
                  value={jobForm.odometer}
                  onChange={(e) => setJobForm({ ...jobForm, odometer: e.target.value })}
                  placeholder="e.g. 45000"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Customer Complaint / Service Request <span className="req">*</span></label>
              <textarea
                className="form-textarea"
                rows={2}
                value={jobForm.complaint}
                onChange={(e) => setJobForm({ ...jobForm, complaint: e.target.value })}
                placeholder="Describe vehicle issues, required service items, or symptoms..."
                required
              />
            </div>

            {/* Initial Tasks */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ margin: 0 }}>Initial Service Operations / Tasks</label>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddTaskRow}
                >
                  + Add Row
                </button>
              </div>

              {jobForm.tasks.map((t, idx) => (
                <div key={idx} className="form-row" style={{ marginBottom: '8px' }}>
                  <div style={{ flex: 2 }}>
                    <input
                      type="text"
                      className="form-input"
                      value={t.description}
                      onChange={(e) => handleTaskChange(idx, 'description', e.target.value)}
                      placeholder="e.g. Oil change, Brake pad replacement"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      className="form-input"
                      value={t.serviceCharge}
                      onChange={(e) => handleTaskChange(idx, 'serviceCharge', e.target.value)}
                      placeholder="Labour charge (Rs.)"
                    />
                  </div>
                  {jobForm.tasks.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0 8px' }}
                      onClick={() => handleRemoveTaskRow(idx)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
