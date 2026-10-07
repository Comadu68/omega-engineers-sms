const dbHelper = require('../../database/db.cjs')

const record = ({
  invoiceId,
  amount,
  paymentMethod = 'Cash',
  referenceNo = '',
  notes = '',
  userId = null
}) => {
  const payAmount = parseFloat(amount)
  if (!invoiceId || isNaN(payAmount) || payAmount <= 0) {
    throw new Error('Valid invoice ID and positive payment amount are required.')
  }

  return dbHelper.runTransaction(() => {
    const invoice = dbHelper.queryOne('SELECT id, total FROM invoices WHERE id = ?', [invoiceId])
    if (!invoice) throw new Error('Invoice not found.')

    // Record payment
    const res = dbHelper.runSql(
      `INSERT INTO payments (invoice_id, amount, payment_method, reference_no, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        payAmount,
        paymentMethod.trim(),
        referenceNo ? referenceNo.trim() : null,
        notes ? notes.trim() : null,
        userId
      ]
    )

    // Calculate new total paid
    const totalPaidRow = dbHelper.queryOne(
      'SELECT SUM(amount) AS totalPaid FROM payments WHERE invoice_id = ?',
      [invoiceId]
    )
    const totalPaid = totalPaidRow ? totalPaidRow.totalPaid : 0

    // Update payment status
    let newStatus = 'unpaid'
    if (totalPaid >= invoice.total) {
      newStatus = 'paid'
    } else if (totalPaid > 0) {
      newStatus = 'partially_paid'
    }

    dbHelper.runSql(
      'UPDATE invoices SET payment_status = ? WHERE id = ?',
      [newStatus, invoiceId]
    )

    return {
      paymentId: res.lastInsertRowid,
      invoiceId,
      amount: payAmount,
      totalPaid,
      balance: Math.max(0, invoice.total - totalPaid),
      paymentStatus: newStatus
    }
  })
}

const listByInvoice = (invoiceId) => {
  return dbHelper.queryAll(
    `SELECT p.*, u.display_name AS recordedByName
     FROM payments p
     LEFT JOIN users u ON u.id = p.recorded_by
     WHERE p.invoice_id = ?
     ORDER BY p.payment_date DESC, p.id DESC`,
    [invoiceId]
  )
}

module.exports = {
  record,
  listByInvoice
}
