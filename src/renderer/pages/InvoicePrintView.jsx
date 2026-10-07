import React, { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'

export const InvoicePrintView = ({ invoiceId, onBack, onPaymentRecorded }) => {
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    referenceNo: '',
    notes: ''
  })
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadInvoice = async () => {
    try {
      setLoading(true)
      const data = await window.omega.invoices.get(invoiceId)
      setInvoice(data)
      if (data) {
        setPaymentForm((prev) => ({
          ...prev,
          amount: data.balance > 0 ? String(data.balance) : ''
        }))
      }
    } catch (err) {
      console.error('Failed to load invoice:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoice()
  }, [invoiceId])

  const handlePrint = () => {
    window.print()
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    setFormError('')
    const amt = parseFloat(paymentForm.amount)
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid positive payment amount.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.payments.record({
        invoiceId: invoice.id,
        amount: amt,
        paymentMethod: paymentForm.paymentMethod,
        referenceNo: paymentForm.referenceNo,
        notes: paymentForm.notes
      })
      setIsPaymentModalOpen(false)
      loadInvoice()
      if (onPaymentRecorded) onPaymentRecorded()
    } catch (err) {
      setFormError(err.message || 'Failed to record payment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || !invoice) {
    return (
      <div className="content-scrollable" style={{ textAlign: 'center', padding: '60px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading invoice preview...</p>
      </div>
    )
  }

  return (
    <div className="content-scrollable">
      {/* Top action toolbar (hidden on print) */}
      <div className="toolbar no-print" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
            ← Back to Invoices
          </button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
            Invoice &amp; Service Sticker Preview
          </h2>
          <Badge status={invoice.paymentStatus} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {invoice.balance > 0 && (
            <button
              type="button"
              className="btn btn-success"
              onClick={() => setIsPaymentModalOpen(true)}
            >
              💳 Record Payment (Balance: Rs. {invoice.balance.toLocaleString()})
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            🖶 Print Bill + Sticker
          </button>
        </div>
      </div>

      {/* Printable Invoice Sheet */}
      <div className="invoice-paper">
        {/* Bill Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #152033', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#152033', letterSpacing: '0.5px' }}>
              OMEGA ENGINEERS SERVICE STATION
            </div>
            <div style={{ fontSize: '12px', color: '#6B778C', marginTop: '2px' }}>
              Solotrade Company • 123 Galle Road, Colombo
            </div>
            <div style={{ fontSize: '12px', color: '#6B778C' }}>
              Tel: 011 234 5678 • Email: service@omegaengineers.lk
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
              INVOICE / BILL
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>
              No: {invoice.invoiceNo}
            </div>
            <div style={{ fontSize: '12px', color: '#6B778C' }}>
              Date: {invoice.issuedAt ? invoice.issuedAt.slice(0, 10) : '—'}
            </div>
          </div>
        </div>

        {/* Billed To / Job Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '12px 0', borderBottom: '1px solid #E4E9F2', marginBottom: '20px', fontSize: '13px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#6B778C', fontWeight: 700, textTransform: 'uppercase' }}>BILLED TO</div>
            <div style={{ fontWeight: 700, marginTop: '2px' }}>{invoice.customerName}</div>
            <div style={{ color: '#6B778C', fontSize: '12px' }}>{invoice.customerPhone}</div>
            {invoice.customerAddress && <div style={{ color: '#6B778C', fontSize: '11px' }}>{invoice.customerAddress}</div>}
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#6B778C', fontWeight: 700, textTransform: 'uppercase' }}>VEHICLE</div>
            <div style={{ fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
              {invoice.registrationNo}
            </div>
            <div style={{ color: '#6B778C', fontSize: '12px' }}>{invoice.vehicleMake} {invoice.vehicleModel}</div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#6B778C', fontWeight: 700, textTransform: 'uppercase' }}>JOB CARD</div>
            <div style={{ fontWeight: 700, marginTop: '2px' }}>{invoice.jobNo}</div>
            <div style={{ color: '#6B778C', fontSize: '12px' }}>
              {invoice.jobCompletedAt ? `Done: ${invoice.jobCompletedAt.slice(0, 10)}` : 'In Service'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#6B778C', fontWeight: 700, textTransform: 'uppercase' }}>TECHNICIAN</div>
            <div style={{ fontWeight: 700, marginTop: '2px' }}>{invoice.mechanicName || 'Workshop Staff'}</div>
          </div>
        </div>

        {/* Itemized Line Items Table */}
        <table className="data-table" style={{ border: '1px solid #E4E9F2', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th>Item / Service Description</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Type</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Qty</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Unit Price</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ color: '#6B778C' }}>{idx + 1}</td>
                <td style={{ fontWeight: 600 }}>{item.description}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: item.lineType === 'service' ? '#EEF2FF' : '#FEF6EC', color: item.lineType === 'service' ? '#4361EE' : '#B26A0E', fontWeight: 700 }}>
                    {item.lineType}
                  </span>
                </td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.qty}</td>
                <td style={{ textAlign: 'right', color: '#6B778C' }}>
                  {item.unitPrice.toLocaleString()}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                  {item.lineTotal.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Financial Totals & Payments Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          {/* Payment Receipts History */}
          <div style={{ flex: 1, maxWidth: '340px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#152033', marginBottom: '6px' }}>
              Payment Receipts ({invoice.payments?.length || 0})
            </div>
            {invoice.payments?.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#E35757', fontWeight: 600 }}>
                ⚠️ Payment Pending (Unpaid)
              </div>
            ) : (
              <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {invoice.payments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dotted #E4E9F2' }}>
                    <span>{p.paymentDate ? p.paymentDate.slice(0, 10) : ''} • {p.paymentMethod}</span>
                    <strong>Rs. {p.amount.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grand Totals Box */}
          <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6B778C' }}>Subtotal:</span>
              <strong>Rs. {invoice.subtotal.toLocaleString()}</strong>
            </div>

            {invoice.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#E35757' }}>
                <span>Discount:</span>
                <strong>- Rs. {invoice.discount.toLocaleString()}</strong>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: '#152033', padding: '6px 0', borderTop: '2px solid #152033' }}>
              <span>Total Bill:</span>
              <span>Rs. {invoice.total.toLocaleString()}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#197B4B', fontWeight: 600 }}>
              <span>Amount Paid:</span>
              <span>Rs. {invoice.amountPaid.toLocaleString()}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: invoice.balance > 0 ? '#E35757' : '#197B4B', fontWeight: 800, fontSize: '14px', paddingTop: '4px', borderTop: '1px solid #E4E9F2' }}>
              <span>Balance Due:</span>
              <span>Rs. {invoice.balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Perforated Cut Line */}
        <div className="perforated-cut-line">
          ✂ CUT ALONG LINE — DETACH SERVICE STICKER BELOW
        </div>

        {/* Attached Windshield Reminder Sticker */}
        <div className="windshield-sticker">
          <div className="sticker-brand">{invoice.sticker?.stationName || 'OMEGA ENGINEERS'}</div>
          <div className="sticker-headline">{invoice.sticker?.headline || 'NEXT SERVICE DUE'}</div>
          <div className="sticker-row">
            <span style={{ color: '#6B778C' }}>Vehicle:</span>
            <strong style={{ color: 'var(--primary)' }}>{invoice.sticker?.registrationNo}</strong>
          </div>
          <div className="sticker-row">
            <span style={{ color: '#6B778C' }}>Next Due Date:</span>
            <strong>{invoice.sticker?.dateFormatted}</strong>
          </div>
          <div className="sticker-row">
            <span style={{ color: '#6B778C' }}>Due Mileage:</span>
            <strong>{invoice.sticker?.mileageText}</strong>
          </div>
          <div className="sticker-footer">
            {invoice.sticker?.note || 'Keep this sticker on windshield'}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <Modal
          isOpen={true}
          title={`Record Payment for ${invoice.invoiceNo}`}
          onClose={() => setIsPaymentModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsPaymentModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRecordPayment}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Recording...' : 'Record Payment Receipt'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}

          <div style={{ padding: '12px 16px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Total Invoice Amount:</span>
              <strong>Rs. {invoice.total.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Previously Paid:</span>
              <strong style={{ color: 'var(--success-text)' }}>Rs. {invoice.amountPaid.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--danger)' }}>
              <span>Remaining Balance:</span>
              <span>Rs. {invoice.balance.toLocaleString()}</span>
            </div>
          </div>

          <form onSubmit={handleRecordPayment}>
            <div className="form-group">
              <label className="form-label">Payment Amount (Rs.) <span className="req">*</span></label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder="Enter amount paid"
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                >
                  <option>Cash</option>
                  <option>Credit / Debit Card</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reference / Transaction No.</label>
                <input
                  type="text"
                  className="form-input"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                  placeholder="e.g. Card slip no, Txn ID"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes (Optional)</label>
              <input
                type="text"
                className="form-input"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Additional notes"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
