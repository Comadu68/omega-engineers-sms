# Database Model Notes

The canonical executable schema is `src/database/schema.sql`.

## Core relationships
- customer 1 → many vehicles
- customer/vehicle 1 → many appointments
- appointment 0/1 → job card
- job card → mechanic assignments
- job card → tasks
- job card → part-usage rows
- inventory item → many batches
- inventory batch → many part-usage rows
- job card → invoice
- invoice → many invoice items
- invoice → many payments

## Inventory cost rule
`inventory_items.current_selling_price` is the current/default selling price.
Cost lives in `inventory_batches.unit_cost`.
Historical usage snapshots both `unit_cost_at_use` and `selling_price_at_use`.

## FIFO
FIFO is implemented by consuming `inventory_batches` ordered by `received_at`, then ID, where `remaining_qty > 0`.

## Financial reporting
Recommended values:
- Total Revenue = service invoice lines + part invoice lines
- Parts COGS = FIFO part usage cost
- Gross Profit = Total Revenue - Parts COGS
- Net Profit = Gross Profit - Operating Expenses
- Cash Collected = payment records in selected period
