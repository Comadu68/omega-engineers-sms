const dbHelper = require('../../database/db.cjs')

const EXPENSE_CATEGORIES = [
  'Wages / Labour',
  'Utilities (Electricity, Water)',
  'Workshop Consumables',
  'Transport & Delivery',
  'Workshop Rent',
  'Equipment Maintenance',
  'Office Supplies',
  'Miscellaneous'
]

const list = ({ dateFrom = null, dateTo = null, category = null } = {}) => {
  let sql = `
    SELECT e.id, e.expense_date AS expenseDate, e.category, e.description,
           e.amount, e.reference_no AS referenceNo, e.created_at AS createdAt,
           u.display_name AS recordedByName
    FROM expenses e
    LEFT JOIN users u ON u.id = e.recorded_by
  `
  const conditions = []
  const params = []

  if (category) {
    conditions.push('e.category = ?')
    params.push(category)
  }

  if (dateFrom && dateTo) {
    conditions.push('date(e.expense_date) BETWEEN ? AND ?')
    params.push(dateFrom, dateTo)
  } else if (dateFrom) {
    conditions.push('date(e.expense_date) >= ?')
    params.push(dateFrom)
  } else if (dateTo) {
    conditions.push('date(e.expense_date) <= ?')
    params.push(dateTo)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY e.expense_date DESC, e.id DESC'
  return dbHelper.queryAll(sql, params)
}

const create = ({
  expenseDate = null,
  category,
  description,
  amount,
  referenceNo = '',
  userId = null
}) => {
  const expenseAmount = parseFloat(amount)
  if (!category || !description || isNaN(expenseAmount) || expenseAmount < 0) {
    throw new Error('Category, description, and a valid non-negative amount are required.')
  }

  const dateStr = expenseDate || new Date().toISOString().slice(0, 10)

  const res = dbHelper.runSql(
    `INSERT INTO expenses (expense_date, category, description, amount, reference_no, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      dateStr,
      category.trim(),
      description.trim(),
      expenseAmount,
      referenceNo ? referenceNo.trim() : null,
      userId
    ]
  )

  return dbHelper.queryOne(
    `SELECT e.*, u.display_name AS recordedByName
     FROM expenses e
     LEFT JOIN users u ON u.id = e.recorded_by
     WHERE e.id = ?`,
    [res.lastInsertRowid]
  )
}

const remove = (id) => {
  dbHelper.runSql('DELETE FROM expenses WHERE id = ?', [id])
  return { success: true }
}

const getCategories = () => EXPENSE_CATEGORIES

module.exports = {
  list,
  create,
  remove,
  getCategories
}
