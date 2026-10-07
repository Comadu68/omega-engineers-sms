# Appointments Design Notes

- Monthly calendar availability view.
- Selected date shows booking count, free slots, total capacity.
- Date cells themselves use rounded semantic states:
  - available green
  - limited amber/orange
  - full red
  - selected with primary-blue emphasis/outline
- Avoid relying only on tiny availability dots.
- User can inspect date availability before creating a booking.
- Cancelled appointments do not count against capacity.
