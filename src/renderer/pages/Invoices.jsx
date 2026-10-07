import React, { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { InvoicePrintView } from './InvoicePrintView'

export const Invoices = ({ initialSelectedInvoiceId = null }) => {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(initialSelectedInvoiceId)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all') // 'all', 'paid', 'partially_paid', 'unpaid'

  // Quick payment modal
  const [paymentInvoice, setPaymentInvoice] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [referenceNo, setReferenceNo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const filters = { search }
      if (activeFilter !== 'all') {
        filters.status = activeFilter
      }
      const data = await window.omega.invoices.list(filters)
      setInvoices(data)
    } catch (err) {
      console.error('Failed to load invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedInvoiceId) {
      loadInvoices()
    }
  }, [activeFilter, search, selectedInvoiceId])

  const openQuickPayment = (inv) => {
    setPaymentInvoice(inv)
    setPaymentAmount(inv.balance > 0 ? String(inv.balance) : '')
    setPaymentMethod('Cash')
    setReferenceNo('')
  }

  const handleQuickPaymentSubmit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.payments.record({
        invoiceId: paymentInvoice.id,
        amount: amt,
        paymentMethod,
        referenceNo
      })
      setPaymentInvoice(null)
      loadInvoices()
    } catch (err) {
      alert(err.message || 'Failed to record payment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (selectedInvoiceId) {
    return (
      <InvoicePrintView
        invoiceId={selectedInvoiceId}
        onBack={() => setSelectedInvoiceId(null)}
        onPaymentRecorded={loadInvoices}
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
            placeholder="Search by invoice no, job no, customer, vehicle..."
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="toolbar" style={{ marginBottom: '14px' }}>
        <div className="filter-chips">
          <button
            type="button"
            className={`chip ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All Invoices
          </button>
          <button
            type="button"
            className={`chip ${activeFilter === 'paid' ? 'active' : ''}`}
            onClick={() => setActiveFilter('paid')}
          >
            🟢 Paid
          </button>
          <button
            type="button"
            className={`chip ${activeFilter === 'partially_paid' ? 'active' : ''}`}
            onClick={() => setActiveFilter('partially_paid')}
          >
            🟡 Partially Paid
          </button>
          <button
            type="button"
            className={`chip ${activeFilter === 'unpaid' ? 'active' : ''}`}
            onClick={() => setActiveFilter('unpaid')}
          >
            🔴 Unpaid / Pending
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No invoice records found. Invoices are generated from Job Cards.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Job ID</th>
                <th>Customer</th>
                <th>Vehicle No</th>
                <th>Total Bill</th>
                <th>Amount Paid</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th>Issued Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{inv.invoiceNo}</td>
                  <td style={{ fontWeight: 600 }}>{inv.jobNo}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.customerName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{inv.customerPhone}</div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700 }}>{inv.registrationNo}</span>
                  </td>
                  <td style={{ fontWeight: 800 }}>Rs. {inv.total.toLocaleString()}</td>
                  <td style={{ color: 'var(--success-text)', fontWeight: 600 }}>
                    Rs. {inv.amountPaid.toLocaleString()}
                  </td>
                  <td style={{ color: inv.balance > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 700 }}>
                    Rs. {inv.balance.toLocaleString()}
                  </td>
                  <td><Badge status={inv.paymentStatus} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {inv.issuedAt ? inv.issuedAt.slice(0, 10) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setSelectedInvoiceId(inv.id)}
                      >
                        Print / View →
                      </button>
                      {inv.balance > 0 && (
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={() => openQuickPayment(inv)}
                        >
                          + Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Payment Modal */}
      {paymentInvoice && (
        <Modal
          isOpen={true}
          title={`Record Payment for ${paymentInvoice.invoiceNo}`}
          onClose={() => setPaymentInvoice(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPaymentInvoice(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleQuickPaymentSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </button>
            </>
          }
        >
          <div style={{ padding: '12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', marginBottom: '14px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Total Invoice Bill:</span>
              <strong>Rs. {paymentInvoice.total.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Paid So Far:</span>
              <strong style={{ color: 'var(--success-text)' }}>Rs. {paymentInvoice.amountPaid.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--danger)' }}>
              <span>Remaining Balance:</span>
              <span>Rs. {paymentInvoice.balance.toLocaleString()}</span>
            </div>
          </div>

          <form onSubmit={handleQuickPaymentSubmit}>
            <div className="form-group">
              <label className="form-label">Payment Amount (Rs.) <span className="req">*</span></label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option>Cash</option>
                  <option>Credit / Debit Card</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reference No.</label>
                <input
                  type="text"
                  className="form-input"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="Optional reference"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
