# Stitch 1:1 Transplant Implementation Plan

To ensure that the beautiful Stitch AI generated UI designs are fully utilized without losing any of their rich TailwindCSS structures or SVGs, we will execute a **Strict 1:1 Transplant** of the HTML designs in 5 sequential steps. 

I will use separate tool calls to read the files from the `assests/` folder and then overwrite the corresponding `frontend/` files without summarizing or simplifying any classes.

### Global Anti-Truncation & Fidelity Rules:
1. **Header and CDN Preservation**: Copy the exact `<head>` block, including the Tailwind CDN (`<script src="https://cdn.tailwindcss.com">`), the `<script id="tailwind-config">` that defines brand colors (like `nyrix-blue` and `nyrix-green`), and all Google Fonts (`Geist`, `Inter`, etc.).
2. **Remove Sandbox Locks**: Delete `<div id="snapdom-sandbox">` and any inline `width: 1280px; height: 2470px; overflow: hidden;` styles on the `<html>`/`<body>` tags to restore natural scrolling.
3. **Local Logo Routing**: Replace placeholder `https://lh3.googleusercontent.com/...` logo images with `assets/nyrix logo.png` pointing to our local filesystem.
4. **JS Template Literals**: I will copy the *exact* HTML syntax of list items (`<li>`), rows (`<tr>`), and cards (`<div>`) directly into our `.js` file template literals so dynamically rendered data seamlessly assumes the premium styling.
5. **No External Scope**: Delete any print or CSV export buttons that are present in the mockups to maintain MVP focus.

---

### Execution Sequence:

#### Step 1: Login Interface Transplant
- **Source**: `assests/login interface/login.html` (and `.md`)
- **Target**: `frontend/index.html` & `frontend/js/auth.js`
- **Actions**:
  - Read the exact login mockup.
  - Overwrite `index.html`.
  - Update `auth.js` to target the exact `#username` / `#password` input IDs (or equivalent classes) and the login submit button. Bind the `POST /api/auth/login` logic and redirection.

#### Step 2: Othmane's Admin Dashboard Transplant
- **Source**: `assests/othmane's interface/othmane's stock view.html` & `mockup othmane.html`
- **Target**: `frontend/othmane_dashboard.html` & `frontend/js/othmane.js`
- **Actions**:
  - Read both mockups.
  - Establish the shell using `othmane's stock view.html` (left sidebar, top navbar).
  - Create `<div id="view-importation">` containing the entire Landed Cost workspace from `mockup othmane.html`.
  - Create `<div id="view-stock" class="hidden">` containing the entire inventory table and KPI cards from `othmane's stock view.html`.
  - Update `othmane.js` to wire the sidebar toggles, fetch `GET /api/finance/valuation` and use the rich Stitch `<tr>` syntax inside the innerHTML injection.

#### Step 3: Karime's Warehouse Interface Transplant
- **Source**: `assests/karime's interface/*.html` (e.g., `karime's dashboard.html`)
- **Target**: `frontend/karime_warehouse.html` & `frontend/js/karime.js`
- **Actions**:
  - Read the warehouse mockup.
  - Replicate the exact DOM structure. Establish the conditional rendering containers for State 1 (Reception Day) and State 2 (Normal Logistics Operations).
  - Copy the exact Stitch Tailwind SVGs for action modals and buttons.
  - Update `karime.js` so that `GET /api/warehouse/inbound` dictates which State container loses the `hidden` class, and bind the APIs.

#### Step 4: Packer's Tablet Interface Transplant
- **Source**: `assests/packer's interface/*.html` (e.g., `packer's tablet kiosk.html`)
- **Target**: `frontend/packer_tablet.html` & `frontend/js/packer.js`
- **Actions**:
  - Read the tablet mockup.
  - Transplant the touch-optimized UI, preserving the massive toggle tabs and grid system.
  - Update `packer.js` to extract the beautiful order cards (with B2B/B2C badging) into the JavaScript template literal for the `loadOrders()` function. 

#### Step 5: Mehdi's B2B Portal Transplant
- **Source**: `assests/mehdi b2b interface/*.html` (e.g., `mehdi's b2b view.html`)
- **Target**: `frontend/mehdi_b2b.html` & `frontend/js/mehdi.js`
- **Actions**:
  - Read the B2B mockup.
  - Transplant the stacked top forms and the bottom wide data table, keeping the Tailwind forms layout intact.
  - Update `mehdi.js` to dynamically add SKU rows that match the Tailwind input styling, automatically calculate totals, and render the exact Stitch status badges.

Please approve this execution plan, and I will immediately commence Step 1 by reading the Login Interface source files!
