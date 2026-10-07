# IPC Contract

Do not expose a generic `ipc.invoke(channel, payload)` function to the renderer.
Expose named APIs only.

Suggested preload surface:

```js
window.omega.auth.login(credentials)
window.omega.auth.logout()
window.omega.customers.list(filters)
window.omega.customers.create(data)
window.omega.customers.update(id, data)
window.omega.vehicles.list(filters)
window.omega.appointments.list(filters)
window.omega.appointments.checkAvailability(data)
window.omega.appointments.create(data)
window.omega.jobs.list(filters)
window.omega.jobs.get(id)
window.omega.jobs.create(data)
window.omega.jobs.updateStatus(id, status, note)
window.omega.jobs.assignMechanic(jobId, mechanicId)
window.omega.inventory.list(filters)
window.omega.inventory.createItem(data)
window.omega.inventory.receiveBatch(data)
window.omega.inventory.consumeForJob(data)
window.omega.invoices.generate(jobId, options)
window.omega.payments.record(invoiceId, data)
window.omega.expenses.create(data)
window.omega.reports.dailySummary(filters)
window.omega.backup.create()
window.omega.backup.restore(filePath)
window.omega.settings.get()
window.omega.settings.update(data)
```

Every main-process handler must validate input and enforce user-role permissions.
