# Business Services

Keep business rules out of React components and thin IPC handlers.

Important services:
- authService
- appointmentService (capacity/conflict rules)
- mechanicService (availability/workload)
- jobService (status transitions/cancellation)
- inventoryService (batch receiving/FIFO transaction)
- invoiceService (snapshot lines/totals)
- paymentService (partial/full status)
- reportService (financial formulas)
- backupService
