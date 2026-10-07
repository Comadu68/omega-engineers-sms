import React, { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'

export const JobCardDetail = ({ jobId, onBack, onNavigateToInvoice }) => {
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mechanics, setMechanics] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])

  // Modal states
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [isAddPartOpen, setIsAddPartOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [isGenerateInvoiceOpen, setIsGenerateInvoiceOpen] = useState(false)

  // Forms
  const [taskForm, setTaskForm] = useState({ description: '', serviceCharge: '', note: '' })
  const [partForm, setPartForm] = useState({ inventoryItemId: '', qty: '1', sellingPriceOverride: '' })
  const [cancellationReason, setCancellationReason] = useState('')
  const [invoiceDiscount, setInvoiceDiscount] = useState('0')

  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadJob = async () => {
    try {
      setLoading(true)
      const [jobData, mechs, items] = await Promise.all([
        window.omega.jobs.get(jobId),
        window.omega.mechanics.list(),
        window.omega.inventory.list()
      ])
      setJob(jobData)
      setMechanics(mechs.filter((m) => m.isActive === 1))
      setInventoryItems(items.filter((i) => i.isActive === 1))
      if (items.length > 0) {
        setPartForm((prev) => ({
          ...prev,
          inventoryItemId: items[0].id,
          sellingPriceOverride: items[0].currentSellingPrice
        }))
      }
    } catch (err) {
      console.error('Failed to load job details:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJob()
  }, [jobId])

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'cancelled') {
      setCancellationReason('')
      setIsCancelModalOpen(true)
      return
    }

    try {
      await window.omega.jobs.updateStatus(job.id, newStatus)
      loadJob()
    } catch (err) {
      alert(err.message || 'Failed to update status.')
    }
  }

  const handleConfirmCancel = async (e) => {
    e.preventDefault()
    if (!cancellationReason.trim()) {
      setFormError('Please enter a reason for cancelling this job card.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.jobs.updateStatus(job.id, 'cancelled', cancellationReason.trim())
      setIsCancelModalOpen(false)
      loadJob()
    } catch (err) {
      setFormError(err.message || 'Failed to cancel job card.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAssignMechanic = async (mechanicId) => {
    try {
      await window.omega.jobs.assignMechanic(job.id, mechanicId ? parseInt(mechanicId, 10) : null)
      loadJob()
    } catch (err) {
      alert(err.message || 'Failed to assign mechanic.')
    }
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!taskForm.description.trim()) {
      setFormError('Task description is required.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.jobs.addTask(job.id, {
        description: taskForm.description.trim(),
        serviceCharge: parseFloat(taskForm.serviceCharge) || 0,
        note: taskForm.note.trim()
      })
      setIsAddTaskOpen(false)
      setTaskForm({ description: '', serviceCharge: '', note: '' })
      loadJob()
    } catch (err) {
      setFormError(err.message || 'Failed to add task.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    try {
      await window.omega.jobs.updateTask(taskId, { status: nextStatus })
      loadJob()
    } catch (err) {
      alert(err.message || 'Failed to update task status.')
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Delete this task?')) {
      try {
        await window.omega.jobs.deleteTask(taskId)
        loadJob()
      } catch (err) {
        alert(err.message || 'Failed to delete task.')
      }
    }
  }

  const handleAddPart = async (e) => {
    e.preventDefault()
    setFormError('')
    const qty = parseFloat(partForm.qty)
    if (!partForm.inventoryItemId || isNaN(qty) || qty <= 0) {
      setFormError('Please select an item and enter a valid quantity.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.jobs.addPart(job.id, {
        inventoryItemId: parseInt(partForm.inventoryItemId, 10),
        qty,
        sellingPriceOverride: partForm.sellingPriceOverride ? parseFloat(partForm.sellingPriceOverride) : null
      })
      setIsAddPartOpen(false)
      setPartForm({ inventoryItemId: inventoryItems[0]?.id || '', qty: '1', sellingPriceOverride: '' })
      loadJob()
    } catch (err) {
      setFormError(err.message || 'Failed to consume stock batch for job.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemovePart = async (jobPartId) => {
    if (window.confirm('Remove this part from job card? Stock will be restored to inventory batch.')) {
      try {
        await window.omega.jobs.removePart(jobPartId)
        loadJob()
      } catch (err) {
        alert(err.message || 'Failed to remove part.')
      }
    }
  }

  const handleGenerateInvoice = async () => {
    try {
      setIsSubmitting(true)
      const invoice = await window.omega.invoices.generateFromJob(job.id, {
        discount: parseFloat(invoiceDiscount) || 0
      })
      setIsGenerateInvoiceOpen(false)
      onNavigateToInvoice(invoice.id)
    } catch (err) {
      alert(err.message || 'Failed to generate invoice.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || !job) {
    return (
      <div className="content-scrollable" style={{ textAlign: 'center', padding: '60px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading Job Card...</p>
      </div>
    )
  }

  const progressPercent = job.totalTasksCount > 0
    ? Math.round((job.completedTasksCount / job.totalTasksCount) * 100)
    : 0

  return (
    <div className="content-scrollable">
      {/* Top action header */}
      <div className="toolbar" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
            ← Back to Job Cards
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>{job.jobNo}</h2>
              <Badge status={job.status} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Opened: {job.openedAt ? job.openedAt.replace('T', ' ').slice(0, 16) : '—'}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {job.status !== 'cancelled' && (
            <select
              className="form-select"
              style={{ width: 'auto', fontWeight: 600 }}
              value={job.status}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="pending">Status: Pending</option>
              <option value="in_progress">Status: In Progress</option>
              <option value="completed">Status: Completed</option>
              <option value="cancelled">Status: Cancelled</option>
            </select>
          )}

          {job.invoiceId ? (
            <button
              type="button"
              className="btn btn-success"
              onClick={() => onNavigateToInvoice(job.invoiceId)}
            >
              View Invoice ({job.invoiceNo}) →
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsGenerateInvoiceOpen(true)}
              disabled={job.status === 'cancelled'}
            >
              Generate Bill &amp; Sticker →
            </button>
          )}
        </div>
      </div>

      {/* Cancellation Banner */}
      {job.status === 'cancelled' && (
        <div
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid rgba(227, 87, 87, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            marginBottom: '20px',
            color: 'var(--danger-text)'
          }}
        >
          <strong>⚠️ This Job Card was Cancelled.</strong>
          {job.cancellationReason && <div>Reason: {job.cancellationReason}</div>}
          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.85 }}>
            Cancelled at: {job.cancelledAt ? job.cancelledAt.replace('T', ' ').slice(0, 16) : '—'}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Customer & Vehicle Info */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title">Customer &amp; Vehicle Details</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>CUSTOMER</div>
              <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>{job.customerName}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>📞 {job.customerPhone}</div>
              {job.customerAltPhone && <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Alt: {job.customerAltPhone}</div>}
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>VEHICLE</div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--primary)', marginTop: '2px' }}>
                {job.registrationNo}
              </div>
              <div style={{ fontWeight: 600 }}>{job.vehicleMake} {job.vehicleModel}</div>
              {job.odometer && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Odometer: {job.odometer.toLocaleString()} km
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>COMPLAINT / SERVICE REQUEST</div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: '1.4', fontWeight: 500 }}>
              {job.complaint}
            </p>
          </div>
        </div>

        {/* Mechanic Assignment Card */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header">
            <h3 className="card-title">Technician Assignment</h3>
          </div>
          <div className="form-group">
            <label className="form-label">Assigned Mechanic</label>
            <select
              className="form-select"
              value={job.mechanicId || ''}
              onChange={(e) => handleAssignMechanic(e.target.value)}
              disabled={job.status === 'cancelled'}
            >
              <option value="">-- Unassigned --</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.specialty}) • {m.activeWorkload} active {m.activeWorkload === 1 ? 'job' : 'jobs'}
                </option>
              ))}
            </select>
          </div>

          {job.mechanicName ? (
            <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{job.mechanicName}</div>
              <div style={{ color: 'var(--primary)', fontWeight: 600 }}>{job.mechanicSpecialty}</div>
              {job.mechanicPhone && <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>📞 {job.mechanicPhone}</div>}
            </div>
          ) : (
            <div style={{ padding: '12px', background: '#FEF6EC', borderRadius: 'var(--radius-md)', color: 'var(--warning-text)', fontSize: '12px' }}>
              ⚠️ No mechanic assigned yet. Select from dropdown to assign.
            </div>
          )}
        </div>
      </div>

      {/* Tasks & Progress Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Job Tasks &amp; Service Items</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {job.completedTasksCount} of {job.totalTasksCount} tasks completed ({progressPercent}%)
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setFormError('')
              setTaskForm({ description: '', serviceCharge: '', note: '' })
              setIsAddTaskOpen(true)
            }}
            disabled={job.status === 'cancelled'}
          >
            + Add Task
          </button>
        </div>

        {/* Progress Bar */}
        {job.totalTasksCount > 0 && (
          <div style={{ width: '100%', height: '6px', background: 'var(--border-color)', borderRadius: '3px', marginBottom: '16px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: progressPercent === 100 ? 'var(--success)' : 'var(--primary)',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        )}

        {job.tasks.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', padding: '10px 0' }}>
            No tasks added yet. Click "+ Add Task" to list service operations.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Done</th>
                <th>Task Description</th>
                <th>Service Labour Charge</th>
                <th>Notes</th>
                <th style={{ width: '60px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {job.tasks.map((t) => (
                <tr key={t.id} style={{ background: t.status === 'completed' ? '#F9FDFB' : 'transparent' }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={t.status === 'completed'}
                      onChange={() => handleToggleTaskStatus(t.id, t.status)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      disabled={job.status === 'cancelled'}
                    />
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, textDecoration: t.status === 'completed' ? 'line-through' : 'none', color: t.status === 'completed' ? 'var(--text-muted)' : 'var(--text-main)' }}>
                      {t.description}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    Rs. {t.serviceCharge ? t.serviceCharge.toLocaleString() : '0.00'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{t.note || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                      onClick={() => handleDeleteTask(t.id)}
                      disabled={job.status === 'cancelled'}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Combined Cost & Inventory Breakdown Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Parts &amp; Inventory Breakdown (FIFO Batch Tracking)</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Stock consumed snapshots batch cost for accurate COGS accounting.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setFormError('')
              setIsAddPartOpen(true)
            }}
            disabled={job.status === 'cancelled'}
          >
            + Consume Part (FIFO)
          </button>
        </div>

        {job.parts.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', padding: '10px 0' }}>
            No spare parts consumed for this job card yet. Click "+ Consume Part (FIFO)" to deduct stock.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Part Description</th>
                <th>Batch No</th>
                <th>Qty</th>
                <th>FIFO Cost Price</th>
                <th>Selling Price</th>
                <th>Line Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {job.parts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.itemName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SKU: {p.itemSku}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '11px', background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                      {p.batchNo}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{p.qty}</td>
                  <td style={{ color: 'var(--text-muted)' }}>Rs. {p.unitCostAtUse.toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>Rs. {p.sellingPriceAtUse.toLocaleString()}</td>
                  <td style={{ fontWeight: 700 }}>Rs. {p.lineTotal.toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                      onClick={() => handleRemovePart(p.id)}
                      disabled={job.status === 'cancelled'}
                    >
                      Return Qty
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Cost Breakdown Summary Box */}
        <div
          style={{
            marginTop: '20px',
            padding: '16px 20px',
            background: 'var(--bg-main)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Service / Labour Total:</span>
              <strong>Rs. {job.serviceRevenue.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Parts Sales Total:</span>
              <strong>Rs. {job.partsSalesTotal.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
              <span>Parts FIFO Batch Cost (COGS):</span>
              <span>Rs. {job.partsCostTotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-text)', fontSize: '12px', fontWeight: 600 }}>
              <span>Gross Parts Margin:</span>
              <span>Rs. {(job.partsSalesTotal - job.partsCostTotal).toLocaleString()}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--primary)',
                paddingTop: '8px',
                borderTop: '2px solid var(--border-color)'
              }}
            >
              <span>Estimated Bill Total:</span>
              <span>Rs. {job.totalBill.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {isAddTaskOpen && (
        <Modal
          isOpen={true}
          title="Add Service Task"
          onClose={() => setIsAddTaskOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddTaskOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddTask}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Adding...' : 'Add Task'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleAddTask}>
            <div className="form-group">
              <label className="form-label">Task Description <span className="req">*</span></label>
              <input
                type="text"
                className="form-input"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="e.g. Brake pad inspection, Oil & filter change"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Service Labour Charge (Rs.)</label>
              <input
                type="number"
                className="form-input"
                value={taskForm.serviceCharge}
                onChange={(e) => setTaskForm({ ...taskForm, serviceCharge: e.target.value })}
                placeholder="e.g. 2500"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Technician Note (Optional)</label>
              <input
                type="text"
                className="form-input"
                value={taskForm.note}
                onChange={(e) => setTaskForm({ ...taskForm, note: e.target.value })}
                placeholder="Special notes or observations"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Add Part (FIFO) Modal */}
      {isAddPartOpen && (
        <Modal
          isOpen={true}
          title="Consume Spare Part (FIFO Stock Deduction)"
          onClose={() => setIsAddPartOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddPartOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddPart}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deducting Stock...' : 'Deduct & Add to Job'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleAddPart}>
            <div className="form-group">
              <label className="form-label">Select Inventory Part <span className="req">*</span></label>
              <select
                className="form-select"
                value={partForm.inventoryItemId}
                onChange={(e) => {
                  const item = inventoryItems.find((i) => String(i.id) === e.target.value)
                  setPartForm({
                    ...partForm,
                    inventoryItemId: e.target.value,
                    sellingPriceOverride: item ? item.currentSellingPrice : ''
                  })
                }}
                required
              >
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.sku}) • In Stock: {item.totalStock} • Selling: Rs. {item.currentSellingPrice}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantity to Deduct <span className="req">*</span></label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={partForm.qty}
                  onChange={(e) => setPartForm({ ...partForm, qty: e.target.value })}
                  placeholder="e.g. 1, 4, 0.5"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Selling Price per Unit (Rs.)</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={partForm.sellingPriceOverride}
                  onChange={(e) => setPartForm({ ...partForm, sellingPriceOverride: e.target.value })}
                  placeholder="Selling price"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Cancel Job Modal */}
      {isCancelModalOpen && (
        <Modal
          isOpen={true}
          title="Cancel Job Card"
          onClose={() => setIsCancelModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={isSubmitting}
              >
                Keep Job Active
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmCancel}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Cancelling...' : 'Confirm Job Cancellation'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Reason for Cancellation <span className="req">*</span></label>
            <textarea
              className="form-textarea"
              rows={3}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="e.g. Customer decided not to proceed, Parts unavailable, Duplicate job card"
              required
              autoFocus
            />
          </div>
        </Modal>
      )}

      {/* Generate Invoice Modal */}
      {isGenerateInvoiceOpen && (
        <Modal
          isOpen={true}
          title={`Generate Bill / Invoice for ${job.jobNo}`}
          onClose={() => setIsGenerateInvoiceOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsGenerateInvoiceOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerateInvoice}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Generating...' : 'Generate Invoice & Service Sticker →'}
              </button>
            </>
          }
        >
          <div>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              This will snapshot all {job.tasks.length} service task items and {job.parts.length} part usage lines into an official customer invoice with an attached windshield reminder sticker.
            </p>
            <div className="form-group">
              <label className="form-label">Discount Amount (Rs.)</label>
              <input
                type="number"
                className="form-input"
                value={invoiceDiscount}
                onChange={(e) => setInvoiceDiscount(e.target.value)}
                placeholder="Optional discount"
              />
            </div>
            <div style={{ padding: '14px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Subtotal:</span>
                <strong>Rs. {job.totalBill.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>Discount:</span>
                <strong style={{ color: 'var(--danger)' }}>
                  Rs. {parseFloat(invoiceDiscount) || 0}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: 'var(--primary)', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                <span>Grand Total:</span>
                <span>
                  Rs. {Math.max(0, job.totalBill - (parseFloat(invoiceDiscount) || 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
