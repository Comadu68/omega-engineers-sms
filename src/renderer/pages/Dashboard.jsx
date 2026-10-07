import React, { useEffect, useState } from 'react'
import { Badge } from '../components/Badge'

export const Dashboard = ({ onNavigate, onOpenNewJob, onOpenNewAppointment }) => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    todayJobs: 0,
    pendingJobs: 0,
    inProgressJobs: 0,
    completedToday: 0,
    upcomingAppointments: 0,
    cancelledJobs: 0
  })
  const [recentJobs, setRecentJobs] = useState([])
  const [lowStockItems, setLowStockItems] = useState([])
  const [todayAppointments, setTodayAppointments] = useState([])
  const [mechanics, setMechanics] = useState([])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const todayStr = new Date().toISOString().slice(0, 10)

      // Fetch all required data concurrently via IPC
      const [allJobs, appts, inventorySummary, allItems, allMechanics] = await Promise.all([
        window.omega.jobs.list(),
        window.omega.appointments.list({ startDate: todayStr }),
        window.omega.inventory.getSummary(),
        window.omega.inventory.list({ lowStockOnly: true }),
        window.omega.mechanics.list()
      ])

      const todayJobsList = allJobs.filter((j) => (j.openedAt || '').startsWith(todayStr))
      const pendingCount = allJobs.filter((j) => j.status === 'pending').length
      const inProgressCount = allJobs.filter((j) => j.status === 'in_progress').length
      const completedTodayCount = allJobs.filter(
        (j) => j.status === 'completed' && (j.completedAt || '').startsWith(todayStr)
      ).length
      const cancelledCount = allJobs.filter((j) => j.status === 'cancelled').length

      setStats({
        todayJobs: todayJobsList.length,
        pendingJobs: pendingCount,
        inProgressJobs: inProgressCount,
        completedToday: completedTodayCount,
        upcomingAppointments: appts.filter((a) => a.status === 'scheduled').length,
        cancelledJobs: cancelledCount
      })

      setRecentJobs(allJobs.slice(0, 5))
      setLowStockItems(allItems.slice(0, 5))
      setTodayAppointments(appts.filter((a) => (a.appointmentDate || '').startsWith(todayStr)))
      setMechanics(allMechanics.filter((m) => m.isActive === 1))
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  return (
    <div className="content-scrollable">
      {/* KPI Cards Row */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--accent-color': 'var(--primary)' }}>
          <div className="kpi-label">Today's Jobs</div>
          <div className="kpi-value">{loading ? '...' : stats.todayJobs}</div>
          <div className="kpi-subtext">Opened today</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--warning)' }}>
          <div className="kpi-label">Pending Jobs</div>
          <div className="kpi-value">{loading ? '...' : stats.pendingJobs}</div>
          <div className="kpi-subtext">Awaiting service</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--info)' }}>
          <div className="kpi-label">In Progress</div>
          <div className="kpi-value">{loading ? '...' : stats.inProgressJobs}</div>
          <div className="kpi-subtext">Currently on lift/bay</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--success)' }}>
          <div className="kpi-label">Completed Today</div>
          <div className="kpi-value">{loading ? '...' : stats.completedToday}</div>
          <div className="kpi-subtext">Ready / invoiced</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': '#8B5CF6' }}>
          <div className="kpi-label">Upcoming Bookings</div>
          <div className="kpi-value">{loading ? '...' : stats.upcomingAppointments}</div>
          <div className="kpi-subtext">Scheduled appointments</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--danger)' }}>
          <div className="kpi-label">Cancelled Jobs</div>
          <div className="kpi-value">{loading ? '...' : stats.cancelledJobs}</div>
          <div className="kpi-subtext">All time cancelled</div>
        </div>
      </div>

      {/* Main Grid: Left side Recent Jobs & Low Stock, Right side Today Schedule & Mechanics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Left Column */}
        <div>
          {/* Recent Job Cards */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Job Cards</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('jobcards')}
              >
                View All →
              </button>
            </div>
            {recentJobs.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', padding: '10px 0' }}>
                No active job cards found. Click "+ New Job Card" to create one.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Customer & Vehicle</th>
                    <th>Mechanic</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((j) => (
                    <tr key={j.id}>
                      <td style={{ fontWeight: 700 }}>{j.jobNo}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{j.customerName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {j.registrationNo} • {j.vehicleModel}
                        </div>
                      </td>
                      <td>{j.mechanicName || <span style={{ color: 'var(--text-light)' }}>Unassigned</span>}</td>
                      <td><Badge status={j.status} /></td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onNavigate('jobcards', { selectedJobId: j.id })}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠️</span>
                <span>Low-Stock Inventory Alerts</span>
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('inventory')}
              >
                Manage Stock →
              </button>
            </div>
            {lowStockItems.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--success)', fontSize: '13px', padding: '10px 0' }}>
                ✓ All inventory items are adequately stocked above reorder thresholds.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Part / Item</th>
                    <th>SKU</th>
                    <th>In Stock</th>
                    <th>Min Level</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{item.sku}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 700 }}>
                        {item.totalStock} units
                      </td>
                      <td>{item.minimumStockLevel} units</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => onNavigate('inventory', { receiveItem: item })}
                        >
                          + Receive Batch
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Today's Schedule / Appointments */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Today's Appointments</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('appointments')}
              >
                Calendar →
              </button>
            </div>
            {todayAppointments.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', padding: '10px 0' }}>
                No appointments booked for today.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {todayAppointments.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-main)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)' }}>
                        ⏰ {a.startTime}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>
                        {a.customerName} ({a.registrationNo})
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {a.serviceReason}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Badge status={a.status} />
                      {a.status === 'scheduled' && (
                        <div style={{ marginTop: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={() => onOpenNewJob({
                              customerId: a.customerId,
                              vehicleId: a.vehicleId,
                              appointmentId: a.id,
                              complaint: a.serviceReason
                            })}
                          >
                            Open Job Card →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Mechanics Panel */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Mechanic Roster &amp; Workload</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('mechanics')}
              >
                View Roster →
              </button>
            </div>
            {mechanics.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
                No active mechanics registered.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {mechanics.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{m.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {m.specialty}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: m.activeWorkload > 0 ? 'var(--primary-light)' : '#E5E7EB',
                          color: m.activeWorkload > 0 ? 'var(--primary)' : '#4B5563'
                        }}
                      >
                        {m.activeWorkload} {m.activeWorkload === 1 ? 'job' : 'jobs'}
                      </span>
                      <Badge status={m.availabilityStatus} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
