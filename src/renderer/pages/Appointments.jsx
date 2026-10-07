import React, { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { Badge } from '../components/Badge'

const TIME_SLOTS = [
  '08:30 AM',
  '09:30 AM',
  '10:30 AM',
  '11:30 AM',
  '01:30 PM',
  '02:30 PM',
  '03:30 PM',
  '04:30 PM'
]

const SERVICE_TYPES = [
  'Full Lubrication & Oil Change',
  'Brake System Service & Pad Replacement',
  'Periodic Full Maintenance Service',
  'Engine Tune-up & Diagnostic Scan',
  'Suspension & Steering Overhaul',
  'Electrical & Battery Inspection',
  'Cooling System & Radiator Flush',
  'Transmission / Gearbox Fluid Service',
  'General Inspection / Other'
]

export const Appointments = ({ onOpenJobCardWithDetails }) => {
  const todayDate = new Date()
  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(todayDate.toISOString().slice(0, 10))
  
  const [monthAvailability, setMonthAvailability] = useState({ dates: {}, maxCapacity: 8 })
  const [appointmentsList, setAppointmentsList] = useState([])
  const [activeFilter, setActiveFilter] = useState('date') // 'date', 'today', 'week', 'upcoming', 'cancelled'
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // New Appointment Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [customers, setCustomers] = useState([])
  const [customerVehicles, setCustomerVehicles] = useState([])
  const [formData, setFormData] = useState({
    customerId: '',
    vehicleId: '',
    serviceReason: SERVICE_TYPES[0],
    appointmentDate: todayDate.toISOString().slice(0, 10),
    startTime: TIME_SLOTS[0],
    notes: ''
  })
  const [slotCheckResult, setSlotCheckResult] = useState(null)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadCalendarAvailability = async () => {
    try {
      const avail = await window.omega.appointments.getMonthlyAvailability(currentYear, currentMonth)
      setMonthAvailability(avail)
    } catch (err) {
      console.error('Failed to load month availability:', err)
    }
  }

  const loadAppointments = async () => {
    try {
      setLoading(true)
      const todayStr = new Date().toISOString().slice(0, 10)
      let filters = { search }

      if (activeFilter === 'date') {
        filters.date = selectedDate
      } else if (activeFilter === 'today') {
        filters.date = todayStr
      } else if (activeFilter === 'week') {
        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        filters.startDate = todayStr
        filters.endDate = nextWeek.toISOString().slice(0, 10)
      } else if (activeFilter === 'upcoming') {
        filters.startDate = todayStr
        filters.status = 'scheduled'
      } else if (activeFilter === 'cancelled') {
        filters.status = 'cancelled'
      }

      const list = await window.omega.appointments.list(filters)
      setAppointmentsList(list)
    } catch (err) {
      console.error('Failed to load appointments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCalendarAvailability()
  }, [currentYear, currentMonth])

  useEffect(() => {
    loadAppointments()
  }, [selectedDate, activeFilter, search])

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const openNewAppointmentModal = async () => {
    setFormError('')
    setFormData({
      customerId: '',
      vehicleId: '',
      serviceReason: SERVICE_TYPES[0],
      appointmentDate: selectedDate,
      startTime: TIME_SLOTS[0],
      notes: ''
    })
    setCustomerVehicles([])
    try {
      const custList = await window.omega.customers.list()
      setCustomers(custList)
      if (custList.length > 0) {
        const firstCust = custList[0]
        setFormData((prev) => ({ ...prev, customerId: firstCust.id }))
        const vehList = await window.omega.vehicles.list({ customerId: firstCust.id })
        setCustomerVehicles(vehList)
        if (vehList.length > 0) {
          setFormData((prev) => ({ ...prev, vehicleId: vehList[0].id }))
        }
      }
      setIsModalOpen(true)
    } catch (err) {
      console.error('Failed to prepare modal:', err)
    }
  }

  const handleCustomerChange = async (customerId) => {
    setFormData((prev) => ({ ...prev, customerId, vehicleId: '' }))
    try {
      const vehList = await window.omega.vehicles.list({ customerId })
      setCustomerVehicles(vehList)
      if (vehList.length > 0) {
        setFormData((prev) => ({ ...prev, vehicleId: vehList[0].id }))
      }
    } catch (err) {
      console.error('Failed to load vehicles for customer:', err)
    }
  }

  const checkSlotRealtime = async (date, time) => {
    try {
      const check = await window.omega.appointments.checkAvailability({
        appointmentDate: date,
        startTime: time
      })
      setSlotCheckResult(check)
    } catch (_) {}
  }

  useEffect(() => {
    if (isModalOpen && formData.appointmentDate && formData.startTime) {
      checkSlotRealtime(formData.appointmentDate, formData.startTime)
    }
  }, [formData.appointmentDate, formData.startTime, isModalOpen])

  const handleCreateAppointment = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!formData.customerId || !formData.vehicleId) {
      setFormError('Please select a valid customer and registered vehicle.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.appointments.create(formData)
      setIsModalOpen(false)
      loadCalendarAvailability()
      loadAppointments()
    } catch (err) {
      setFormError(err.message || 'Failed to book appointment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelAppointment = async (id) => {
    if (window.confirm('Are you sure you want to cancel this appointment? It will free the booking capacity slot.')) {
      try {
        await window.omega.appointments.updateStatus(id, 'cancelled')
        loadCalendarAvailability()
        loadAppointments()
      } catch (err) {
        alert(err.message || 'Failed to cancel appointment.')
      }
    }
  }

  // Calendar rendering math
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay()
  const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleString('en-GB', { month: 'long' }).toUpperCase()
  const todayStr = todayDate.toISOString().slice(0, 10)

  const selectedDateAvail = monthAvailability.dates[selectedDate] || {
    bookedCount: 0,
    maxCapacity: monthAvailability.maxCapacity || 8,
    availableSlots: monthAvailability.maxCapacity || 8,
    status: 'available'
  }

  return (
    <div className="content-scrollable">
      {/* Top action row */}
      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Service Appointments &amp; Bookings</h2>
        </div>
        <button type="button" className="btn btn-primary" onClick={openNewAppointmentModal}>
          + New Appointment Booking
        </button>
      </div>

      {/* Two Column Layout: Left Month Calendar, Right Schedule */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Monthly Availability Calendar */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handlePrevMonth}
              style={{ width: '32px', height: '32px', padding: 0 }}
            >
              ‹
            </button>
            <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.5px' }}>
              {monthName} {currentYear}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleNextMonth}
              style={{ width: '32px', height: '32px', padding: 0 }}
            >
              ›
            </button>
          </div>

          {/* Day of week headers */}
          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="calendar-dow">{d}</div>
            ))}

            {/* Empty padding days */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <div key={`empty-${idx}`} className="calendar-day-cell muted" />
            ))}

            {/* Actual Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1
              const dayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayInfo = monthAvailability.dates[dayStr]
              const isSelected = selectedDate === dayStr
              const isToday = todayStr === dayStr

              let stateClass = 'state-available'
              let stateText = 'Free'

              if (dayInfo) {
                if (dayInfo.status === 'full') {
                  stateClass = 'state-full'
                  stateText = 'Full'
                } else if (dayInfo.status === 'limited') {
                  stateClass = 'state-limited'
                  stateText = `${dayInfo.bookedCount}/${dayInfo.maxCapacity}`
                } else if (dayInfo.bookedCount > 0) {
                  stateText = `${dayInfo.bookedCount}/${dayInfo.maxCapacity}`
                }
              }

              return (
                <div
                  key={dayStr}
                  className={`calendar-day-cell ${stateClass} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => {
                    setSelectedDate(dayStr)
                    setActiveFilter('date')
                  }}
                >
                  <span className="calendar-day-num">{day}</span>
                  <span className="calendar-day-status-pill">{stateText}</span>
                </div>
              )
            })}
          </div>

          {/* Calendar Status Legend */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '10px',
              color: 'var(--text-muted)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--success)' }} />
              <span>Available</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--warning)' }} />
              <span>Limited</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--danger)' }} />
              <span>Full Capacity</span>
            </div>
          </div>

          {/* Selected Date Summary Box */}
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              background: 'var(--bg-main)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Selected Date Availability
            </div>
            <div style={{ fontWeight: 800, fontSize: '14px', marginTop: '2px', color: 'var(--text-main)' }}>
              📅 {selectedDate}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px' }}>
              <span>Booked: <strong>{selectedDateAvail.bookedCount} / {selectedDateAvail.maxCapacity}</strong></span>
              <span style={{ color: selectedDateAvail.availableSlots > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                {selectedDateAvail.availableSlots} slots free
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Schedule & Bookings Table */}
        <div>
          {/* Filter Chips */}
          <div className="toolbar" style={{ marginBottom: '12px' }}>
            <div className="filter-chips">
              <button
                type="button"
                className={`chip ${activeFilter === 'date' ? 'active' : ''}`}
                onClick={() => setActiveFilter('date')}
              >
                Selected Date ({selectedDate})
              </button>
              <button
                type="button"
                className={`chip ${activeFilter === 'today' ? 'active' : ''}`}
                onClick={() => setActiveFilter('today')}
              >
                Today
              </button>
              <button
                type="button"
                className={`chip ${activeFilter === 'week' ? 'active' : ''}`}
                onClick={() => setActiveFilter('week')}
              >
                Next 7 Days
              </button>
              <button
                type="button"
                className={`chip ${activeFilter === 'upcoming' ? 'active' : ''}`}
                onClick={() => setActiveFilter('upcoming')}
              >
                All Scheduled
              </button>
              <button
                type="button"
                className={`chip ${activeFilter === 'cancelled' ? 'active' : ''}`}
                onClick={() => setActiveFilter('cancelled')}
              >
                Cancelled
              </button>
            </div>

            <div className="search-input-wrap" style={{ maxWidth: '240px' }}>
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search appointments..."
              />
            </div>
          </div>

          {/* Bookings Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading schedule...
              </div>
            ) : appointmentsList.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No appointments found for this filter.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time Slot</th>
                    <th>Customer</th>
                    <th>Vehicle</th>
                    <th>Service Reason</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentsList.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--primary)' }}>⏰ {a.startTime}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.appointmentDate}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.customerName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.customerPhone}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{a.registrationNo}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {a.vehicleMake} {a.vehicleModel}
                        </div>
                      </td>
                      <td style={{ maxWidth: '200px' }}>{a.serviceReason}</td>
                      <td><Badge status={a.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {a.status === 'scheduled' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => onOpenJobCardWithDetails({
                                  customerId: a.customerId,
                                  vehicleId: a.vehicleId,
                                  appointmentId: a.id,
                                  complaint: a.serviceReason
                                })}
                              >
                                Open Job →
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleCancelAppointment(a.id)}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {a.linkedJobNo && (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)' }}>
                              Job: {a.linkedJobNo}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* New Appointment Modal */}
      {isModalOpen && (
        <Modal
          isOpen={true}
          title="New Service Appointment Booking"
          onClose={() => setIsModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateAppointment}
                disabled={isSubmitting || (slotCheckResult && !slotCheckResult.available)}
              >
                {isSubmitting ? 'Confirming...' : 'Confirm Appointment'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}

          {slotCheckResult && !slotCheckResult.available && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px', border: '1px solid rgba(227,87,87,0.3)' }}>
              ⚠️ {slotCheckResult.reason}
            </div>
          )}

          {slotCheckResult && slotCheckResult.available && (
            <div style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px', border: '1px solid rgba(47,177,113,0.3)' }}>
              ✓ Time slot is available. ({slotCheckResult.availableSlots} of {slotCheckResult.maxCapacity} slots free today)
            </div>
          )}

          <form onSubmit={handleCreateAppointment}>
            <div className="form-group">
              <label className="form-label">Customer <span className="req">*</span></label>
              <select
                className="form-select"
                value={formData.customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                required
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Vehicle <span className="req">*</span></label>
              <select
                className="form-select"
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                required
                disabled={customerVehicles.length === 0}
              >
                {customerVehicles.length === 0 ? (
                  <option value="">No vehicles found for selected customer</option>
                ) : (
                  customerVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registrationNo} — {v.make} {v.model}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Service Type / Reason <span className="req">*</span></label>
              <select
                className="form-select"
                value={formData.serviceReason}
                onChange={(e) => setFormData({ ...formData, serviceReason: e.target.value })}
              >
                {SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Appointment Date <span className="req">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.appointmentDate}
                  onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Time Slot <span className="req">*</span></label>
                <select
                  className="form-select"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Customer Notes / Special Instructions</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional customer complaints or special notes"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
