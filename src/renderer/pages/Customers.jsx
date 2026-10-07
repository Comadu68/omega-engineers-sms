import React, { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { Badge } from '../components/Badge'

export const Customers = ({ onNavigateToJob }) => {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Modals state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerDetail, setCustomerDetail] = useState(null)
  const [editingCustomer, setEditingCustomer] = useState(null)

  // Forms state
  const [customerForm, setCustomerForm] = useState({
    fullName: '',
    phone: '',
    alternatePhone: '',
    email: '',
    address: '',
    notes: ''
  })

  const [vehicleForm, setVehicleForm] = useState({
    registrationNo: '',
    make: '',
    model: '',
    year: '',
    vehicleType: 'Sedan / Car',
    engineNo: '',
    chassisNo: '',
    mileage: '',
    notes: ''
  })

  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const data = await window.omega.customers.list({ search })
      setCustomers(data)
    } catch (err) {
      console.error('Failed to load customers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [search])

  const openCustomerDetail = async (customerId) => {
    try {
      const data = await window.omega.customers.get(customerId)
      setCustomerDetail(data)
      setSelectedCustomer(customerId)
    } catch (err) {
      console.error('Failed to load customer detail:', err)
    }
  }

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!customerForm.fullName.trim() || !customerForm.phone.trim()) {
      setFormError('Full Name and Phone Number are required.')
      return
    }

    try {
      setIsSubmitting(true)
      const newCust = await window.omega.customers.create(customerForm)
      setIsAddCustomerOpen(false)
      setCustomerForm({ fullName: '', phone: '', alternatePhone: '', email: '', address: '', notes: '' })
      loadCustomers()
      openCustomerDetail(newCust.id)
    } catch (err) {
      setFormError(err.message || 'Failed to create customer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateCustomer = async (e) => {
    e.preventDefault()
    setFormError('')
    try {
      setIsSubmitting(true)
      await window.omega.customers.update(editingCustomer.id, customerForm)
      setEditingCustomer(null)
      loadCustomers()
      openCustomerDetail(editingCustomer.id)
    } catch (err) {
      setFormError(err.message || 'Failed to update customer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateVehicle = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!vehicleForm.registrationNo.trim()) {
      setFormError('Vehicle Registration Number is required.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.vehicles.create({
        ...vehicleForm,
        customerId: customerDetail.id
      })
      setIsAddVehicleOpen(false)
      setVehicleForm({
        registrationNo: '',
        make: '',
        model: '',
        year: '',
        vehicleType: 'Sedan / Car',
        engineNo: '',
        chassisNo: '',
        mileage: '',
        notes: ''
      })
      loadCustomers()
      openCustomerDetail(customerDetail.id)
    } catch (err) {
      setFormError(err.message || 'Failed to add vehicle.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="content-scrollable">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, phone, or vehicle no..."
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setFormError('')
            setCustomerForm({ fullName: '', phone: '', alternatePhone: '', email: '', address: '', notes: '' })
            setIsAddCustomerOpen(true)
          }}
        >
          + Add New Customer
        </button>
      </div>

      {/* Main Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading customer records...
          </div>
        ) : customers.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {search ? 'No customers found matching your search.' : 'No customer records yet. Click "+ Add New Customer" to start.'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Email</th>
                <th>Address</th>
                <th>Vehicles</th>
                <th>Jobs History</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.fullName}</div>
                    {c.notes && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.notes}</div>}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.phone}</div>
                    {c.alternatePhone && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Alt: {c.alternatePhone}</div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.email || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.address || '—'}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {c.vehicleCount} {c.vehicleCount === 1 ? 'vehicle' : 'vehicles'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{c.jobCount} jobs</span>
                    {c.lastServiceDate && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Last: {c.lastServiceDate.slice(0, 10)}
                      </div>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openCustomerDetail(c.id)}
                    >
                      View Profile →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Customer Detail Drawer / Modal */}
      {customerDetail && (
        <Modal
          isOpen={true}
          title={`Customer Profile: ${customerDetail.fullName}`}
          size="lg"
          onClose={() => {
            setCustomerDetail(null)
            setSelectedCustomer(null)
          }}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingCustomer(customerDetail)
                  setCustomerForm({
                    fullName: customerDetail.fullName,
                    phone: customerDetail.phone,
                    alternatePhone: customerDetail.alternatePhone || '',
                    email: customerDetail.email || '',
                    address: customerDetail.address || '',
                    notes: customerDetail.notes || ''
                  })
                }}
              >
                ✏️ Edit Contact Info
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsAddVehicleOpen(true)}
              >
                + Register New Vehicle
              </button>
            </div>
          }
        >
          <div>
            {/* Contact Info Card */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px', padding: '14px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>PHONE</div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{customerDetail.phone}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>ALT PHONE</div>
                <div style={{ fontSize: '13px' }}>{customerDetail.alternatePhone || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>EMAIL</div>
                <div style={{ fontSize: '13px' }}>{customerDetail.email || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>ADDRESS</div>
                <div style={{ fontSize: '13px' }}>{customerDetail.address || '—'}</div>
              </div>
            </div>

            {/* Registered Vehicles */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                  Registered Vehicles ({customerDetail.vehicles?.length || 0})
                </h4>
              </div>
              {customerDetail.vehicles?.length === 0 ? (
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', background: '#FAFBFD', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                  No vehicles registered for this customer yet.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                  {customerDetail.vehicles.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        padding: '12px',
                        background: '#FFFFFF',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary)' }}>
                          {v.registrationNo}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.year || ''}</span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>
                        {v.make} {v.model}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Type: {v.vehicleType || 'Car'} {v.mileage ? `• ${v.mileage.toLocaleString()} km` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Service & Job Card History */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700 }}>
                Service &amp; Job History
              </h4>
              {customerDetail.jobHistory?.length === 0 ? (
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  No service records found.
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Vehicle</th>
                      <th>Complaint / Request</th>
                      <th>Status</th>
                      <th>Invoice Total</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerDetail.jobHistory.map((j) => (
                      <tr key={j.id}>
                        <td style={{ fontWeight: 700 }}>{j.jobNo}</td>
                        <td>{j.registrationNo} ({j.vehicleModel})</td>
                        <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {j.complaint}
                        </td>
                        <td><Badge status={j.status} /></td>
                        <td style={{ fontWeight: 700 }}>
                          Rs. {j.invoiceTotal ? j.invoiceTotal.toLocaleString() : '—'}
                        </td>
                        <td>{j.openedAt ? j.openedAt.slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Customer Modal */}
      {(isAddCustomerOpen || editingCustomer) && (
        <Modal
          isOpen={true}
          title={editingCustomer ? 'Edit Customer Information' : 'Add New Customer'}
          onClose={() => {
            setIsAddCustomerOpen(false)
            setEditingCustomer(null)
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsAddCustomerOpen(false)
                  setEditingCustomer(null)
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (editingCustomer ? 'Update Customer' : 'Save Customer')}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}>
            <div className="form-group">
              <label className="form-label">Full Name <span className="req">*</span></label>
              <input
                type="text"
                className="form-input"
                value={customerForm.fullName}
                onChange={(e) => setCustomerForm({ ...customerForm, fullName: e.target.value })}
                placeholder="e.g. Anura Perera"
                required
                autoFocus
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Primary Phone <span className="req">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  placeholder="e.g. 077 123 4567"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Alternate Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={customerForm.alternatePhone}
                  onChange={(e) => setCustomerForm({ ...customerForm, alternatePhone: e.target.value })}
                  placeholder="e.g. 011 234 5678"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                placeholder="e.g. customer@example.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                type="text"
                className="form-input"
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                placeholder="e.g. 45 Temple Road, Mount Lavinia"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={customerForm.notes}
                onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                placeholder="Optional customer preferences or notes"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Add Vehicle Modal */}
      {isAddVehicleOpen && customerDetail && (
        <Modal
          isOpen={true}
          title={`Register Vehicle for ${customerDetail.fullName}`}
          onClose={() => setIsAddVehicleOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddVehicleOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateVehicle}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Registering...' : 'Register Vehicle'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateVehicle}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Registration No. <span className="req">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={vehicleForm.registrationNo}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, registrationNo: e.target.value.toUpperCase() })}
                  placeholder="e.g. WP CAB-1234"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Type</label>
                <select
                  className="form-select"
                  value={vehicleForm.vehicleType}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleType: e.target.value })}
                >
                  <option>Sedan / Car</option>
                  <option>SUV / Crossover</option>
                  <option>Hatchback</option>
                  <option>Van / MPV</option>
                  <option>Pickup / Lorry</option>
                  <option>Motorcycle</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Make (Brand)</label>
                <input
                  type="text"
                  className="form-input"
                  value={vehicleForm.make}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                  placeholder="e.g. Toyota, Honda, Suzuki"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Model</label>
                <input
                  type="text"
                  className="form-input"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                  placeholder="e.g. Axio, Vezel, Alto"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Manufacturing Year</label>
                <input
                  type="number"
                  className="form-input"
                  value={vehicleForm.year}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                  placeholder="e.g. 2018"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Current Mileage (km)</label>
                <input
                  type="number"
                  className="form-input"
                  value={vehicleForm.mileage}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, mileage: e.target.value })}
                  placeholder="e.g. 45000"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Engine / Chassis No. (Optional)</label>
              <input
                type="text"
                className="form-input"
                value={vehicleForm.engineNo}
                onChange={(e) => setVehicleForm({ ...vehicleForm, engineNo: e.target.value })}
                placeholder="Engine / Chassis number"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
