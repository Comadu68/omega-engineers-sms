# Project Scope and Source Notes

## Requirements preserved from the academic documents
The project materials define these core modules:
- authorized user login and role-based access
- customer records
- vehicle records
- appointments with conflict prevention
- digital job cards
- mechanic assignment
- repair-status updates
- spare-part inventory and low-stock visibility
- invoice generation
- payment recording including partial payments
- management reports

Main roles:
- Administrator / Owner
- Receptionist / Service Advisor
- Mechanic
- Inventory / Billing Staff

The original documents describe a centralized web-based application and list Node.js as one backend option, HTML5/CSS3/JavaScript/React among frontend choices, and MySQL/PostgreSQL as database choices.

## Approved implementation adaptation for this build pack
The current implementation target has been changed to a **fully offline Windows desktop application**.

Therefore:
- React/HTML/CSS/JavaScript remain the UI technologies.
- Node.js remains the application/business-logic technology.
- Electron is added as the desktop shell.
- SQLite replaces a separately installed MySQL/PostgreSQL server for simpler offline installation and low-spec-PC operation.
- Browser-support requirements become desktop-window/resolution requirements for the Electron build.

This is an implementation architecture change, not a change to the core business workflow.

## Final academic report note
The final report/progress report should explicitly document this architecture decision and its reason: single-PC/fully-offline deployment, easy installer, no database server administration, simpler backup/restore, and lower deployment complexity.
