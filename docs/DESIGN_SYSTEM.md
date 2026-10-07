# Design System

## Layout
- desktop-first
- target minimum: 1366×768
- fixed left sidebar
- main content area with light background
- rounded cards, restrained borders, moderate spacing

## Colors
| Purpose | Color |
|---|---|
| Sidebar | `#000A31` |
| Selected sidebar item | `#1C3150` |
| Main background | `#F6F8FC` |
| Primary | `#4361EE` |
| Main text | `#152033` |
| Muted text | `#6B778C` |
| Border | `#E4E9F2` |
| Success / Completed / Available | `#2FB171` |
| Warning / Pending / Limited | `#F0A33A` |
| Error / Cancelled / Full | `#E35757` |

## Typography
Use local/system stack:
`Segoe UI, Arial, sans-serif`

Do not fetch fonts from the internet.

## Status mapping
- Pending → amber
- In Progress → blue
- Completed → green
- Cancelled → red
- Available → green
- Busy/Limited → amber
- Full/Unavailable → red

## Navigation rule
All tab labels use the same font size. Active tab uses selected background + white text + moderate weight only.

## Density rule
Pages should feel informative, not empty, but do not pack cards together so tightly that the layout looks sandwiched.
