# Testing Checklist

## Smoke test after every build
- app launches
- sidebar navigation works
- no blank page
- database health check passes
- app closes normally

## Core workflow
- create customer
- create vehicle
- create appointment
- reject conflicting appointment
- create job card from appointment
- assign available mechanic
- update job pending → in progress → completed
- create cancelled job and verify filters/counts
- create inventory item
- receive two batches at different costs
- consume quantity across FIFO batches
- verify remaining quantities
- generate invoice
- record partial payment
- record final payment
- add operating expense
- verify daily report formulas

## Persistence
- restart app after creating data
- verify all records remain

## Backup
- create backup
- change data
- restore backup
- verify restored state

## UI
At 1366×768:
- no overlapping controls
- no clipped labels
- no horizontal page overflow unless a table intentionally scrolls inside its card
- buttons do not cover rows
- active sidebar item uses same font size as others
- KPI numbers are readable but not oversized

## Offline
Disable network adapter or disconnect internet and verify:
- login works
- all pages work
- charts render
- logo/icons render
- reports work
- backup works

## Release
Test installer on a clean/non-development Windows profile if possible.
