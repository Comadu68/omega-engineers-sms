import React, { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'

export const InvoicePrintView = ({ invoiceId, onBack, onPaymentRecorded }) => {
  const [invoice, setInvoice] = useState(null)
  const [stationSettings, setStationSettings] = useState({
    station_name: 'OMEGA ENGINEERS SERVICE STATION',
    company_name: 'Solotrade Company',
    station_address: '123 Galle Road, Colombo',
    station_phone: '011 234 5678',
    currency_symbol: 'Rs.'
  })
  const [printMode, setPrintMode] = useState('a4') // 'a4' | 'pos' | 'sticker'
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
      const [data, allSettings] = await Promise.all([
        window.omega.invoices.get(invoiceId),
        window.omega.settings.getAll().catch(() => null)
      ])
      setInvoice(data)
      if (allSettings) {
        setStationSettings((prev) => ({ ...prev, ...allSettings }))
      }
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

  const stationName = (stationSettings.station_name || 'OMEGA ENGINEERS SERVICE STATION').toUpperCase()
  const companyName = stationSettings.company_name || 'Solotrade Company'
  const stationAddress = stationSettings.station_address || '123 Galle Road, Colombo'
  const stationPhone = stationSettings.station_phone || '011 234 5678'
  const currency = stationSettings.currency_symbol || 'Rs.'

  return (
    <div className="content-scrollable">
      {/* Top action toolbar (hidden on print) */}
      <div className="toolbar no-print" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
            ← Back to Invoices
          </button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
            Invoice &amp; Receipt Print Center
          </h2>
          <Badge status={invoice.paymentStatus} />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {invoice.balance > 0 && (
            <button
              type="button"
              className="btn btn-success"
              onClick={() => setIsPaymentModalOpen(true)}
            >
              💳 Record Payment (Balance: {currency} {invoice.balance.toLocaleString()})
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            🖶 Print {printMode === 'pos' ? '80mm POS Receipt' : printMode === 'sticker' ? 'Service Sticker' : 'A4 Bill + Sticker'}
          </button>
        </div>
      </div>

      {/* Print Format Mode Switcher (SCRUM-33) */}
      <div className="toolbar no-print" style={{ marginBottom: '24px', background: '#FFFFFF', padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
          SELECT PRINT LAYOUT FORMAT:
        </div>
        <div className="filter-chips">
          <button
            type="button"
            className={`chip ${printMode === 'a4' ? 'active' : ''}`}
            onClick={() => setPrintMode('a4')}
          >
            📄 A4 Official Invoice + Sticker
          </button>
          <button
            type="button"
            className={`chip ${printMode === 'pos' ? 'active' : ''}`}
            onClick={() => setPrintMode('pos')}
          >
            🧾 80mm POS Thermal Receipt
          </button>
          <button
            type="button"
            className={`chip ${printMode === 'sticker' ? 'active' : ''}`}
            onClick={() => setPrintMode('sticker')}
          >
            🏷️ Windshield Service Sticker Only
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODE 1: A4 OFFICIAL INVOICE + SERVICE STICKER                       */}
      {/* =================================================================== */}
      {printMode === 'a4' && (
        <div className="invoice-paper print-target">
          {/* Bill Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #152033', paddingBottom: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#152033', letterSpacing: '0.5px' }}>
                {stationName}
              </div>
              <div style={{ fontSize: '12px', color: '#6B778C', marginTop: '2px' }}>
                {companyName} • {stationAddress}
              </div>
              <div style={{ fontSize: '12px', color: '#6B778C' }}>
                Tel: {stationPhone} • Email: service@omegaengineers.lk
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
                <th style={{ width: '120px', textAlign: 'right' }}>Amount ({currency})</th>
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
                      <strong>{currency} {p.amount.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grand Totals Box */}
            <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B778C' }}>Subtotal:</span>
                <strong>{currency} {invoice.subtotal.toLocaleString()}</strong>
              </div>

              {invoice.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#E35757' }}>
                  <span>Discount:</span>
                  <strong>- {currency} {invoice.discount.toLocaleString()}</strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: '#152033', padding: '6px 0', borderTop: '2px solid #152033' }}>
                <span>Total Bill:</span>
                <span>{currency} {invoice.total.toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#197B4B', fontWeight: 600 }}>
                <span>Amount Paid:</span>
                <span>{currency} {invoice.amountPaid.toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: invoice.balance > 0 ? '#E35757' : '#197B4B', fontWeight: 800, fontSize: '14px', paddingTop: '4px', borderTop: '1px solid #E4E9F2' }}>
                <span>Balance Due:</span>
                <span>{currency} {invoice.balance.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Perforated Cut Line */}
          <div className="perforated-cut-line">
            ✂ CUT ALONG LINE — DETACH SERVICE STICKER BELOW
          </div>

          {/* Attached Windshield Reminder Sticker */}
          <div className="windshield-sticker">
            <div className="sticker-brand">{stationName}</div>
            <div className="sticker-headline">{invoice.sticker?.headline || 'NEXT SERVICE DUE'}</div>
            <div className="sticker-row">
              <span style={{ color: '#6B778C' }}>Vehicle:</span>
              <strong style={{ color: 'var(--primary)' }}>{invoice.sticker?.registrationNo || invoice.registrationNo}</strong>
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
      )}

      {/* =================================================================== */}
      {/* MODE 2: 80mm POS THERMAL RECEIPT (SCRUM-33)                         */}
      {/* =================================================================== */}
      {printMode === 'pos' && (
        <div className="pos-receipt-paper print-target">
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px' }}>{stationName}</div>
            <div style={{ fontSize: '11px' }}>{companyName}</div>
            <div style={{ fontSize: '11px' }}>{stationAddress}</div>
            <div style={{ fontSize: '11px' }}>Tel: {stationPhone}</div>
          </div>

          <div className="pos-divider" />

          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '12px', margin: '4px 0' }}>
            POS CASH / SERVICE RECEIPT
          </div>

          <div className="pos-divider" />

          <div style={{ fontSize: '11px', lineHeight: 1.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>INVOICE NO:</span>
              <strong>{invoice.invoiceNo}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>DATE:</span>
              <span>{invoice.issuedAt ? invoice.issuedAt.slice(0, 16).replace('T', ' ') : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>JOB CARD:</span>
              <strong>{invoice.jobNo}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>VEHICLE NO:</span>
              <strong>{invoice.registrationNo}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CUSTOMER:</span>
              <span>{invoice.customerName}</span>
            </div>
            {invoice.customerPhone && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>PHONE:</span>
                <span>{invoice.customerPhone}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>TECHNICIAN:</span>
              <span>{invoice.mechanicName || 'Workshop'}</span>
            </div>
          </div>

          <div className="pos-divider" />

          {/* Line Items */}
          <div style={{ fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: '4px' }}>
              <span>DESCRIPTION</span>
              <span>AMOUNT ({currency})</span>
            </div>
            {invoice.items.map((item, idx) => (
              <div key={item.id} style={{ marginBottom: '6px' }}>
                <div style={{ fontWeight: 700 }}>
                  {idx + 1}. {item.description}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#333', paddingLeft: '10px' }}>
                  <span>
                    {item.qty} x {item.unitPrice.toLocaleString()} ({item.lineType.toUpperCase()})
                  </span>
                  <strong>{item.lineTotal.toLocaleString()}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className="pos-divider" />

          {/* Totals */}
          <div style={{ fontSize: '11px', lineHeight: 1.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SUBTOTAL:</span>
              <strong>{currency} {invoice.subtotal.toLocaleString()}</strong>
            </div>
            {invoice.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>DISCOUNT:</span>
                <strong>- {currency} {invoice.discount.toLocaleString()}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800, margin: '4px 0', padding: '4px 0', borderTop: '1px dashed #000', borderBottom: '1px dashed #000' }}>
              <span>GRAND TOTAL:</span>
              <span>{currency} {invoice.total.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>AMOUNT PAID:</span>
              <strong>{currency} {invoice.amountPaid.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>BALANCE DUE:</span>
              <span>{currency} {invoice.balance.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>STATUS:</span>
              <strong style={{ textTransform: 'uppercase' }}>{invoice.paymentStatus.replace('_', ' ')}</strong>
            </div>
          </div>

          {invoice.payments && invoice.payments.length > 0 && (
            <>
              <div className="pos-divider" />
              <div style={{ fontSize: '10px' }}>
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>PAYMENTS RECEIVED:</div>
                {invoice.payments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.paymentDate ? p.paymentDate.slice(0, 10) : ''} ({p.paymentMethod})</span>
                    <span>{currency} {p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="pos-divider" />

          {/* Next Service Reminder Box */}
          <div style={{ border: '1px dashed #000', padding: '6px', margin: '8px 0', textAlign: 'center', fontSize: '10px' }}>
            <div style={{ fontWeight: 800 }}>NEXT SERVICE REMINDER</div>
            <div>Due Date: <strong>{invoice.sticker?.dateFormatted}</strong></div>
            <div>Due Mileage: <strong>{invoice.sticker?.mileageText}</strong></div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '8px' }}>
            <div style={{ fontWeight: 700 }}>THANK YOU FOR CHOOSING OMEGA ENGINEERS!</div>
            <div>Drive Safely • Come Again</div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE 3: WINDSHIELD SERVICE STICKER ONLY                             */}
      {/* =================================================================== */}
      {printMode === 'sticker' && (
        <div className="print-target" style={{ padding: '24px' }}>
          <div className="windshield-sticker">
            <div className="sticker-brand">{stationName}</div>
            <div className="sticker-headline">{invoice.sticker?.headline || 'NEXT SERVICE DUE'}</div>
            <div className="sticker-row">
              <span style={{ color: '#6B778C' }}>Vehicle:</span>
              <strong style={{ color: 'var(--primary)' }}>{invoice.sticker?.registrationNo || invoice.registrationNo}</strong>
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
      )}

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
              <strong>{currency} {invoice.total.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Previously Paid:</span>
              <strong style={{ color: 'var(--success-text)' }}>{currency} {invoice.amountPaid.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--danger)' }}>
              <span>Remaining Balance:</span>
              <span>{currency} {invoice.balance.toLocaleString()}</span>
            </div>
          </div>

          <form onSubmit={handleRecordPayment}>
            <div className="form-group">
              <label className="form-label">Payment Amount ({currency}) <span className="req">*</span></label>
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
