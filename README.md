# Service Station Management System (SSMS)
### Omega Engineers Service Station — Offline Desktop Application

[![Academic](https://img.shields.io/badge/Course-EER4189%20Software%20Design%20in%20Group-orange.svg)](https://github.com)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20(64--bit)-blue.svg?logo=windows)](https://www.microsoft.com/windows)
[![Electron](https://img.shields.io/badge/Electron-30+-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Agile](https://img.shields.io/badge/Agile-Scrum%20%7C%20Jira%20Tracked-0052CC.svg?logo=jira&logoColor=white)](https://www.atlassian.com/software/jira)
[![Milestone](https://img.shields.io/badge/Status-Milestone%204%20(Progress%20Review)-brightgreen.svg)](https://github.com)

---

## 📖 Executive Summary & Background

**Omega Engineers Service Station**, located in Niyamgamdora, Kothmale, provides routine vehicle servicing, mechanical repairs, electrical fault diagnoses, and spare-parts sales. Historically, the business relied entirely on paper-based registers, manual job cards, handwritten customer receipts, and physical stock books. This resulted in misplaced documents, untracked parts inventory, calculation discrepancies in customer bills, and operational bottlenecks whenever the Owner was off-site.

This project delivers a **secure, offline, standalone desktop application** specifically engineered to digitize the end-to-end service station workflow. Operating locally on a Windows workstation without requiring continuous internet connectivity, the application guarantees uninterrupted operations during rural network outages with zero recurring cloud subscription overheads.

---

## 🎯 Key Project Objectives

1. **Digital Job Card Pipeline:** Digitize the complete customer lifecycle from intake and appointment booking to bay allocation, mechanic task tracking, and job closure.
2. **Multi-User Security & Delegation:** Provide granular Role-Based Access Control (RBAC) with salted cryptographic hashing, enabling authorized staff to perform daily duties while the Owner retains full administrative oversight.
3. **Automated Inventory Control:** Maintain real-time stock balances through atomic deduction upon spare-part job issuance, with automated low-stock threshold alerts.
4. **Accurate Invoicing & Dual Printing:** Compute accurate bills combining labor, parts, discounts, and partial payments, supporting direct printing of standard A4 invoices and 80mm POS thermal receipts with detachable service reminder stickers.
5. **Business Intelligence & Offline Continuity:** Generate offline daily cash reconciliation, technician progress tracking, financial summaries, and scheduled encrypted local database backups.

---

## 🌟 Core System Modules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 SERVICE STATION MANAGEMENT SYSTEM (SSMS)                    │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│ 🔐 USER MGMT    │ 📋 JOB CARDS    │ 📦 INVENTORY    │ 🧾 BILLING & PRINTS   │
├─────────────────┼─────────────────┼─────────────────┼───────────────────────┤
│ • PBKDF2 Hashing│ • Customer/Car  │ • Item Catalog  │ • Auto Bill Math      │
│ • RBAC Policies │ • Bay Scheduling│ • Stock Deduct  │ • Installments / Dues │
│ • First-time PW │ • Mechanic Track│ • Danger Alert  │ • A4 & POS Thermal    │
│ • Audit Logs    │ • Status Badges │ • Supplier Logs │ • Reminder Sticker    │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
                                       │
                    📊 REPORTING & LOCAL BACKUP ENGINE
             (KPI Dashboard | PDF/Excel Export | SQLite Backup)
```

### 1. User Management Module
- Multi-user authentication supporting Owner/Admin, Supervisor, Staff/Receptionist, and Billing roles.
- Industry-standard **PBKDF2 salted password hashing** and session locking after consecutive failed attempts.
- First-time login mandatory password reset and role-based interface gating.

### 2. Job Card & Workshop Operations Module
- Customer directory with duplicate telephone number validation.
- Appointment scheduling calendar with **double-booking prevention** for mechanic bays.
- Sequential digital job card generation (`JC-xxxx`) tracking vehicle mileage, reported defects, and assigned technician.
- Real-time repair status updates (`Pending` ➔ `In Progress` ➔ `Completed`).

### 3. Inventory & Spare Parts Control Module
- Categorized stock records with SKU, cost price, retail price, and minimum reorder thresholds.
- Supplier invoice entry updating on-hand stock quantities atomically.
- Real-time stock deduction on part issuance to active job cards, strictly blocking negative inventory.
- Automated **Stock Danger List** highlighting items requiring replenishment.

### 4. Billing, Invoicing & Dual Printing Module
- Auto-calculation engine: `(Labour Charges + Issued Parts) - Discounts = Final Total`.
- Payment recording supporting full settlements, card/cash splits, and installment payment tracking with overdue balances.
- **Dual Printing Engine:** Standard A4 invoices and 80mm POS thermal receipts.
- **Detachable Service Reminder Sticker:** Formatted sticker containing vehicle registration, next service due date, and target mileage for windshield placement.

### 5. Report Management & Data Security Module
- Daily income, job volume, parts consumption, and technician productivity KPI metrics.
- Export capabilities to standalone PDF and Excel sheets.
- Local encrypted SQLite database backups for disaster recovery.

---

## 🏗️ Technical Architecture & Stack

The application employs an **Electron multi-process IPC architecture**, isolating UI presentation from privileged native operating system and database operations.

```
┌─────────────────────────────────────────────────────────────┐
│                    REACT RENDERER PROCESS                   │
│          (React 18 + Vite + Tailwind/CSS Design Tokens)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                Context Isolation & Preload IPC
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    ELECTRON MAIN PROCESS                    │
│            (Node.js CommonJS + PBKDF2 Cryptography)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                 Synchronous / WAL Mode Driver
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    EMBEDDED SQLITE DATABASE                 │
│               (better-sqlite3 + Foreign Keys)               │
└─────────────────────────────────────────────────────────────┘
```

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Desktop Shell** | **Electron.js** | Provides cross-platform desktop integration and direct access to native OS printing. |
| **User Interface** | **React.js + Vite** | High-performance Single Page Application (SPA) with responsive state management. |
| **Local Database** | **SQLite (`better-sqlite3`)** | Zero-configuration serverless embedded database with WAL mode and ACID transaction safety. |
| **Security** | **Node.js Crypto (PBKDF2)** | Cryptographically secure salted password hashing to protect authentication credentials. |
| **Installer** | **Electron Builder + NSIS** | Generates a standalone, one-click Windows 64-bit setup executable (`.exe`). |

---

## ⚖️ Commercial System Comparison

| Feature / Criteria | Shopmonkey (Cloud) | Tekmetric (Cloud) | AutoFluent (Client-Server) | **Omega SSMS (Proposed)** |
| :--- | :---: | :---: | :---: | :---: |
| **Architecture** | Cloud SaaS | Cloud SaaS | Multi-Tier Server | **Offline Standalone Desktop** |
| **Internet Dependency** | 100% Continuous | 100% Continuous | Local Network / WAN | **Zero (100% Offline)** |
| **Subscription Fees** | High Monthly ($$$) | High Monthly ($$$) | High License Fee | **Zero Recurring Costs** |
| **Local Data Ownership** | Cloud Storage | Cloud Storage | Local Server | **100% On-Premise SQLite** |
| **Reminder Sticker Print** | Generic Add-on | Separate Add-on | Add-on module | **Built-in Detachable Format** |

---

## 📂 Project Structure

```
omega-engineers-sms/
├── assets/                  # Application icons, branding & static images
├── designs/                 # UI/UX Wireframes, design tokens & visual specifications
├── docs/                    # Architectural notes, SRS extracts & academic guidelines
├── source/                  # Original project proposal documentation
├── src/
│   ├── main/                # Electron Main Process (IPC handlers, database bridge)
│   │   ├── db.cjs           # SQLite database schema, connections & transactions
│   │   ├── auth.cjs         # PBKDF2 authentication & crypto handlers
│   │   ├── print.cjs        # A4 & POS thermal print handlers
│   │   └── main.cjs         # Electron application lifecycle & window controller
│   ├── preload/             # Context-isolated IPC preload bridge
│   │   └── preload.cjs
│   └── renderer/            # React Frontend Application
│       ├── components/      # Reusable UI components (Modals, Tables, Forms, Badges)
│       ├── pages/           # Module Views (Dashboard, JobCards, Inventory, Billing, Reports)
│       ├── styles/          # Custom CSS design tokens & @media print stylesheets
│       ├── App.jsx          # Root routing and role-based view switching
│       └── main.jsx         # React application entry point
├── tests/                   # Automated unit & integration tests
├── electron-builder.yml     # NSIS installer packaging configuration
├── package.json             # Project dependencies & npm build scripts
├── vite.config.js           # Vite build & bundle configuration
└── README.md                # Project documentation
```

---

## 🚀 Getting Started & Setup

### Prerequisites
- **Operating System:** Windows 10 or Windows 11 (64-bit)
- **Node.js:** v18.x or v20.x (LTS recommended)
- **npm:** v9.x or higher

### 1. Installation
Clone the repository and install the project dependencies:
```bash
git clone https://github.com/YourUsername/omega-engineers-sms.git
cd omega-engineers-sms
npm install
```

### 2. Running in Development Mode
Launch both the Vite development server and the Electron desktop window concurrently:
```bash
npm run dev
```

### 3. Running Automated Tests
Run the integration and database schema test suite:
```bash
npm test
```

### 4. Compiling the Production Windows Installer
To package the standalone Windows executable (`Omega Engineers Service Station Setup.exe`):
```bash
npm run dist
```
The compiled installer will be generated in the `dist/` directory.

---

## 📅 Project Roadmap & Academic Milestones

| Milestone ID | Date | Deliverable | Status |
| :---: | :---: | :--- | :---: |
| **M01** | 25 June 2026 | Client Requirement Gathering at Omega Engineers | ✅ Completed |
| **M02** | 30 June 2026 | Proposed Project Presentation Slides Submission | ✅ Completed |
| **M03** | 30 August 2026 | Revised Project Proposal & Standalone SRS Submission | ✅ Completed |
| **M04** | 10 October 2026 | Progress Review Presentation & Interim Prototype Demo | 🚀 **In Progress (Sprint 1 Active)** |
| **M05** | 20 October 2026 | Full Core Module Implementation (Job Card & Billing) | ⏳ Scheduled |
| **M06** | 15 November 2026 | Hardware Printer Testing (POS/A4) & Client Pilot Run | ⏳ Scheduled |
| **M07** | 01 December 2026 | Final Project Demonstration, Installer & Report | ⏳ Scheduled |

---

## 👥 Academic Credits & Team Contributors

This project is developed as part of **EER4189 Software Design in Group**.

* **Client:** Mr. H.K.C. Karunathilaka — Owner, Omega Engineers Service Station (Niyamgamdora, Kothmale)
* **Project Supervisor:** Ms. Kelani Bandara

### Team CodeLab (Group 47)

| Name | Student Reg. No. | Role & Contribution |
| :--- | :---: | :--- |
| **H.M.M.P. Herath** | `124700622` | **Project Coordinator & Scrum Master**<br>Client liaison, project timeline, sprint management, UI layout. |
| **H.M.P.S.D.W. Herath** | `724701588` | **Business Analyst & Core Workflow Lead**<br>Requirement engineering, SRS modeling, Job Card & Customer flow. |
| **W.M.P.R. Weerasinghe** | `624692044` | **Tech Lead & Backend Specialist**<br>System architecture, SQLite schema, PBKDF2 cryptography, IPC handlers. |
| **H.K. Bhagya** | `224692505` | **QA Engineer & Documentation Lead**<br>System documentation, print stylesheets, report exports, testing verification. |

---

## 📄 License & Intellectual Property

This project is developed solely for academic evaluation under the **EER4189 Software Design in Group** curriculum and for operational deployment at **Omega Engineers Service Station**. All rights reserved.
