import React, { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'

export const Reports = () => {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [activeTab, setActiveTab] = useState('daily') // 'daily', 'jobs', 'sales', 'inventory', 'mechanics'

  // Daily Summary State
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [dailyData, setDailyData] = useState(null)
  const [dailyLoading, setDailyLoading] = useState(true)

  // Add Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [expenseCategories, setExpenseCategories] = useState([])
  const [expenseForm, setExpenseForm] = useState({
    expenseDate: todayStr,
    category: 'Workshop Consumables',
    description: '',
    amount: '',
    referenceNo: ''
  })
  const [expenseSubmitting, setExpenseSubmitting] = useState(false)

  // Other Reports State
  const [jobsReport, setJobsReport] = useState(null)
  const [salesReport, setSalesReport] = useState(null)
  const [inventoryReport, setInventoryReport] = useState(null)
  const [mechanicsReport, setMechanicsReport] = useState([])
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [reportLoading, setReportLoading] = useState(false)

  const loadDailySummary = async () => {
    try {
      setDailyLoading(true)
      const data = await window.omega.reports.dailySummary(selectedDate)
      setDailyData(data)
      const cats = await window.omega.expenses.getCategories()
      setExpenseCategories(cats)
    } catch (err) {
      console.error('Failed to load daily summary:', err)
    } finally {
      setDailyLoading(false)
    }
  }

  const loadOtherReports = async () => {
    try {
      setReportLoading(true)
      const filters = {
        dateFrom: dateRange.from || null,
        dateTo: dateRange.to || null
      }

      if (activeTab === 'jobs') {
        const data = await window.omega.reports.jobCards(filters)
        setJobsReport(data)
      } else if (activeTab === 'sales') {
        const data = await window.omega.reports.sales(filters)
        setSalesReport(data)
      } else if (activeTab === 'inventory') {
        const data = await window.omega.reports.inventory()
        setInventoryReport(data)
      } else if (activeTab === 'mechanics') {
        const data = await window.omega.reports.mechanicPerformance(filters)
        setMechanicsReport(data)
      }
    } catch (err) {
      console.error('Failed to load report:', err)
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailySummary()
    } else {
      loadOtherReports()
    }
  }, [activeTab, selectedDate, dateRange])

  const handleAddExpense = async (e) => {
    e.preventDefault()
    const amt = parseFloat(expenseForm.amount)
    if (!expenseForm.description.trim() || isNaN(amt) || amt <= 0) {
      alert('Please provide a description and a valid positive amount.')
      return
    }

    try {
      setExpenseSubmitting(true)
      await window.omega.expenses.create({
        expenseDate: expenseForm.expenseDate || selectedDate,
        category: expenseForm.category,
        description: expenseForm.description.trim(),
        amount: amt,
        referenceNo: expenseForm.referenceNo.trim()
      })
      setIsExpenseModalOpen(false)
      setExpenseForm({
        expenseDate: selectedDate,
        category: expenseCategories[0] || 'Workshop Consumables',
        description: '',
        amount: '',
        referenceNo: ''
      })
      loadDailySummary()
    } catch (err) {
      alert(err.message || 'Failed to add expense.')
    } finally {
      setExpenseSubmitting(false)
    }
  }

  const handleDeleteExpense = async (id) => {
    if (window.confirm('Delete this expense entry?')) {
      try {
        await window.omega.expenses.remove(id)
        loadDailySummary()
      } catch (err) {
        alert(err.message || 'Failed to delete expense.')
      }
    }
  }

  // Pure SVG Trend Chart calculations
  const renderTrendChart = () => {
    if (!dailyData || !dailyData.trendDays || dailyData.trendDays.length === 0) return null

    const days = dailyData.trendDays
    const maxVal = Math.max(
      ...days.map((d) => Math.max(d.revenue, d.cogs + d.expenses, d.netProfit, 1000))
    )

    const chartWidth = 560
    const chartHeight = 180
    const padding = 30
    const barWidth = 18
    const groupWidth = (chartWidth - padding * 2) / days.length

    return (
      <svg width="100%" height={chartHeight + 40} viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = chartHeight - padding - ratio * (chartHeight - padding * 2)
          return (
            <g key={idx}>
              <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#E4E9F2" strokeDasharray="3 3" />
              <text x={padding - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#9AA6B8">
                {Math.round((maxVal * ratio) / 1000)}k
              </text>
            </g>
          )
        })}

        {/* Day Bars */}
        {days.map((d, idx) => {
          const groupX = padding + idx * groupWidth + groupWidth / 2
          const revHeight = ((d.revenue || 0) / maxVal) * (chartHeight - padding * 2)
          const costHeight = (((d.cogs || 0) + (d.expenses || 0)) / maxVal) * (chartHeight - padding * 2)
          const profitHeight = (Math.max(0, d.netProfit || 0) / maxVal) * (chartHeight - padding * 2)

          const isCurrent = d.date === selectedDate

          return (
            <g key={idx}>
              {/* Revenue bar */}
              <rect
                x={groupX - barWidth * 1.5}
                y={chartHeight - padding - revHeight}
                width={barWidth * 0.9}
                height={Math.max(2, revHeight)}
                fill="#4361EE"
                rx="3"
              />
              {/* Cost/Expense bar */}
              <rect
                x={groupX - barWidth * 0.5}
                y={chartHeight - padding - costHeight}
                width={barWidth * 0.9}
                height={Math.max(2, costHeight)}
                fill="#E35757"
                rx="3"
              />
              {/* Profit bar */}
              <rect
                x={groupX + barWidth * 0.5}
                y={chartHeight - padding - profitHeight}
                width={barWidth * 0.9}
                height={Math.max(2, profitHeight)}
                fill="#2FB171"
                rx="3"
              />

              {/* Date Label */}
              <text
                x={groupX}
                y={chartHeight + 14}
                textAnchor="middle"
                fontSize="10"
                fontWeight={isCurrent ? '700' : '400'}
                fill={isCurrent ? '#4361EE' : '#6B778C'}
              >
                {d.date.slice(5)}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <div className="content-scrollable">
      {/* Top Report Tab Navigation */}
      <div className="toolbar" style={{ marginBottom: '18px' }}>
        <div className="filter-chips">
          <button
            type="button"
            className={`chip ${activeTab === 'daily' ? 'active' : ''}`}
            onClick={() => setActiveTab('daily')}
          >
            📊 Daily Financial Summary
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            📋 Job Cards Report
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            💳 Sales &amp; Revenue
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            📦 Inventory Valuation
          </button>
          <button
            type="button"
            className={`chip ${activeTab === 'mechanics' ? 'active' : ''}`}
            onClick={() => setActiveTab('mechanics')}
          >
            🔧 Mechanic Performance
          </button>
        </div>

        {activeTab === 'daily' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Date:</span>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '5px 10px', fontSize: '12px' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedDate(todayStr)}
            >
              Today
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '5px 8px', fontSize: '11px' }}
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ width: 'auto', padding: '5px 8px', fontSize: '11px' }}
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDateRange({ from: '', to: '' })}
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* DAILY SUMMARY TAB */}
      {activeTab === 'daily' && (
        <div>
          {dailyLoading || !dailyData ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Calculating daily financial metrics...
            </div>
          ) : (
            <div>
              {/* Daily KPI Cards Row */}
              <div className="kpi-grid">
                <div className="kpi-card" style={{ '--accent-color': 'var(--primary)' }}>
                  <div className="kpi-label">Total Revenue</div>
                  <div className="kpi-value" style={{ color: 'var(--primary)' }}>
                    Rs. {dailyData.totalRevenue.toLocaleString()}
                  </div>
                  <div className="kpi-subtext">Services + Parts Sales</div>
                </div>

                <div className="kpi-card" style={{ '--accent-color': 'var(--warning)' }}>
                  <div className="kpi-label">Parts FIFO COGS</div>
                  <div className="kpi-value" style={{ color: 'var(--warning-text)' }}>
                    Rs. {dailyData.partsCogs.toLocaleString()}
                  </div>
                  <div className="kpi-subtext">Actual batch cost of sold parts</div>
                </div>

                <div className="kpi-card" style={{ '--accent-color': 'var(--danger)' }}>
                  <div className="kpi-label">Operating Expenses</div>
                  <div className="kpi-value" style={{ color: 'var(--danger)' }}>
                    Rs. {dailyData.operatingExpenses.toLocaleString()}
                  </div>
                  <div className="kpi-subtext">Utilities, Labour, Consumables</div>
                </div>

                <div className="kpi-card" style={{ '--accent-color': 'var(--success)' }}>
                  <div className="kpi-label">Net Profit</div>
                  <div
                    className="kpi-value"
                    style={{ color: dailyData.netProfit >= 0 ? 'var(--success-text)' : 'var(--danger)' }}
                  >
                    Rs. {dailyData.netProfit.toLocaleString()}
                  </div>
                  <div className="kpi-subtext">Revenue - COGS - Expenses</div>
                </div>

                <div className="kpi-card" style={{ '--accent-color': '#0284C7' }}>
                  <div className="kpi-label">Cash Collected</div>
                  <div className="kpi-value" style={{ color: '#0284C7' }}>
                    Rs. {dailyData.cashCollected.toLocaleString()}
                  </div>
                  <div className="kpi-subtext">Actual payments received</div>
                </div>
              </div>

              {/* Middle Section: 7-Day Trend Chart & Financial Statement */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', marginBottom: '24px' }}>
                {/* Trend Chart */}
                <div className="card" style={{ margin: 0 }}>
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">7-Day Financial Performance Trend</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Comparison of Revenue, Cost/Expenses, and Net Profit
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '10px 0' }}>
                    {renderTrendChart()}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '20px',
                      fontSize: '11px',
                      fontWeight: 600,
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-subtle)'
                    }}
                  >
                    <span style={{ color: '#4361EE', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '10px', height: '10px', background: '#4361EE', borderRadius: '2px' }} />
                      Revenue
                    </span>
                    <span style={{ color: '#E35757', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '10px', height: '10px', background: '#E35757', borderRadius: '2px' }} />
                      COGS + Expenses
                    </span>
                    <span style={{ color: '#2FB171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '10px', height: '10px', background: '#2FB171', borderRadius: '2px' }} />
                      Net Profit
                    </span>
                  </div>
                </div>

                {/* Financial Statement Breakdown */}
                <div className="card" style={{ margin: 0 }}>
                  <div className="card-header">
                    <h3 className="card-title">Summary Breakdown ({dailyData.date})</h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Service / Labour Revenue:</span>
                      <strong>Rs. {dailyData.serviceRevenue.toLocaleString()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Parts Sales Revenue:</span>
                      <strong>Rs. {dailyData.partsRevenue.toLocaleString()}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--primary)' }}>
                      <span>Total Gross Revenue:</span>
                      <span>Rs. {dailyData.totalRevenue.toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning-text)' }}>
                      <span>Less: Parts FIFO COGS:</span>
                      <span>- Rs. {dailyData.partsCogs.toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border-subtle)', fontWeight: 700 }}>
                      <span>Gross Profit:</span>
                      <span>Rs. {dailyData.grossProfit.toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                      <span>Less: Operating Expenses:</span>
                      <span>- Rs. {dailyData.operatingExpenses.toLocaleString()}</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '16px',
                        fontWeight: 800,
                        color: dailyData.netProfit >= 0 ? 'var(--success-text)' : 'var(--danger)',
                        paddingTop: '10px',
                        borderTop: '2px solid var(--border-color)'
                      }}
                    >
                      <span>Net Operating Profit:</span>
                      <span>Rs. {dailyData.netProfit.toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '8px 10px', background: '#F0F9FF', borderRadius: '6px', color: '#0369A1', fontSize: '12px', fontWeight: 600 }}>
                      <span>Cash Collected (Payments):</span>
                      <strong>Rs. {dailyData.cashCollected.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Invoices on Date & Expenses on Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '20px' }}>
                {/* Invoices on Date */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Invoices Issued on {dailyData.date}</h3>
                  </div>
                  {dailyData.dailyInvoices?.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', padding: '10px 0' }}>
                      No invoices issued on this date.
                    </p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Invoice No</th>
                          <th>Customer</th>
                          <th>Vehicle</th>
                          <th>Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyData.dailyInvoices.map((inv) => (
                          <tr key={inv.id}>
                            <td style={{ fontWeight: 700 }}>{inv.invoiceNo}</td>
                            <td>{inv.customerName}</td>
                            <td style={{ fontWeight: 600 }}>{inv.registrationNo}</td>
                            <td style={{ fontWeight: 700 }}>Rs. {inv.total.toLocaleString()}</td>
                            <td><Badge status={inv.paymentStatus} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Operating Expenses on Date */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Operating Expenses Register</h3>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setIsExpenseModalOpen(true)}
                    >
                      + Record Expense
                    </button>
                  </div>
                  {dailyData.dailyExpenses?.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', padding: '10px 0' }}>
                      No operating expenses recorded for this date.
                    </p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Description</th>
                          <th>Amount</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyData.dailyExpenses.map((exp) => (
                          <tr key={exp.id}>
                            <td style={{ fontWeight: 600, fontSize: '12px' }}>{exp.category}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{exp.description}</td>
                            <td style={{ fontWeight: 700, color: 'var(--danger)' }}>
                              Rs. {exp.amount.toLocaleString()}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ padding: '2px 6px', fontSize: '10px' }}
                                onClick={() => handleDeleteExpense(exp.id)}
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* JOB CARDS REPORT TAB */}
      {activeTab === 'jobs' && (
        <div>
          {reportLoading || !jobsReport ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading job cards report...
            </div>
          ) : (
            <div>
              <div className="kpi-grid">
                <div className="kpi-card" style={{ '--accent-color': 'var(--primary)' }}>
                  <div className="kpi-label">Total Jobs</div>
                  <div className="kpi-value">{jobsReport.summary.total}</div>
                </div>
                <div className="kpi-card" style={{ '--accent-color': 'var(--warning)' }}>
                  <div className="kpi-label">Pending</div>
                  <div className="kpi-value">{jobsReport.summary.pending}</div>
                </div>
                <div className="kpi-card" style={{ '--accent-color': 'var(--info)' }}>
                  <div className="kpi-label">In Progress</div>
                  <div className="kpi-value">{jobsReport.summary.inProgress}</div>
                </div>
                <div className="kpi-card" style={{ '--accent-color': 'var(--success)' }}>
                  <div className="kpi-label">Completed</div>
                  <div className="kpi-value">{jobsReport.summary.completed}</div>
                </div>
                <div className="kpi-card" style={{ '--accent-color': 'var(--danger)' }}>
                  <div className="kpi-label">Cancelled</div>
                  <div className="kpi-value">{jobsReport.summary.cancelled}</div>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Customer</th>
                      <th>Vehicle</th>
                      <th>Technician</th>
                      <th>Status</th>
                      <th>Billed Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobsReport.rows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700 }}>{r.jobNo}</td>
                        <td>{r.customerName}</td>
                        <td>{r.registrationNo}</td>
                        <td>{r.mechanicName || '—'}</td>
                        <td><Badge status={r.status} /></td>
                        <td style={{ fontWeight: 700 }}>Rs. {r.billAmount ? r.billAmount.toLocaleString() : '0'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{r.openedAt ? r.openedAt.slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SALES REPORT TAB */}
      {activeTab === 'sales' && (
        <div>
          {reportLoading || !salesReport ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading sales report...
            </div>
          ) : (
            <div>
              <div className="kpi-grid">
                <div className="kpi-card" style={{ '--accent-color': 'var(--primary)' }}>
                  <div className="kpi-label">Total Invoiced Sales</div>
                  <div className="kpi-value">Rs. {salesReport.totalSales.toLocaleString()}</div>
                </div>
                <div className="kpi-card" style={{ '--accent-color': 'var(--warning)' }}>
                  <div className="kpi-label">Parts COGS</div>
                  <div className="kpi-value">Rs. {salesReport.totalCogs.toLocaleString()}</div>
                </div>
                <div className="kpi-card" style={{ '--accent-color': 'var(--success)' }}>
                  <div className="kpi-label">Gross Margin</div>
                  <div className="kpi-value">Rs. {salesReport.grossProfit.toLocaleString()}</div>
                </div>
                <div className="kpi-card" style={{ '--accent-color': 'var(--text-main)' }}>
                  <div className="kpi-label">Invoices Count</div>
                  <div className="kpi-value">{salesReport.invoiceCount}</div>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Customer</th>
                      <th>Vehicle</th>
                      <th>Subtotal</th>
                      <th>Discount</th>
                      <th>Grand Total</th>
                      <th>COGS</th>
                      <th>Payment Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesReport.rows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700 }}>{r.invoiceNo}</td>
                        <td>{r.customerName}</td>
                        <td>{r.registrationNo}</td>
                        <td>Rs. {r.subtotal.toLocaleString()}</td>
                        <td style={{ color: 'var(--danger)' }}>Rs. {r.discount.toLocaleString()}</td>
                        <td style={{ fontWeight: 800 }}>Rs. {r.total.toLocaleString()}</td>
                        <td style={{ color: 'var(--text-muted)' }}>Rs. {r.partsCogs.toLocaleString()}</td>
                        <td><Badge status={r.paymentStatus} /></td>
                        <td style={{ color: 'var(--text-muted)' }}>{r.issuedAt ? r.issuedAt.slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INVENTORY REPORT TAB */}
      {activeTab === 'inventory' && (
        <div>
          {reportLoading || !inventoryReport ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading inventory valuation...
            </div>
          ) : (
            <div>
              <div className="kpi-grid">
                <div className="kpi-card" style={{ '--accent-color': 'var(--primary)' }}>
                  <div className="kpi-label">Catalog Items</div>
                  <div className="kpi-value">{inventoryReport.totalItems}</div>
                </div>
                <div className="kpi-card" style={{ '--accent-color': 'var(--warning)' }}>
                  <div className="kpi-label">Stock Valuation (Cost)</div>
                  <div className="kpi-value">Rs. {Math.round(inventoryReport.totalValuation).toLocaleString()}</div>
                </div>
                <div className="kpi-card" style={{ '--accent-color': 'var(--success)' }}>
                  <div className="kpi-label">Potential Sales Value</div>
                  <div className="kpi-value">Rs. {Math.round(inventoryReport.totalPotential).toLocaleString()}</div>
                </div>
                <div className="kpi-card" style={{ '--accent-color': 'var(--danger)' }}>
                  <div className="kpi-label">Low Stock Alerts</div>
                  <div className="kpi-value">{inventoryReport.lowStockCount}</div>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item Name</th>
                      <th>Category</th>
                      <th>In Stock Qty</th>
                      <th>Selling Price</th>
                      <th>Valuation (at Cost)</th>
                      <th>Sales Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryReport.rows.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700 }}>{r.sku}</td>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td>{r.category}</td>
                        <td style={{ fontWeight: 700, color: r.currentStock <= r.minStock ? 'var(--danger)' : 'var(--text-main)' }}>
                          {r.currentStock}
                        </td>
                        <td>Rs. {r.sellingPrice.toLocaleString()}</td>
                        <td style={{ fontWeight: 600 }}>Rs. {Math.round(r.valuationAtCost).toLocaleString()}</td>
                        <td style={{ fontWeight: 700 }}>Rs. {Math.round(r.potentialSalesValue).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MECHANIC PERFORMANCE TAB */}
      {activeTab === 'mechanics' && (
        <div>
          {reportLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading technician performance...
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Technician Name</th>
                    <th>Specialty</th>
                    <th>Availability Status</th>
                    <th>Total Assigned Jobs</th>
                    <th>Completed Jobs</th>
                    <th>Active Jobs</th>
                    <th>Total Service Revenue Handled</th>
                  </tr>
                </thead>
                <tbody>
                  {mechanicsReport.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 700 }}>{m.name}</td>
                      <td>{m.specialty}</td>
                      <td><Badge status={m.availabilityStatus} /></td>
                      <td style={{ fontWeight: 600 }}>{m.totalAssignedJobs}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success-text)' }}>{m.completedJobs}</td>
                      <td>{m.activeJobs}</td>
                      <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                        Rs. {m.totalRevenueHandled.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Operating Expense Modal */}
      {isExpenseModalOpen && (
        <Modal
          isOpen={true}
          title="Record Workshop Operating Expense"
          onClose={() => setIsExpenseModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsExpenseModalOpen(false)}
                disabled={expenseSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddExpense}
                disabled={expenseSubmitting}
              >
                {expenseSubmitting ? 'Saving...' : 'Record Expense'}
              </button>
            </>
          }
        >
          <form onSubmit={handleAddExpense}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Expense Date <span className="req">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={expenseForm.expenseDate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category <span className="req">*</span></label>
                <select
                  className="form-select"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                >
                  {expenseCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Expense Description <span className="req">*</span></label>
              <input
                type="text"
                className="form-input"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="e.g. Workshop electricity bill, Brake cleaner sprays, Delivery fee"
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount (Rs.) <span className="req">*</span></label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="e.g. 4500"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Receipt / Voucher Reference No.</label>
                <input
                  type="text"
                  className="form-input"
                  value={expenseForm.referenceNo}
                  onChange={(e) => setExpenseForm({ ...expenseForm, referenceNo: e.target.value })}
                  placeholder="e.g. VOUCH-102"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
