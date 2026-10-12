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
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [duplicateDialog, setDuplicateDialog] = useState(null)

  const validateCustomerInputs = (form) => {
    const errors = {}
    const name = form.fullName ? form.fullName.trim() : ''
    if (!name) {
      errors.fullName = 'Customer full name is required.'
    } else if (name.length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.'
    } else if (!/\p{L}/u.test(name) || !/^[\p{L}\p{M}\s.'-]+$/u.test(name)) {
      errors.fullName = 'Name may only contain English or Sinhala letters, spaces, dots, and hyphens (no numbers or symbols).'
    }

    const phone = form.phone ? form.phone.trim() : ''
    if (!phone) {
      errors.phone = 'Customer primary phone number is required.'
    } else if (!/^[\d\s+\-.()]+$/.test(phone)) {
      errors.phone = 'Phone number contains invalid characters.'
    } else {
      let cleaned = phone.replace(/[\s\-.()]/g, '')
      if (cleaned.startsWith('+940')) cleaned = cleaned.slice(3)
      else if (cleaned.startsWith('+94')) cleaned = '0' + cleaned.slice(3)
      else if (cleaned.startsWith('00940')) cleaned = cleaned.slice(4)
      else if (cleaned.startsWith('0094')) cleaned = '0' + cleaned.slice(4)
      else if (cleaned.startsWith('940') && cleaned.length === 12) cleaned = cleaned.slice(2)
      else if (cleaned.startsWith('94') && cleaned.length === 11) cleaned = '0' + cleaned.slice(2)

      if (!/^0[1-9]\d{8}$/.test(cleaned)) {
        errors.phone = 'Enter a valid 10-digit Sri Lankan phone number (e.g. 077 123 4567, 011 234 5678, or +94 77 123 4567).'
      }
    }

    const alt = form.alternatePhone ? form.alternatePhone.trim() : ''
    if (alt) {
      if (!/^[\d\s+\-.()]+$/.test(alt)) {
        errors.alternatePhone = 'Alternate phone contains invalid characters.'
      } else {
        let cleanedAlt = alt.replace(/[\s\-.()]/g, '')
        if (cleanedAlt.startsWith('+940')) cleanedAlt = cleanedAlt.slice(3)
        else if (cleanedAlt.startsWith('+94')) cleanedAlt = '0' + cleanedAlt.slice(3)
        else if (cleanedAlt.startsWith('00940')) cleanedAlt = cleanedAlt.slice(4)
        else if (cleanedAlt.startsWith('0094')) cleanedAlt = '0' + cleanedAlt.slice(4)
        else if (cleanedAlt.startsWith('940') && cleanedAlt.length === 12) cleanedAlt = cleanedAlt.slice(2)
        else if (cleanedAlt.startsWith('94') && cleanedAlt.length === 11) cleanedAlt = '0' + cleanedAlt.slice(2)

        if (!/^0[1-9]\d{8}$/.test(cleanedAlt)) {
          errors.alternatePhone = 'Enter a valid Sri Lankan alternate phone number.'
        }
      }
    }

    const email = form.email ? form.email.trim() : ''
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address (e.g. customer@example.com).'
    }

    return errors
  }

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

  const handleCreateCustomer = async (e, allowDuplicate = false) => {
    if (e && e.preventDefault) e.preventDefault()
    setFormError('')
    setFieldErrors({})

    const errs = validateCustomerInputs(customerForm)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setFormError('Please correct the validation errors highlighted below.')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = { ...customerForm, allowDuplicatePhone: allowDuplicate }
      const res = await window.omega.customers.create(payload)

      if (res?.duplicateWarning) {
        setDuplicateDialog({
          duplicates: res.duplicates || [],
          phone: customerForm.phone,
          isEdit: false,
          formPayload: { ...customerForm }
        })
        return
      }

      setIsAddCustomerOpen(false)
      setDuplicateDialog(null)
      setCustomerForm({ fullName: '', phone: '', alternatePhone: '', email: '', address: '', notes: '' })
      await loadCustomers()
      if (res?.id) {
        openCustomerDetail(res.id)
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create customer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateCustomer = async (e, allowDuplicate = false) => {
    if (e && e.preventDefault) e.preventDefault()
    setFormError('')
    setFieldErrors({})

    const errs = validateCustomerInputs(customerForm)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setFormError('Please correct the validation errors highlighted below.')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = { ...customerForm, allowDuplicatePhone: allowDuplicate }
      const res = await window.omega.customers.update(editingCustomer.id, payload)

      if (res?.duplicateWarning) {
        setDuplicateDialog({
          duplicates: res.duplicates || [],
          phone: customerForm.phone,
          isEdit: true,
          editingId: editingCustomer.id,
          formPayload: { ...customerForm }
        })
        return
      }

      setEditingCustomer(null)
      setDuplicateDialog(null)
      await loadCustomers()
      if (editingCustomer?.id) {
        openCustomerDetail(editingCustomer.id)
      }
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
              <label className="form-label">Full Name (Sinhala or English) <span className="req">*</span></label>
              <input
                type="text"
                className="form-input"
                value={customerForm.fullName}
                onChange={(e) => {
                  setCustomerForm({ ...customerForm, fullName: e.target.value })
                  if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: '' })
                }}
                placeholder="e.g. Anura Perera or කමල් පෙරේරා"
                required
                autoFocus
                style={fieldErrors.fullName ? { borderColor: '#EF4444' } : {}}
              />
              {fieldErrors.fullName && (
                <div style={{ color: '#EF4444', fontSize: '11px', marginTop: '4px' }}>
                  {fieldErrors.fullName}
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Primary Phone <span className="req">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={customerForm.phone}
                  onChange={(e) => {
                    setCustomerForm({ ...customerForm, phone: e.target.value })
                    if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' })
                  }}
                  placeholder="e.g. 077 123 4567 or +94 77 123 4567"
                  required
                  style={fieldErrors.phone ? { borderColor: '#EF4444' } : {}}
                />
                {fieldErrors.phone && (
                  <div style={{ color: '#EF4444', fontSize: '11px', marginTop: '4px' }}>
                    {fieldErrors.phone}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Alternate Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={customerForm.alternatePhone}
                  onChange={(e) => {
                    setCustomerForm({ ...customerForm, alternatePhone: e.target.value })
                    if (fieldErrors.alternatePhone) setFieldErrors({ ...fieldErrors, alternatePhone: '' })
                  }}
                  placeholder="e.g. 011 234 5678"
                  style={fieldErrors.alternatePhone ? { borderColor: '#EF4444' } : {}}
                />
                {fieldErrors.alternatePhone && (
                  <div style={{ color: '#EF4444', fontSize: '11px', marginTop: '4px' }}>
                    {fieldErrors.alternatePhone}
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={customerForm.email}
                onChange={(e) => {
                  setCustomerForm({ ...customerForm, email: e.target.value })
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' })
                }}
                placeholder="e.g. customer@example.com"
                style={fieldErrors.email ? { borderColor: '#EF4444' } : {}}
              />
              {fieldErrors.email && (
                <div style={{ color: '#EF4444', fontSize: '11px', marginTop: '4px' }}>
                  {fieldErrors.email}
                </div>
              )}
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

      {/* Duplicate Customer Phone Warning Modal */}
      {duplicateDialog && (
        <Modal
          isOpen={true}
          size="lg"
          title="⚠️ Phone Number Already Registered"
          onClose={() => setDuplicateDialog(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDuplicateDialog(null)}
                disabled={isSubmitting}
              >
                Cancel &amp; Edit Phone
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1
                }}
                onClick={() => {
                  if (duplicateDialog.isEdit) {
                    handleUpdateCustomer(null, true)
                  } else {
                    handleCreateCustomer(null, true)
                  }
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Create / Save Anyway (Shared Phone)'}
              </button>
            </div>
          }
        >
          <div>
            <div
              style={{
                background: '#FEF3C7',
                border: '1px solid #FCD34D',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '16px',
                color: '#92400E',
                fontSize: '13px',
                lineHeight: '1.5'
              }}
            >
              <strong>Notice:</strong> The primary phone number{' '}
              <strong>{duplicateDialog.phone}</strong> is already registered to existing customer record(s).
              <div style={{ marginTop: '4px', fontSize: '12px' }}>
                • To avoid creating duplicate records, choose <strong>"👉 Use Existing Customer"</strong> below.
                <br />
                • If this is a valid shared number (e.g. family member or company fleet), click{' '}
                <strong>"Create / Save Anyway (Shared Phone)"</strong>.
              </div>
            </div>

            <div style={{ marginBottom: '8px', fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Matching Customers ({duplicateDialog.duplicates.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {duplicateDialog.duplicates.map((dup) => (
                <div
                  key={dup.id}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    background: '#FFFFFF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)' }}>
                      {dup.fullName}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📞 <strong>{dup.phone}</strong>
                      {dup.alternatePhone && <span> • Alt: {dup.alternatePhone}</span>}
                      {dup.email && <span> • ✉️ {dup.email}</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      🚗 {dup.vehicleCount || 0} vehicle(s) registered • 📋 {dup.jobCount || 0} job(s)
                      {dup.address && <span> • 📍 {dup.address}</span>}
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setDuplicateDialog(null)
                        setIsAddCustomerOpen(false)
                        setEditingCustomer(null)
                        openCustomerDetail(dup.id)
                      }}
                    >
                      👉 Use Existing Customer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
