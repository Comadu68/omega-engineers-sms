const dbHelper = require('../../database/db.cjs')

const dailySummary = (selectedDate = null) => {
  const date = selectedDate || new Date().toISOString().slice(0, 10)

  // 1. Service Revenue on date
  const serviceRevRow = dbHelper.queryOne(
    `SELECT COALESCE(SUM(ii.line_total), 0) AS serviceRevenue
     FROM invoice_items ii
     JOIN invoices inv ON inv.id = ii.invoice_id
     WHERE date(inv.issued_at) = ? AND ii.line_type = 'service' AND inv.payment_status != 'void'`,
    [date]
  )
  const serviceRevenue = serviceRevRow ? serviceRevRow.serviceRevenue : 0

  // 2. Parts Revenue on date
  const partsRevRow = dbHelper.queryOne(
    `SELECT COALESCE(SUM(ii.line_total), 0) AS partsRevenue,
            COALESCE(SUM(ii.unit_cost_snapshot * ii.qty), 0) AS partsCogs
     FROM invoice_items ii
     JOIN invoices inv ON inv.id = ii.invoice_id
     WHERE date(inv.issued_at) = ? AND ii.line_type = 'part' AND inv.payment_status != 'void'`,
    [date]
  )
  const partsRevenue = partsRevRow ? partsRevRow.partsRevenue : 0
  const partsCogs = partsRevRow ? partsRevRow.partsCogs : 0

  // 3. Total Revenue
  const totalRevenue = serviceRevenue + partsRevenue

  // 4. Operating Expenses on date
  const expRow = dbHelper.queryOne(
    'SELECT COALESCE(SUM(amount), 0) AS totalExpenses FROM expenses WHERE date(expense_date) = ?',
    [date]
  )
  const operatingExpenses = expRow ? expRow.totalExpenses : 0

  // 5. Profit calculations
  const grossProfit = totalRevenue - partsCogs
  const netProfit = grossProfit - operatingExpenses

  // 6. Cash Collected on date
  const cashRow = dbHelper.queryOne(
    'SELECT COALESCE(SUM(amount), 0) AS cashCollected FROM payments WHERE date(payment_date) = ?',
    [date]
  )
  const cashCollected = cashRow ? cashRow.cashCollected : 0

  // 7. Recent 7-day trend chart comparison
  const trendDays = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(date)
    d.setDate(d.getDate() - i)
    const dayStr = d.toISOString().slice(0, 10)

    const revDay = dbHelper.queryOne(
      `SELECT COALESCE(SUM(total), 0) AS rev
       FROM invoices WHERE date(issued_at) = ? AND payment_status != 'void'`,
      [dayStr]
    )
    const cogsDay = dbHelper.queryOne(
      `SELECT COALESCE(SUM(ii.unit_cost_snapshot * ii.qty), 0) AS cogs
       FROM invoice_items ii
       JOIN invoices inv ON inv.id = ii.invoice_id
       WHERE date(inv.issued_at) = ? AND ii.line_type = 'part' AND inv.payment_status != 'void'`,
      [dayStr]
    )
    const expDay = dbHelper.queryOne(
      'SELECT COALESCE(SUM(amount), 0) AS exp FROM expenses WHERE date(expense_date) = ?',
      [dayStr]
    )

    const rev = revDay ? revDay.rev : 0
    const cogs = cogsDay ? cogsDay.cogs : 0
    const exp = expDay ? expDay.exp : 0
    const profit = rev - cogs - exp

    trendDays.push({
      date: dayStr,
      revenue: rev,
      cogs,
      expenses: exp,
      netProfit: profit
    })
  }

  // 8. Invoices list for the day
  const dailyInvoices = dbHelper.queryAll(
    `SELECT inv.id, inv.invoice_no AS invoiceNo, inv.total, inv.payment_status AS paymentStatus,
            c.full_name AS customerName, v.registration_no AS registrationNo, j.job_no AS jobNo
     FROM invoices inv
     JOIN customers c ON c.id = inv.customer_id
     JOIN vehicles v ON v.id = inv.vehicle_id
     JOIN job_cards j ON j.id = inv.job_card_id
     WHERE date(inv.issued_at) = ?
     ORDER BY inv.id DESC`,
    [date]
  )

  // 9. Expenses list for the day
  const dailyExpenses = dbHelper.queryAll(
    `SELECT id, category, description, amount, reference_no AS referenceNo
     FROM expenses WHERE date(expense_date) = ? ORDER BY id DESC`,
    [date]
  )

  return {
    date,
    serviceRevenue,
    partsRevenue,
    totalRevenue,
    partsCogs,
    grossProfit,
    operatingExpenses,
    netProfit,
    cashCollected,
    trendDays,
    dailyInvoices,
    dailyExpenses
  }
}

const jobCardsReport = ({ dateFrom = null, dateTo = null, mechanicId = null, status = null } = {}) => {
  let sql = `
    SELECT j.id, j.job_no AS jobNo, j.status, j.opened_at AS openedAt,
           j.completed_at AS completedAt, j.cancelled_at AS cancelledAt,
           c.full_name AS customerName, v.registration_no AS registrationNo,
           m.name AS mechanicName,
           COALESCE(inv.total, 0) AS billAmount
    FROM job_cards j
    JOIN customers c ON c.id = j.customer_id
    JOIN vehicles v ON v.id = j.vehicle_id
    LEFT JOIN job_assignments ja ON ja.job_card_id = j.id AND ja.unassigned_at IS NULL
    LEFT JOIN mechanics m ON m.id = ja.mechanic_id
    LEFT JOIN invoices inv ON inv.job_card_id = j.id
  `
  const conditions = []
  const params = []

  if (status) {
    conditions.push('j.status = ?')
    params.push(status)
  }
  if (mechanicId) {
    conditions.push('ja.mechanic_id = ?')
    params.push(mechanicId)
  }
  if (dateFrom && dateTo) {
    conditions.push('date(j.opened_at) BETWEEN ? AND ?')
    params.push(dateFrom, dateTo)
  } else if (dateFrom) {
    conditions.push('date(j.opened_at) >= ?')
    params.push(dateFrom)
  } else if (dateTo) {
    conditions.push('date(j.opened_at) <= ?')
    params.push(dateTo)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY j.opened_at DESC'
  const rows = dbHelper.queryAll(sql, params)

  const summary = {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    totalBilled: rows.reduce((acc, r) => acc + (r.billAmount || 0), 0)
  }

  return { summary, rows }
}

const salesReport = ({ dateFrom = null, dateTo = null } = {}) => {
  let sql = `
    SELECT inv.id, inv.invoice_no AS invoiceNo, inv.issued_at AS issuedAt,
           inv.subtotal, inv.discount, inv.total, inv.payment_status AS paymentStatus,
           c.full_name AS customerName, v.registration_no AS registrationNo,
           COALESCE((SELECT SUM(ii.unit_cost_snapshot * ii.qty) FROM invoice_items ii WHERE ii.invoice_id = inv.id AND ii.line_type = 'part'), 0) AS partsCogs
    FROM invoices inv
    JOIN customers c ON c.id = inv.customer_id
    JOIN vehicles v ON v.id = inv.vehicle_id
    WHERE inv.payment_status != 'void'
  `
  const params = []
  if (dateFrom && dateTo) {
    sql += ' AND date(inv.issued_at) BETWEEN ? AND ?'
    params.push(dateFrom, dateTo)
  }

  sql += ' ORDER BY inv.issued_at DESC'
  const rows = dbHelper.queryAll(sql, params)

  const totalSales = rows.reduce((sum, r) => sum + r.total, 0)
  const totalCogs = rows.reduce((sum, r) => sum + r.partsCogs, 0)
  const grossProfit = totalSales - totalCogs

  return {
    totalSales,
    totalCogs,
    grossProfit,
    invoiceCount: rows.length,
    rows
  }
}

const inventoryReport = () => {
  const sql = `
    SELECT i.id, i.sku, i.name, i.category, i.minimum_stock_level AS minStock,
           i.current_selling_price AS sellingPrice,
           COALESCE(SUM(b.remaining_qty), 0) AS currentStock,
           COALESCE(SUM(b.remaining_qty * b.unit_cost), 0) AS valuationAtCost,
           COALESCE(SUM(b.remaining_qty * i.current_selling_price), 0) AS potentialSalesValue
    FROM inventory_items i
    LEFT JOIN inventory_batches b ON b.inventory_item_id = i.id
    GROUP BY i.id
    ORDER BY i.name ASC
  `
  const rows = dbHelper.queryAll(sql)
  const totalValuation = rows.reduce((sum, r) => sum + r.valuationAtCost, 0)
  const totalPotential = rows.reduce((sum, r) => sum + r.potentialSalesValue, 0)
  const lowStockCount = rows.filter((r) => r.currentStock <= r.minStock).length

  return {
    totalItems: rows.length,
    totalValuation,
    totalPotential,
    lowStockCount,
    rows
  }
}

const mechanicPerformanceReport = ({ dateFrom = null, dateTo = null } = {}) => {
  let dateFilter = ''
  const params = []
  if (dateFrom && dateTo) {
    dateFilter = 'AND date(j.opened_at) BETWEEN ? AND ?'
    params.push(dateFrom, dateTo)
  }

  const sql = `
    SELECT m.id, m.name, m.specialty, m.availability_status AS availabilityStatus,
           COUNT(DISTINCT j.id) AS totalAssignedJobs,
           COUNT(DISTINCT CASE WHEN j.status = 'completed' THEN j.id END) AS completedJobs,
           COUNT(DISTINCT CASE WHEN j.status IN ('pending', 'in_progress') THEN j.id END) AS activeJobs,
           COALESCE(SUM(CASE WHEN j.status = 'completed' THEN inv.total END), 0) AS totalRevenueHandled
    FROM mechanics m
    LEFT JOIN job_assignments ja ON ja.mechanic_id = m.id
    LEFT JOIN job_cards j ON j.id = ja.job_card_id ${dateFilter}
    LEFT JOIN invoices inv ON inv.job_card_id = j.id
    WHERE m.is_active = 1
    GROUP BY m.id
    ORDER BY completedJobs DESC, m.name ASC
  `
  const rows = dbHelper.queryAll(sql, params)
  return rows
}

module.exports = {
  dailySummary,
  jobCardsReport,
  salesReport,
  inventoryReport,
  mechanicPerformanceReport
}
