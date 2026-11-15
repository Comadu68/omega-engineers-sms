import os
import subprocess
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Omega Engineers - Bug Responsibility Matrix</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
      @bottom-right {
        content: counter(page);
        font-size: 9pt;
        color: #64748b;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 9.5pt;
      line-height: 1.45;
    }
    .header-box {
      border-bottom: 2.5px solid #1e3a8a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .project-title {
      font-size: 17pt;
      font-weight: 800;
      color: #1e3a8a;
      margin: 0 0 4px 0;
      letter-spacing: -0.3px;
    }
    .doc-subtitle {
      font-size: 11pt;
      font-weight: 600;
      color: #334155;
      margin: 0;
    }
    .meta-box {
      text-align: right;
      font-size: 8.5pt;
      color: #64748b;
      line-height: 1.35;
    }
    .meta-box strong {
      color: #1e293b;
    }
    h2 {
      font-size: 12pt;
      font-weight: 700;
      color: #1e3a8a;
      margin: 16px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      page-break-after: avoid;
    }
    p {
      margin: 0 0 10px 0;
      color: #334155;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 16px 0;
      font-size: 8.5pt;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      text-align: left;
      padding: 7px 8px;
      border: 1px solid #cbd5e1;
      font-size: 8.5pt;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
      white-space: nowrap;
    }
    .badge-yellow { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-orange { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
    .badge-blue   { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .badge-brown  { background: #f5ebe6; color: #78350f; border: 1px solid #e6d3c8; }
    .badge-grey   { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
    
    .code {
      font-family: Consolas, monospace;
      font-size: 8pt;
      background: #f1f5f9;
      padding: 1px 4px;
      border-radius: 3px;
      color: #0f172a;
    }
    .roster-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .roster-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 9px 12px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .roster-card h3 {
      margin: 0 0 5px 0;
      font-size: 10pt;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .roster-card ul {
      margin: 0;
      padding-left: 18px;
      font-size: 8pt;
      color: #334155;
    }
    .roster-card li {
      margin-bottom: 3px;
    }
    .notice-box {
      background: #eff6ff;
      border-left: 3.5px solid #2563eb;
      padding: 8px 12px;
      border-radius: 0 4px 4px 0;
      margin: 12px 0;
      font-size: 8.5pt;
      color: #1e40af;
    }
    .footer {
      margin-top: 20px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 7.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <div class="header-box">
    <div>
      <div class="project-title">OMEGA ENGINEERS SERVICE STATION (SSMS)</div>
      <div class="doc-subtitle">Sidebar Module Bug Responsibility Matrix & Contributor Allocation</div>
    </div>
    <div class="meta-box">
      <strong>Course:</strong> EER4189 Software Design in Group<br>
      <strong>Release:</strong> Milestone 4 (Sprint 0 &amp; 1)<br>
      <strong>Date:</strong> November 2026
    </div>
  </div>

  <div class="notice-box">
    <strong>📋 Purpose of this Document:</strong> This document maps every navigation item in the system sidebar to its responsible developer. If any bug, defect, or calculation error is identified during testing, use this table to directly assign the fix to the responsible contributor based on their allocated Jira User Stories.
  </div>

  <h2>1. Primary Sidebar Module Bug Responsibility Matrix</h2>

  <table>
    <thead>
      <tr>
        <th style="width: 17%;">Sidebar Module</th>
        <th style="width: 38%;">Type of Bug / Failure Description</th>
        <th style="width: 25%;">Assigned Fixer</th>
        <th style="width: 20%;">Jira Reference</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>🔐 Login &amp; Auth</strong></td>
        <td>Password hashing defects, invalid credentials handling, session expiration, PBKDF2 logic</td>
        <td><span class="badge badge-blue">🔵 WW (Blue)</span></td>
        <td><span class="code">SCRUM-11</span> (US-UM-02)</td>
      </tr>
      <tr>
        <td><strong>📑 Sidebar &amp; RBAC</strong></td>
        <td>Role seeing unauthorized tabs (e.g. Mechanic viewing Reports), route guard bypass, UI role hiding</td>
        <td><span class="badge badge-yellow">🟡 Yellow HH</span></td>
        <td><span class="code">SCRUM-12</span> (US-UM-03)</td>
      </tr>
      <tr>
        <td><strong>👥 Customers</strong></td>
        <td>Intake submission fails, Sinhala Unicode name errors, telephone normalization, duplicate phone warning not showing</td>
        <td><span class="badge badge-orange">🟠 Orange HH</span></td>
        <td><span class="code">SCRUM-16</span> (US-JC-01)</td>
      </tr>
      <tr>
        <td><strong>📅 Appointments</strong></td>
        <td>Time slot collision / double-booking allowed, calendar grid wrong, daily capacity overflow</td>
        <td><span class="badge badge-blue">🔵 WW (Blue)</span></td>
        <td><span class="code">SCRUM-17</span> (US-JC-02)</td>
      </tr>
      <tr>
        <td><strong>📋 Job Cards</strong><br><small style="color:#64748b;">(Intake &amp; Bay)</small></td>
        <td>Creating job card fails, vehicle selection dropdown broken, appointment link not updating</td>
        <td><span class="badge badge-orange">🟠 Orange HH</span></td>
        <td><span class="code">SCRUM-18</span> (US-JC-03)</td>
      </tr>
      <tr>
        <td><strong>📋 Job Cards</strong><br><small style="color:#64748b;">(Mechanic)</small></td>
        <td>Assigning technician to bay fails, mechanic active workload count incorrect, unassigning issues</td>
        <td><span class="badge badge-orange">🟠 Orange HH</span></td>
        <td><span class="code">SCRUM-19</span> (US-JC-04)</td>
      </tr>
      <tr>
        <td><strong>📋 Job Cards</strong><br><small style="color:#64748b;">(Parts &amp; FIFO)</small></td>
        <td>Issuing spare parts fails, unit selling price override error, stock deducted from wrong batch</td>
        <td><span class="badge badge-blue">🔵 WW (Blue)</span></td>
        <td><span class="code">SCRUM-26</span> (US-INV-03)</td>
      </tr>
      <tr>
        <td><strong>📋 Job Cards</strong><br><small style="color:#64748b;">(Closure)</small></td>
        <td>Auto-calculating total bill on job completion fails, labor + parts math mismatch</td>
        <td><span class="badge badge-blue">🔵 WW (Blue)</span></td>
        <td><span class="code">SCRUM-31</span> (US-BILL-01)</td>
      </tr>
      <tr>
        <td><strong>📦 Inventory</strong><br><small style="color:#64748b;">(Catalog Master)</small></td>
        <td>Adding new part fails, category dropdown broken, SKU validation, price negative value bypass</td>
        <td><span class="badge badge-brown">🟤 BH (Brown)</span></td>
        <td><span class="code">SCRUM-24</span> (US-INV-01)</td>
      </tr>
      <tr>
        <td><strong>📦 Inventory</strong><br><small style="color:#64748b;">(Danger Alerts)</small></td>
        <td>Low stock badge not displaying when stock drops below threshold, danger list filter error</td>
        <td><span class="badge badge-brown">🟤 BH (Brown)</span></td>
        <td><span class="code">SCRUM-28</span> (US-INV-04)</td>
      </tr>
      <tr>
        <td><strong>🔧 Mechanics</strong></td>
        <td>Adding/editing technician details, updating status (available, busy, off_duty), specialty filter</td>
        <td><span class="badge badge-yellow">🟡 Yellow HH</span></td>
        <td><span class="code">SCRUM-22</span> (US-JC-07)</td>
      </tr>
      <tr>
        <td><strong>💳 Invoices</strong><br><small style="color:#64748b;">(Generation)</small></td>
        <td>Invoice generation from job fails, discount calculation wrong, subtotal mismatch</td>
        <td><span class="badge badge-blue">🔵 WW (Blue)</span></td>
        <td><span class="code">SCRUM-31</span> (US-BILL-01)</td>
      </tr>
      <tr>
        <td><strong>💳 Invoices</strong><br><small style="color:#64748b;">(Payments)</small></td>
        <td>Recording cash/card payments, installment payment balances not updating, reference no. bug</td>
        <td><span class="badge badge-orange">🟠 Orange HH</span></td>
        <td><span class="code">SCRUM-32</span> (US-BILL-02)</td>
      </tr>
      <tr>
        <td><strong>💳 Invoices</strong><br><small style="color:#64748b;">(Printing)</small></td>
        <td>A4 invoice format broken, 80mm POS thermal receipt cutoff, windshield reminder sticker formatting</td>
        <td><span class="badge badge-brown">🟤 BH (Brown)</span></td>
        <td><span class="code">SCRUM-33</span> (US-BILL-03)</td>
      </tr>
      <tr>
        <td><strong>📊 Reports</strong></td>
        <td>Summary financial metrics wrong, daily income calculation, technician productivity report</td>
        <td><span class="badge badge-brown">🟤 BH (Brown)</span></td>
        <td><span class="code">SCRUM-23</span> (US-REP-01)</td>
      </tr>
      <tr>
        <td><strong>📊 Dashboard</strong></td>
        <td>Today's KPI counters not updating (today's jobs, pending count, active mechanics, alerts)</td>
        <td><span class="badge badge-brown">🟤 BH (Brown)</span></td>
        <td><span class="code">SCRUM-23</span> (US-REP-01)</td>
      </tr>
      <tr>
        <td><strong>⚙️ Settings</strong><br><small style="color:#64748b;">(Staff Users)</small></td>
        <td>Admin creating new user accounts, role selection, deactivating account, last-owner demote block</td>
        <td><span class="badge badge-orange">🟠 Orange HH</span></td>
        <td><span class="code">SCRUM-10</span> (US-UM-01)</td>
      </tr>
      <tr>
        <td><strong>⚙️ Settings</strong><br><small style="color:#64748b;">(System &amp; DB)</small></td>
        <td>Station details update, daily capacity config, manual SQLite backup and restore engine</td>
        <td><span class="badge badge-grey">WA / System</span></td>
        <td><span class="code">SCRUM-10</span> / Core</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Contributor Ownership Summary &amp; Scope</h2>

  <div class="roster-grid">
    <div class="roster-card" style="border-left: 3.5px solid #d97706;">
      <h3><span class="badge badge-yellow">🟡 Yellow HH</span> Role Permissions &amp; Technicians</h3>
      <ul>
        <li><strong>Role Permissions (<span class="code">SCRUM-12</span>):</strong> Controls which sidebar tabs are shown/hidden per user role (Admin, Reception, Mechanic, Billing).</li>
        <li><strong>Route Gating:</strong> Blocks direct URL/navigation into restricted modules.</li>
        <li><strong>Mechanic Directory (<span class="code">SCRUM-22</span>):</strong> Manages technician availability states and specialties.</li>
      </ul>
    </div>

    <div class="roster-card" style="border-left: 3.5px solid #ea580c;">
      <h3><span class="badge badge-orange">🟠 Orange HH</span> Customers, Job Cards &amp; Staff</h3>
      <ul>
        <li><strong>Admin User Creation (<span class="code">SCRUM-10</span>):</strong> Admin creating and modifying staff accounts in Settings.</li>
        <li><strong>Customer Intake (<span class="code">SCRUM-16</span>):</strong> Customer profiles, Sinhala Unicode support, duplicate phone warnings.</li>
        <li><strong>Job Cards (<span class="code">SCRUM-18, 19</span>):</strong> Creating job cards, linking appointments, assigning mechanics.</li>
        <li><strong>Payment Recording (<span class="code">SCRUM-32</span>):</strong> Recording partial cash/card installments.</li>
      </ul>
    </div>

    <div class="roster-card" style="border-left: 3.5px solid #0284c7;">
      <h3><span class="badge badge-blue">🔵 WW (Blue)</span> Auth, Appointments &amp; FIFO Math</h3>
      <ul>
        <li><strong>PBKDF2 Login (<span class="code">SCRUM-11</span>):</strong> Salted cryptographic password verification and session state.</li>
        <li><strong>Appointments (<span class="code">SCRUM-17</span>):</strong> Time slot scheduling and strict double-booking collision prevention.</li>
        <li><strong>FIFO Parts Deduction (<span class="code">SCRUM-26</span>):</strong> Atomic deduction from oldest inventory batches upon job issue.</li>
        <li><strong>Auto-Billing (<span class="code">SCRUM-31</span>):</strong> Automated calculation of labor charges, parts costs, and total invoices.</li>
      </ul>
    </div>

    <div class="roster-card" style="border-left: 3.5px solid #92400e;">
      <h3><span class="badge badge-brown">🟤 BH (Brown)</span> Inventory Catalog, Prints &amp; KPIs</h3>
      <ul>
        <li><strong>Inventory Catalog (<span class="code">SCRUM-24</span>):</strong> Stock items master, SKU codes, units, and categories.</li>
        <li><strong>Stock Danger List (<span class="code">SCRUM-28</span>):</strong> Low stock threshold alerts and replenishment views.</li>
        <li><strong>Dual Printing (<span class="code">SCRUM-33</span>):</strong> Standard A4 invoices, 80mm POS thermal receipts, reminder stickers.</li>
        <li><strong>Reports &amp; KPIs (<span class="code">SCRUM-23</span>):</strong> Daily financial summary, parts consumption, technician productivity.</li>
      </ul>
    </div>
  </div>

  <h2>3. Test Accounts Quick Reference</h2>
  <table>
    <thead>
      <tr>
        <th>Role Description</th>
        <th>Username</th>
        <th>Password</th>
        <th>Authorized Sidebar Access</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Owner / Administrator</strong></td>
        <td><span class="code">admin</span></td>
        <td><span class="code">admin123</span></td>
        <td>Full access to all 9 modules, financial KPIs, backups, staff user accounts</td>
      </tr>
      <tr>
        <td><strong>Receptionist / Service Advisor</strong></td>
        <td><span class="code">reception</span></td>
        <td><span class="code">reception123</span></td>
        <td>Dashboard, Customers, Vehicles, Appointments, Job Cards intake</td>
      </tr>
      <tr>
        <td><strong>Lead Mechanic / Technician</strong></td>
        <td><span class="code">mechanic_kasun</span></td>
        <td><span class="code">mechanic123</span></td>
        <td>Assigned Job Cards, repair task checklist, bay status updates</td>
      </tr>
      <tr>
        <td><strong>Inventory &amp; Billing Clerk</strong></td>
        <td><span class="code">billing_staff</span></td>
        <td><span class="code">billing123</span></td>
        <td>Inventory catalog, stock batches, Invoices, payments settlement</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <span>Omega Engineers Service Station Management System — Confidential Academic Artifact</span>
    <span>Generated November 2026</span>
  </div>

</body>
</html>
"""

def generate_pdf():
    html_path = os.path.abspath("docs/Omega_Engineers_Bug_Responsibility_Matrix.html")
    pdf_path = os.path.abspath("docs/Omega_Engineers_Bug_Responsibility_Matrix.pdf")
    
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(HTML_CONTENT)
    print("HTML written to:", html_path)
    
    edge_exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if not os.path.exists(edge_exe):
        edge_exe = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
        
    cmd = [
        edge_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        html_path
    ]
    print("Running Edge PDF converter...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(pdf_path):
        print(f"SUCCESS: PDF generated ({os.path.getsize(pdf_path)} bytes) at: {pdf_path}")
    else:
        print("ERROR: PDF generation failed. Stderr:", res.stderr)

def generate_docx():
    docx_path = os.path.abspath("docs/Omega_Engineers_Bug_Responsibility_Matrix.docx")
    doc = docx.Document()
    
    # Page setup
    for sec in doc.sections:
        sec.top_margin = Inches(0.6)
        sec.bottom_margin = Inches(0.6)
        sec.left_margin = Inches(0.6)
        sec.right_margin = Inches(0.6)
        
    # Title
    p_title = doc.add_paragraph()
    r_title = p_title.add_run("OMEGA ENGINEERS SERVICE STATION (SSMS)")
    r_title.bold = True
    r_title.font.size = Pt(16)
    r_title.font.color.rgb = RGBColor(30, 58, 138)
    p_title.paragraph_format.space_after = Pt(2)
    
    p_sub = doc.add_paragraph()
    r_sub = p_sub.add_run("Sidebar Module Bug Responsibility Matrix & Contributor Allocation Guide")
    r_sub.bold = True
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)
    p_sub.paragraph_format.space_after = Pt(12)
    
    # Table
    doc.add_heading("1. Sidebar Module Bug Responsibility Matrix", level=2)
    
    headers = ["Sidebar Module", "Type of Bug / Failure Description", "Assigned Fixer", "Jira Key"]
    data = [
        ["Login & Auth", "Password hashing defects, invalid credentials handling, session expiration", "🔵 WW (Blue)", "SCRUM-11 (US-UM-02)"],
        ["Sidebar & RBAC", "Role seeing unauthorized tabs, route guard bypass, UI role hiding", "🟡 Yellow HH", "SCRUM-12 (US-UM-03)"],
        ["Customers", "Intake fails, Sinhala Unicode name errors, phone normalization, duplicate warnings", "🟠 Orange HH", "SCRUM-16 (US-JC-01)"],
        ["Appointments", "Time slot double-booking allowed, calendar grid wrong, capacity overflow", "🔵 WW (Blue)", "SCRUM-17 (US-JC-02)"],
        ["Job Cards (Intake)", "Creating job card fails, vehicle selector broken, appointment link error", "🟠 Orange HH", "SCRUM-18 (US-JC-03)"],
        ["Job Cards (Mechanic)", "Assigning technician to bay fails, mechanic active workload count wrong", "🟠 Orange HH", "SCRUM-19 (US-JC-04)"],
        ["Job Cards (Parts/FIFO)", "Issuing spare parts fails, price override error, stock deducted from wrong batch", "🔵 WW (Blue)", "SCRUM-26 (US-INV-03)"],
        ["Job Cards (Closure)", "Auto-calculating total bill on job completion fails, labor + parts mismatch", "🔵 WW (Blue)", "SCRUM-31 (US-BILL-01)"],
        ["Inventory (Catalog)", "Adding new part fails, category dropdown broken, SKU validation, price negative bypass", "🟤 BH (Brown)", "SCRUM-24 (US-INV-01)"],
        ["Inventory (Alerts)", "Low stock badge not displaying when stock drops below threshold", "🟤 BH (Brown)", "SCRUM-28 (Sprint 1)"],
        ["Mechanics", "Adding/editing technician details, updating status (available, busy, off_duty)", "🟡 Yellow HH", "SCRUM-22 (Sprint 1)"],
        ["Invoices (Billing)", "Invoice generation from job fails, discount calculation wrong, subtotal mismatch", "🔵 WW (Blue)", "SCRUM-31 (US-BILL-01)"],
        ["Invoices (Payments)", "Recording cash/card payments, installment payment balances not updating", "🟠 Orange HH", "SCRUM-32 (Sprint 1)"],
        ["Invoices (Printing)", "A4 invoice format broken, 80mm POS thermal receipt cutoff, reminder sticker format", "🟤 BH (Brown)", "SCRUM-33 (Sprint 1)"],
        ["Reports", "Summary financial metrics wrong, daily income calculation, productivity report", "🟤 BH (Brown)", "SCRUM-23 (Sprint 1)"],
        ["Dashboard", "Today's KPI counters not updating (today's jobs, pending count, active mechanics)", "🟤 BH (Brown)", "SCRUM-23 (Sprint 1)"],
        ["Settings (Staff Users)", "Admin creating new user accounts, role selection, deactivating account", "🟠 Orange HH", "SCRUM-10 (US-UM-01)"],
        ["Settings (General)", "Station details update, daily capacity config, manual SQLite backup/restore", "WA / System", "Core Infrastructure"]
    ]
    
    tbl = doc.add_table(rows=len(data) + 1, cols=4)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    
    col_widths = [Inches(1.3), Inches(2.7), Inches(1.5), Inches(1.5)]
    
    # Header row
    hdr_cells = tbl.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = h
        hdr_cells[i].paragraphs[0].runs[0].bold = True
        hdr_cells[i].paragraphs[0].runs[0].font.size = Pt(8.5)
        # Background color
        shading = parse_xml(r'<w:shd {} w:fill="F1F5F9"/>'.format(nsdecls('w')))
        hdr_cells[i]._tc.get_or_add_tcPr().append(shading)
        
    for r_idx, row in enumerate(data):
        row_cells = tbl.rows[r_idx + 1].cells
        for c_idx, val in enumerate(row):
            row_cells[c_idx].text = val
            p = row_cells[c_idx].paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            if p.runs:
                p.runs[0].font.size = Pt(8)
                if c_idx == 0:
                    p.runs[0].bold = True
                    
    # Format table borders and cell widths
    for row in tbl.rows:
        for idx, width in enumerate(col_widths):
            row.cells[idx].width = width
            
    doc.add_paragraph().paragraph_format.space_after = Pt(8)
    
    # Roster summary
    doc.add_heading("2. Contributor Ownership Summary", level=2)
    roster_points = [
        ("🟡 Yellow HH", "Role Permissions & Route Gating (SCRUM-12), Mechanics Directory (SCRUM-22)"),
        ("🟠 Orange HH", "Admin Staff Management (SCRUM-10), Customer Intake & Sinhala Unicode (SCRUM-16), Job Card Creation (SCRUM-18), Mechanic Assignment (SCRUM-19), Payment Recording (SCRUM-32)"),
        ("🔵 WW (Blue)", "PBKDF2 Salted Login (SCRUM-11), Appointments & Double-Booking Prevention (SCRUM-17), FIFO Parts Deduction (SCRUM-26), Auto-Billing Calculation (SCRUM-31)"),
        ("🟤 BH (Brown)", "Stock Items & Categorization (SCRUM-24), Low Stock Danger List (SCRUM-28), Dual Printing Engine (SCRUM-33), Business KPI Reports (SCRUM-23)"),
        ("WA", "Supplier Purchase Invoices (SCRUM-25), Job Card Closure Trigger (SCRUM-21), Due Payment Tracking (SCRUM-34)")
    ]
    for name, desc in roster_points:
        p = doc.add_paragraph(style='List Bullet')
        r_n = p.add_run(name + ": ")
        r_n.bold = True
        r_n.font.size = Pt(9)
        r_d = p.add_run(desc)
        r_d.font.size = Pt(9)
        p.paragraph_format.space_after = Pt(2)
        
    doc.save(docx_path)
    print("DOCX written to:", docx_path)

if __name__ == '__main__':
    generate_pdf()
    generate_docx()
