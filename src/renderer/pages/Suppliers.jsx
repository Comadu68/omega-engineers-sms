import React, { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { Badge } from '../components/Badge'

const SL_PHONE_REGEX = /^0[1-9]\d{8}$/

export const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([])
  const [purchaseBatches, setPurchaseBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Add / Edit Supplier Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: ''
  })
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // View Supplier GRN History Modal
  const [selectedSupplierHistory, setSelectedSupplierHistory] = useState(null)

  const loadSuppliersData = async () => {
    try {
      setLoading(true)
      const [suppList, batchesList] = await Promise.all([
        window.omega.inventory.getSuppliers({ includeInactive: true }),
        window.omega.inventory.getPurchaseBatches({})
      ])
      setSuppliers(suppList || [])
      setPurchaseBatches(batchesList || [])
    } catch (err) {
      console.error('Failed to load suppliers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSuppliersData()
  }, [])

  const openCreateModal = () => {
    setEditingSupplier(null)
    setFormError('')
    setSupplierForm({ name: '', phone: '', address: '', notes: '' })
    setIsModalOpen(true)
  }

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier)
    setFormError('')
    setSupplierForm({
      name: supplier.name || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || ''
    })
    setIsModalOpen(true)
  }

  const handleSaveSupplier = async (e) => {
    if (e) e.preventDefault()
    setFormError('')

    const trimmedName = supplierForm.name.trim()
    if (!trimmedName) {
      setFormError('Supplier name is required.')
      return
    }

    const rawPhone = (supplierForm.phone || '').trim()
    if (rawPhone) {
      const normalizedPhone = rawPhone.replace(/[\s-]/g, '')
      if (!SL_PHONE_REGEX.test(normalizedPhone)) {
        setFormError('Invalid Sri Lankan phone number. Must be 10 digits starting with 0 (e.g. 0771234567 or 0112345678).')
        return
      }
    }

    try {
      setIsSubmitting(true)
      const payload = {
        name: trimmedName,
        phone: rawPhone,
        address: (supplierForm.address || '').trim(),
        notes: (supplierForm.notes || '').trim()
      }

      if (editingSupplier) {
        await window.omega.inventory.updateSupplier(editingSupplier.id, payload)
      } else {
        await window.omega.inventory.createSupplier(payload)
      }

      setIsModalOpen(false)
      setEditingSupplier(null)
      await loadSuppliersData()
    } catch (err) {
      setFormError(err.message || 'Failed to save supplier.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (supplier) => {
    try {
      const nextActive = supplier.is_active ? 0 : 1
      await window.omega.inventory.deactivateSupplier(supplier.id, nextActive)
      await loadSuppliersData()
    } catch (err) {
      alert(err.message || 'Failed to update supplier status.')
    }
  }

  const filteredSuppliers = suppliers.filter((s) => {
    if (!showInactive && !s.is_active) return false
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q) ||
      (s.notes || '').toLowerCase().includes(q)
    )
  })

  const activeCount = suppliers.filter((s) => s.is_active).length
  const inactiveCount = suppliers.length - activeCount
  const totalBatchesCount = suppliers.reduce((sum, s) => sum + (s.batchesCount || 0), 0)
  const totalPurchaseValue = suppliers.reduce((sum, s) => sum + (s.totalPurchasesValue || 0), 0)

  const supplierHistoryBatches = selectedSupplierHistory
    ? purchaseBatches.filter((b) => Number(b.supplierId) === Number(selectedSupplierHistory.id))
    : []

  return (
    <div className="content-scrollable">
      {/* KPI Summary Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--accent-color': 'var(--primary)' }}>
          <div className="kpi-label">Active Suppliers</div>
          <div className="kpi-value">{activeCount}</div>
          <div className="kpi-subtext">
            {inactiveCount > 0 ? `${inactiveCount} inactive vendor(s)` : 'All registered vendors active'}
          </div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--info)' }}>
          <div className="kpi-label">Total Registered Vendors</div>
          <div className="kpi-value">{suppliers.length}</div>
          <div className="kpi-subtext">Spare parts &amp; lubricant suppliers</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--warning)' }}>
          <div className="kpi-label">GRN Batches Received</div>
          <div className="kpi-value">{totalBatchesCount}</div>
          <div className="kpi-subtext">Total supplier purchase deliveries</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--success)' }}>
          <div className="kpi-label">Total Purchases Volume</div>
          <div className="kpi-value" style={{ fontSize: '20px' }}>
            Rs. {Math.round(totalPurchaseValue).toLocaleString()}
          </div>
          <div className="kpi-subtext">Cumulative supplier GRN value</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
          <div className="search-input-wrap" style={{ maxWidth: '360px' }}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier by name, phone, address, or items..."
            />
          </div>

          <button
            type="button"
            className={`chip ${showInactive ? 'active' : ''}`}
            onClick={() => setShowInactive(!showInactive)}
          >
            👁️ Show Inactive Suppliers ({inactiveCount})
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
        >
          + Register New Supplier
        </button>
      </div>

      {/* Suppliers Directory Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <div className="card-header" style={{ padding: '16px 20px', margin: 0 }}>
          <div>
            <h3 className="card-title">🏢 Registered Spare Parts Suppliers</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Maintain supplier contact records, credit/supply notes, and review purchase volume
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading suppliers...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No suppliers match your search. Click &quot;+ Register New Supplier&quot; to add a vendor.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier &amp; Address</th>
                <th>Contact Phone</th>
                <th>Supply Notes</th>
                <th>Purchases &amp; GRNs</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((s) => (
                <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.6 }}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{s.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {s.address ? `📍 ${s.address}` : 'No address specified'}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '12px' }}>
                    {s.phone || '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px', maxWidth: '240px' }}>
                    {s.notes || '—'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      Rs. {Math.round(s.totalPurchasesValue || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {s.batchesCount || 0} {s.batchesCount === 1 ? 'GRN batch' : 'GRN batches'}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Badge
                      status={s.is_active ? 'available' : 'off_duty'}
                      text={s.is_active ? 'Active' : 'Inactive'}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedSupplierHistory(s)}
                      >
                        🧾 GRNs ({s.batchesCount || 0})
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(s)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${s.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleActive(s)}
                      >
                        {s.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          title={editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Register New Parts Supplier'}
          onClose={() => {
            setIsModalOpen(false)
            setEditingSupplier(null)
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsModalOpen(false)
                  setEditingSupplier(null)
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSupplier}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}

          <form onSubmit={handleSaveSupplier}>
            <div className="form-group">
              <label className="form-label">
                Supplier / Vendor Name <span className="req">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                placeholder="e.g. Dimo Lanka Auto Parts, United Motors"
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contact Phone (Sri Lanka 10-digit)</label>
                <input
                  type="text"
                  className="form-input"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  placeholder="e.g. 011 234 5678 or 077 123 4567"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address / Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="e.g. Panchikawatta, Colombo 10"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Supply Notes (Optional)</label>
              <textarea
                className="form-input"
                rows="2"
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                placeholder="e.g. Genuine Toyota & Nissan filters, 30-day credit term"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Supplier GRN History Modal */}
      {selectedSupplierHistory && (
        <Modal
          isOpen={true}
          title={`Purchase Invoices & GRN History — ${selectedSupplierHistory.name}`}
          size="lg"
          onClose={() => setSelectedSupplierHistory(null)}
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedSupplierHistory(null)}
            >
              Close
            </button>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px', padding: '12px 16px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>CONTACT PHONE</div>
              <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>{selectedSupplierHistory.phone || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL GRN BATCHES</div>
              <div style={{ fontWeight: 800, fontSize: '15px', marginTop: '2px' }}>{selectedSupplierHistory.batchesCount || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL PURCHASE VALUE</div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--primary)', marginTop: '2px' }}>
                Rs. {Math.round(selectedSupplierHistory.totalPurchasesValue || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {supplierHistoryBatches.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No purchase invoices / GRN batches recorded for this supplier yet.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>GRN / Invoice No</th>
                  <th>Batch No</th>
                  <th>Part (SKU)</th>
                  <th>Qty Received</th>
                  <th>Remaining</th>
                  <th>Unit Cost</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {supplierHistoryBatches.map((b) => (
                  <tr key={b.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-muted)' }}>{b.receivedAt}</td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {b.supplierDocumentNo || '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '12px' }}>{b.batchNo}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.itemName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{b.itemSku}</div>
                    </td>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{b.receivedQty}</td>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap', color: b.remainingQty > 0 ? 'var(--success-text)' : 'var(--text-muted)' }}>
                      {b.remainingQty}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>Rs. {Number(b.unitCost || 0).toLocaleString()}</td>
                    <td style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                      Rs. {Math.round(b.totalCost || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  )
}
